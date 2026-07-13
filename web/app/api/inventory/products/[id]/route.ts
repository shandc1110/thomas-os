import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getProductById } from "@/lib/inventory/products";
import { getProductBalances, getProductLedger } from "@/lib/inventory/movements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const include = searchParams.get("include") ?? "";

  try {
    const supabase = getSupabaseAdmin();
    const { product, error } = await getProductById(supabase, id);
    if (error || !product) {
      return NextResponse.json({ success: false, error: error ?? "Not found." }, { status: 404 });
    }

    const result: Record<string, unknown> = { product };

    if (include.includes("balances")) {
      const { balances } = await getProductBalances(supabase, id);
      result.balances = balances;
    }
    if (include.includes("ledger")) {
      const { ledger } = await getProductLedger(supabase, id);
      result.ledger = ledger;
    }

    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ success: false, error: "Server not configured." }, { status: 500 });
  }
}
