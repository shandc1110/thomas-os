import "server-only";
import { coerceJoybuyFlag } from "./flags";
import { joybuyRequest } from "./http";
import { joybuyLog } from "./log";

export type BrandCategoryValidationInput = {
  brandId: string;
  categoryId: string;
};

export type BrandCategoryValidationResult = {
  httpSuccess: boolean;
  /** Business result from data.result (not merely envelope.success). */
  businessPassed: boolean;
  reason: string | null;
  rawData: unknown;
};

/**
 * POST /sp-seller/v0/brand-categories/validations
 * Envelope success ≠ business validation passed — check data.result/reason.
 */
export async function validateJoybuyBrandCategory(
  input: BrandCategoryValidationInput,
  options?: { fetchImpl?: typeof fetch; timestampMs?: number },
): Promise<BrandCategoryValidationResult> {
  joybuyLog({
    operation: "brandCategoryValidation",
    message: `validating brandId=${input.brandId} categoryId=${input.categoryId}`,
  });

  const response = await joybuyRequest<{
    result?: unknown;
    reason?: unknown;
  }>({
    method: "POST",
    path: "/sp-seller/v0/brand-categories/validations",
    body: {
      brandId: input.brandId,
      categoryId: input.categoryId,
    },
    fetchImpl: options?.fetchImpl,
    timestampMs: options?.timestampMs,
  });

  const data = response.data ?? {};
  const resultFlag = coerceJoybuyFlag(
    data && typeof data === "object" ? (data as { result?: unknown }).result : null,
  );
  const reasonRaw =
    data && typeof data === "object" ? (data as { reason?: unknown }).reason : null;
  const reason = typeof reasonRaw === "string" ? reasonRaw : null;

  const businessPassed = resultFlag === true;

  return {
    httpSuccess: response.envelope.success === true,
    businessPassed,
    reason,
    rawData: data,
  };
}
