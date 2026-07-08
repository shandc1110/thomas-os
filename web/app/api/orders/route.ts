import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type {
  CreateOrderError,
  CreateOrderRequest,
  CreateOrderResponse,
  OrderItemInput,
  StockIssue,
} from "@/lib/order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductRow = {
  id: string | number;
  name: string;
  price: number | null;
  stock: number | null;
  active: boolean | null;
};

const MAX_CAS_ATTEMPTS = 5;

function isMissingColumnError(error: { code?: string; message?: string }, column: string): boolean {
  // 42703 = undefined_column (Postgres), PGRST204 = column not found (PostgREST schema cache)
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return Boolean(error.message && error.message.toLowerCase().includes(`'${column}'`));
}

function badRequest(message: string) {
  return NextResponse.json<CreateOrderError>(
    { success: false, error: message },
    { status: 400 },
  );
}

function normaliseItems(raw: unknown): OrderItemInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const merged = new Map<string, OrderItemInput>();
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;
    const { product_id, quantity } = entry as Record<string, unknown>;
    if (product_id === undefined || product_id === null) return null;
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) return null;
    const key = String(product_id);
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += qty;
    } else {
      merged.set(key, { product_id: product_id as OrderItemInput["product_id"], quantity: qty });
    }
  }
  return [...merged.values()];
}

/**
 * Atomically decrement stock using compare-and-swap so concurrent orders can
 * never oversell. Returns true on success, false if stock is insufficient or
 * the row could not be updated after several attempts.
 */
async function decrementStock(
  supabase: SupabaseClient,
  productId: string | number,
  quantity: number,
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const { data: current, error } = await supabase
      .from("products")
      .select("stock")
      .eq("id", productId)
      .single();

    if (error || !current) return false;

    const stock = (current.stock as number | null) ?? 0;
    if (stock < quantity) return false;

    const { data: updated, error: updateError } = await supabase
      .from("products")
      .update({ stock: stock - quantity })
      .eq("id", productId)
      .eq("stock", stock)
      .select("id");

    if (updateError) return false;
    if (updated && updated.length > 0) return true;
    // Row changed between read and write; retry.
  }
  return false;
}

/** Best-effort compensation: add stock back after a failed order. */
async function restoreStock(
  supabase: SupabaseClient,
  applied: { productId: string | number; quantity: number }[],
): Promise<void> {
  for (const { productId, quantity } of applied) {
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
      const { data: current, error } = await supabase
        .from("products")
        .select("stock")
        .eq("id", productId)
        .single();
      if (error || !current) break;
      const stock = (current.stock as number | null) ?? 0;
      const { data: updated } = await supabase
        .from("products")
        .update({ stock: stock + quantity })
        .eq("id", productId)
        .eq("stock", stock)
        .select("id");
      if (updated && updated.length > 0) break;
    }
  }
}

export async function POST(request: Request): Promise<NextResponse<CreateOrderResponse>> {
  let body: CreateOrderRequest;
  try {
    body = (await request.json()) as CreateOrderRequest;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const customer = body?.customer;
  const name = customer?.name?.trim();
  const wechatName = customer?.wechat_name?.trim();
  const phone = customer?.phone?.trim();
  const notes = customer?.notes?.trim() || null;

  if (!name) return badRequest("Customer name is required.");
  if (!wechatName) return badRequest("WeChat name is required.");
  if (!phone) return badRequest("Phone number is required.");

  const items = normaliseItems(body?.items);
  if (!items) return badRequest("Your cart is empty or contains invalid items.");

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json<CreateOrderError>(
      { success: false, error: "Ordering is not configured. Missing service role key." },
      { status: 500 },
    );
  }

  const ids = items.map((item) => item.product_id);
  const { data: productRows, error: fetchError } = await supabase
    .from("products")
    .select("id, name, price, stock, active")
    .in("id", ids);

  if (fetchError) {
    return NextResponse.json<CreateOrderError>(
      { success: false, error: "Could not verify product availability." },
      { status: 500 },
    );
  }

  const productMap = new Map<string, ProductRow>();
  for (const row of (productRows ?? []) as ProductRow[]) {
    productMap.set(String(row.id), row);
  }

  const issues: StockIssue[] = [];
  for (const item of items) {
    const product = productMap.get(String(item.product_id));
    if (!product || !product.active) {
      issues.push({
        product_id: item.product_id,
        name: product?.name ?? "Unknown item",
        requested: item.quantity,
        available: 0,
      });
      continue;
    }
    const available = product.stock ?? 0;
    if (available < item.quantity) {
      issues.push({
        product_id: item.product_id,
        name: product.name,
        requested: item.quantity,
        available,
      });
    }
  }

  if (issues.length > 0) {
    return NextResponse.json<CreateOrderError>(
      { success: false, error: "Some items are no longer available in the requested quantity.", issues },
      { status: 409 },
    );
  }

  // Reserve stock first so a failed order never oversells.
  const applied: { productId: string | number; quantity: number }[] = [];
  for (const item of items) {
    const ok = await decrementStock(supabase, item.product_id, item.quantity);
    if (!ok) {
      await restoreStock(supabase, applied);
      const product = productMap.get(String(item.product_id));
      return NextResponse.json<CreateOrderError>(
        {
          success: false,
          error: "Some items sold out while you were checking out.",
          issues: [
            {
              product_id: item.product_id,
              name: product?.name ?? "Unknown item",
              requested: item.quantity,
              available: product?.stock ?? 0,
            },
          ],
        },
        { status: 409 },
      );
    }
    applied.push({ productId: item.product_id, quantity: item.quantity });
  }

  const total = items.reduce((sum, item) => {
    const product = productMap.get(String(item.product_id));
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);

  const baseOrder = {
    customer_name: name,
    wechat_name: wechatName,
    phone,
  };

  let { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({ ...baseOrder, notes })
    .select("id")
    .single();

  // Gracefully degrade if the optional `notes` column has not been added yet.
  if (orderError && isMissingColumnError(orderError, "notes")) {
    ({ data: orderRow, error: orderError } = await supabase
      .from("orders")
      .insert(baseOrder)
      .select("id")
      .single());
  }

  if (orderError || !orderRow) {
    await restoreStock(supabase, applied);
    return NextResponse.json<CreateOrderError>(
      { success: false, error: "Could not create your order. Please try again." },
      { status: 500 },
    );
  }

  const orderId = orderRow.id as string | number;
  const orderItemsPayload = items.map((item) => {
    const product = productMap.get(String(item.product_id))!;
    return {
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      price: product.price ?? 0,
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", orderId);
    await restoreStock(supabase, applied);
    return NextResponse.json<CreateOrderError>(
      { success: false, error: "Could not save your order items. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, order_id: orderId, total });
}
