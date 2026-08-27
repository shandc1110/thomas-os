import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import {
  importJoybuyOrders,
  syncInventoryToJoybuy,
  syncProductsToJoybuy,
} from "@/lib/integrations/joybuy/sync";

type SyncKind = "products" | "inventory" | "orders";

export const POST = staffRoute(async ({ supabase, request }) => {
  let body: { kind?: SyncKind; productIds?: string[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const kind = body.kind;
  if (kind !== "products" && kind !== "inventory" && kind !== "orders") {
    return NextResponse.json(
      {
        success: false,
        code: "JOYBUY_MAPPING_ERROR",
        error: "Invalid sync kind. Use products, inventory, or orders.",
      },
      { status: 400 },
    );
  }

  if (kind === "products") {
    const result = await syncProductsToJoybuy(supabase, body.productIds);
    return NextResponse.json(result, { status: result.success ? 200 : 503 });
  }

  if (kind === "inventory") {
    const result = await syncInventoryToJoybuy(supabase, body.productIds);
    return NextResponse.json(result, { status: result.success ? 200 : 503 });
  }

  const result = await importJoybuyOrders();
  return NextResponse.json(result, { status: result.success ? 200 : 503 });
});
