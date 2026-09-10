import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import {
  addChloeEditProduct,
  listChloeEditAdmin,
  removeChloeEditProduct,
  reorderChloeEditProducts,
  searchChloeEditCandidates,
  updateChloeEditProduct,
} from "@/lib/storefront/chloe-edit-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff-only Chloe's Edit curation list + candidate search. */
export const GET = staffRoute(async ({ request, supabase }) => {
  const orgId = getOrganizationId();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";

  if (search) {
    const { rows, error } = await searchChloeEditCandidates(supabase, orgId, search);
    if (error) {
      return NextResponse.json({ success: false, error }, { status: 500 });
    }
    return NextResponse.json({ success: true, candidates: rows });
  }

  const { rows, error } = await listChloeEditAdmin(supabase, orgId);
  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
  return NextResponse.json({ success: true, products: rows });
});

/** Add / update / remove / reorder curation — never mutates product commercial fields. */
export const POST = staffRoute(async ({ request, supabase }) => {
  const orgId = getOrganizationId();
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "add") {
    const productId = typeof body.product_id === "string" ? body.product_id : "";
    if (!productId) {
      return NextResponse.json({ success: false, error: "product_id is required." }, { status: 400 });
    }
    const position =
      body.position != null && Number.isFinite(Number(body.position))
        ? Math.trunc(Number(body.position))
        : undefined;
    const editorialNote =
      typeof body.editorial_note === "string" ? body.editorial_note : null;
    const { row, error } = await addChloeEditProduct(supabase, orgId, productId, {
      position,
      editorialNote,
    });
    if (error) {
      const status = error.includes("already") ? 409 : 400;
      return NextResponse.json({ success: false, error }, { status });
    }
    return NextResponse.json({ success: true, product: row });
  }

  if (action === "remove") {
    const productId = typeof body.product_id === "string" ? body.product_id : "";
    if (!productId) {
      return NextResponse.json({ success: false, error: "product_id is required." }, { status: 400 });
    }
    const { error } = await removeChloeEditProduct(supabase, orgId, productId);
    if (error) {
      return NextResponse.json({ success: false, error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "update") {
    const productId = typeof body.product_id === "string" ? body.product_id : "";
    if (!productId) {
      return NextResponse.json({ success: false, error: "product_id is required." }, { status: 400 });
    }
    const patch: { position?: number; editorialNote?: string | null } = {};
    if (body.position != null) {
      if (!Number.isFinite(Number(body.position))) {
        return NextResponse.json(
          { success: false, error: "position must be a number." },
          { status: 400 },
        );
      }
      patch.position = Math.trunc(Number(body.position));
    }
    if ("editorial_note" in body) {
      patch.editorialNote =
        body.editorial_note == null
          ? null
          : typeof body.editorial_note === "string"
            ? body.editorial_note
            : null;
    }
    const { row, error } = await updateChloeEditProduct(supabase, orgId, productId, patch);
    if (error) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }
    return NextResponse.json({ success: true, product: row });
  }

  if (action === "reorder") {
    const ids = body.ordered_product_ids;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      return NextResponse.json(
        { success: false, error: "ordered_product_ids must be a string array." },
        { status: 400 },
      );
    }
    const { error } = await reorderChloeEditProducts(
      supabase,
      orgId,
      ids as string[],
    );
    if (error) {
      return NextResponse.json({ success: false, error }, { status: 500 });
    }
    const { rows, error: listError } = await listChloeEditAdmin(supabase, orgId);
    if (listError) {
      return NextResponse.json({ success: false, error: listError }, { status: 500 });
    }
    return NextResponse.json({ success: true, products: rows });
  }

  return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
});
