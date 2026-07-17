import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getProductById, updateProductPresell, updateProductPricing, updateProductShipping } from "@/lib/inventory/products";
import { getProductBalances, getProductLedger } from "@/lib/inventory/movements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute<{ id: string }>(async ({ request, supabase, params }) => {
  const { searchParams } = new URL(request.url);
  const include = searchParams.get("include") ?? "";

  const { product, error } = await getProductById(supabase, params.id);
  if (error || !product) {
    return NextResponse.json({ success: false, error: error ?? "Not found." }, { status: 404 });
  }

  const result: Record<string, unknown> = { product };

  if (include.includes("balances")) {
    const { balances } = await getProductBalances(supabase, params.id);
    result.balances = balances;
  }
  if (include.includes("ledger")) {
    const { ledger } = await getProductLedger(supabase, params.id);
    result.ledger = ledger;
  }

  return NextResponse.json({ success: true, ...result });
});

export const PATCH = staffRoute<{ id: string }>(async ({ request, supabase, params }) => {
  const body = await request.json();

  if (body.action === "presell") {
    const { product, error } = await updateProductPresell(supabase, params.id, {
      presell_enabled: Boolean(body.presell_enabled),
      presell_quantity: Number(body.presell_quantity ?? 0),
      expected_arrival_month: body.expected_arrival_month ?? null,
    });

    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, product });
  }

  if (body.action === "pricing") {
    const payload: {
      cost_price?: number | null;
      price?: number | null;
      retail_price?: number | null;
      shopify_price?: number | null;
    } = {};

    if ("cost_price" in body) {
      payload.cost_price = body.cost_price != null ? Number(body.cost_price) : null;
    }
    if ("price" in body) {
      payload.price = body.price != null ? Number(body.price) : null;
    }
    if ("retail_price" in body) {
      payload.retail_price = body.retail_price != null ? Number(body.retail_price) : null;
    }
    if ("shopify_price" in body) {
      payload.shopify_price = body.shopify_price != null ? Number(body.shopify_price) : null;
    }

    const { product, error } = await updateProductPricing(supabase, params.id, payload);

    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, product });
  }

  if (body.action === "shipping") {
    const toInt = (value: unknown) => {
      if (value == null || value === "") return null;
      const num = Number(value);
      return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
    };

    const { product, error } = await updateProductShipping(supabase, params.id, {
      weight_grams: toInt(body.weight_grams),
      length_mm: toInt(body.length_mm),
      width_mm: toInt(body.width_mm),
      height_mm: toInt(body.height_mm),
    });

    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, product });
  }

  return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
});
