import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/lib/types";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { validateJoybuyBrandCategory } from "./brand-categories";
import { JoybuyApiError } from "./errors";
import { joybuyRequest } from "./http";
import { joybuyLog } from "./log";
import {
  assertJoybuyCredentialPresence,
  assertJoybuyFirstProductPrerequisites,
  CT7013_INTERNAL_PRODUCT_ID,
  CT7013_SKU,
  getJoybuyMerchantConfigFromEnv,
  JOYBUY_CHANNEL,
  JOYBUY_PRE_RELEASE_API_BASE_URL,
  type JoybuyMerchantConfig,
} from "./merchant-config";
import {
  buildCt7013ProductSchemaComponents,
  parseProductSchemaCreateData,
  sanitizeProductSchemaPreview,
  type JoybuyProductSchemaRequest,
} from "./product-schema";

export type FirstProductRunResult = {
  stopped: boolean;
  apiCallMade: boolean;
  brandValidationSkipped: boolean;
  prerequisites: ReturnType<typeof assertJoybuyFirstProductPrerequisites>;
  credentialIssues: ReturnType<typeof assertJoybuyCredentialPresence>;
  validation?: {
    httpSuccess: boolean;
    businessPassed: boolean;
    reason: string | null;
  };
  schemaPreview?: ReturnType<typeof sanitizeProductSchemaPreview>;
  httpStatus?: number;
  joybuySuccess?: boolean | null;
  errorList?: unknown[];
  requestId?: string | null;
  createResponse?: {
    productId: string | null;
    versionId: string | number | null;
  };
  persistedMapping?: {
    internalProductId: string;
    sku: string;
    externalProductId: string | null;
    externalVersionId: string | null;
  };
  stopReason?: string;
};

