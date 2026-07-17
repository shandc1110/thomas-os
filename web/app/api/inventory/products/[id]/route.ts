import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getProductById, updateProductPresell } from "@/lib/inventory/products";
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

  if (body.action !== "presell") {
    return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  }

  const { product, error } = await updateProductPresell(supabase, params.id, {
    presell_enabled: Boolean(body.presell_enabled),
    presell_quantity: Number(body.presell_quantity ?? 0),
    expected_arrival_month: body.expected_arrival_month ?? null,
  });

  if (error) return NextResponse.json({ success: false, error }, { status: 500 });
  return NextResponse.json({ success: true, product });
});