export async function persistJoybuyProductMapping(
  supabase: SupabaseClient,
  input: {
    internalProductId: string;
    sku: string;
    externalProductId: string;
    externalVersionId?: string | number | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const organizationId = getOrganizationId();
  const { error } = await supabase.from("channel_product_mappings").upsert(
    {
      organization_id: organizationId,
      channel: JOYBUY_CHANNEL,
      internal_product_id: input.internalProductId,
      sku: input.sku,
      external_product_id: input.externalProductId,
      external_sku_id: input.sku,
      external_version_id:
        input.externalVersionId == null ? null : String(input.externalVersionId),
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,channel,sku" },
  );
  if (error) throw new Error(`Failed to persist Joybuy mapping: ${error.message}`);
}

/**
 * Controlled first-product integration for CT7013 only.
 * Fail-closed: never invent merchant IDs; never call production; never touch other SKUs.
 * One product-schema call only — no auto retry / inventory / publish.
 */
export async function runCt7013FirstProductIntegration(
  supabase: SupabaseClient,
  product: Product,
  options?: {
    merchant?: JoybuyMerchantConfig;
    fetchImpl?: typeof fetch;
    /** When false, stop after building preview (no HTTP). Default true when prerequisites pass. */
    executeApi?: boolean;
  },
): Promise<FirstProductRunResult> {
  if (String(product.id) !== CT7013_INTERNAL_PRODUCT_ID || (product.sku ?? "") !== CT7013_SKU) {
    return {
      stopped: true,
      apiCallMade: false,
      brandValidationSkipped: true,
      prerequisites: [],
      credentialIssues: [],
      stopReason: "Refusing to run for any product other than CT7013 Body Magnet.",
    };
  }

  const merchant = options?.merchant ?? getJoybuyMerchantConfigFromEnv();
  const prerequisites = assertJoybuyFirstProductPrerequisites(merchant);
  const credentialIssues = assertJoybuyCredentialPresence();

  if (prerequisites.length > 0 || credentialIssues.length > 0) {
    return {
      stopped: true,
      apiCallMade: false,
      brandValidationSkipped: true,
      prerequisites,
      credentialIssues,
      stopReason:
        "Prerequisites or credentials missing — fail closed before any Joybuy HTTP call.",
    };
  }

  // Absolute safety: never call anything other than the pre-release host.
  if (merchant.apiBaseUrl !== JOYBUY_PRE_RELEASE_API_BASE_URL) {
    return {
      stopped: true,
      apiCallMade: false,
      brandValidationSkipped: true,
      prerequisites,
      credentialIssues,
      stopReason: "Refusing API call: JOYBUY_API_BASE_URL is not the pre-release host.",
    };
  }

  const built = buildCt7013ProductSchemaComponents(product, merchant);
  if (!built.ok) {
    return {
      stopped: true,
      apiCallMade: false,
      brandValidationSkipped: true,
      prerequisites,
      credentialIssues,
      stopReason: `Schema blockers: ${built.blockers.join("; ")}`,
    };
  }

  const schemaPreview = sanitizeProductSchemaPreview(built.request);
  const canValidateBrand = Boolean(merchant.mideerBrandId && merchant.ct7013CategoryId);

  if (options?.executeApi === false) {
    return {
      stopped: true,
      apiCallMade: false,
      brandValidationSkipped: !canValidateBrand,
      prerequisites,
      credentialIssues,
      schemaPreview,
      stopReason: "executeApi=false — preview only.",
    };
  }

  // Brand/category validation only when both merchant IDs are configured.
  // Do not invent documentation examples; skip when unset.
  let validation:
    | { httpSuccess: boolean; businessPassed: boolean; reason: string | null }
    | undefined;
  const brandValidationSkipped = !canValidateBrand;

  if (canValidateBrand) {
    const result = await validateJoybuyBrandCategory(
      {
        brandId: merchant.mideerBrandId!,
        categoryId: merchant.ct7013CategoryId!,
      },
      { fetchImpl: options?.fetchImpl },
    );
    validation = {
      httpSuccess: result.httpSuccess,
      businessPassed: result.businessPassed,
      reason: result.reason,
    };
    if (!result.businessPassed) {
      return {
        stopped: true,
        apiCallMade: true,
        brandValidationSkipped: false,
        prerequisites,
        credentialIssues,
        validation,
        schemaPreview,
        stopReason: `Brand/category validation failed: ${result.reason ?? "no reason"}`,
      };
    }
  }

  // Single product-schema create (pre-release only). No catalog/product mapping writes before this.
  joybuyLog({
    operation: "productSchemaCreate",
    sku: CT7013_SKU,
    internalProductId: CT7013_INTERNAL_PRODUCT_ID,
    message: "submitting CT7013 product-schema (pre-release, one call)",
  });

  try {
    const createResponse = await joybuyRequest<unknown>({
      method: "POST",
      path: "/sp-product/v0/product-schema",
      body: built.request as JoybuyProductSchemaRequest,
      fetchImpl: options?.fetchImpl,
    });

    const errorList = createResponse.envelope.errorList ?? [];
    if (errorList.length > 0) {
      return {
        stopped: true,
        apiCallMade: true,
        brandValidationSkipped,
        prerequisites,
        credentialIssues,
        validation,
        schemaPreview,
        httpStatus: createResponse.httpStatus,
        joybuySuccess: createResponse.envelope.success,
        errorList,
        requestId: createResponse.envelope.requestId ?? null,
        createResponse: parseProductSchemaCreateData(createResponse.data),
        stopReason: "product-schema returned errorList — not persisting mapping",
      };
    }

    const created = parseProductSchemaCreateData(createResponse.data);
    if (!created.productId) {
      return {
        stopped: true,
        apiCallMade: true,
        brandValidationSkipped,
        prerequisites,
        credentialIssues,
        validation,
        schemaPreview,
        httpStatus: createResponse.httpStatus,
        joybuySuccess: createResponse.envelope.success,
        errorList,
        requestId: createResponse.envelope.requestId ?? null,
        createResponse: created,
        stopReason: "product-schema response missing productId — not persisting mapping",
      };
    }

    await persistJoybuyProductMapping(supabase, {
      internalProductId: CT7013_INTERNAL_PRODUCT_ID,
      sku: CT7013_SKU,
      externalProductId: created.productId,
      externalVersionId: created.versionId,
      metadata: {
        listPriceGbp: merchant.ct7013ListPriceGbp,
        scene: merchant.scene,
        categoryId: merchant.ct7013CategoryId,
        brandId: merchant.mideerBrandId,
        shopId: merchant.shopId,
      },
    });

    return {
      stopped: false,
      apiCallMade: true,
      brandValidationSkipped,
      prerequisites,
      credentialIssues,
      validation,
      schemaPreview,
      httpStatus: createResponse.httpStatus,
      joybuySuccess: createResponse.envelope.success,
      errorList,
      requestId: createResponse.envelope.requestId ?? null,
      createResponse: created,
      persistedMapping: {
        internalProductId: CT7013_INTERNAL_PRODUCT_ID,
        sku: CT7013_SKU,
        externalProductId: created.productId,
        externalVersionId:
          created.versionId == null ? null : String(created.versionId),
      },
    };
  } catch (err) {
    if (err instanceof JoybuyApiError) {
      return {
        stopped: true,
        apiCallMade: true,
        brandValidationSkipped,
        prerequisites,
        credentialIssues,
        validation,
        schemaPreview,
        httpStatus: err.httpStatus,
        joybuySuccess: false,
        errorList: err.errorList,
        requestId: err.requestId,
        stopReason: `Joybuy API error: ${err.joybuyCode ?? "unknown"} — ${err.message}`,
      };
    }
    throw err;
  }
}
