import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allocateOrderNumber, isOrderNumberConflict } from "@/lib/order-number";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  recordCustomerOrderMovements,
  restoreCustomerOrderMovements,
} from "@/lib/inventory/movements";
import { getDefaultWarehouseLocation } from "@/lib/warehouse/warehouses";
import { computeTotalWeightGrams } from "@/lib/weight";
import { priceForCurrency } from "@/lib/currency";
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
  weight_grams: number | null;
};

const MAX_CAS_ATTEMPTS = 5;

type SupabaseError = { code?: string; message?: string };

/** Given a DB error, return which of the provided columns is missing, if any. */
function findMissingColumn(error: SupabaseError, columns: string[]): string | null {
  // 42703 = undefined_column (Postgres), PGRST204 = column not found (PostgREST schema cache)
  const message = (error.message ?? "").toLowerCase();
  const looksLikeMissingColumn =
    error.code === "42703" || error.code === "PGRST204" || message.includes("column");
  if (!looksLikeMissingColumn) return null;
  for (const column of columns) {
    if (message.includes(`'${column.toLowerCase()}'`)) return column;
  }
  return null;
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

/**
 * Insert an order, degrading gracefully if newer optional columns
 * (email, address, payment_method, currency, notes) do not exist yet in the DB.
 * Any value whose column is missing is preserved by folding it into `notes`
 * (when that column exists), so customer details are never silently lost.
 */
async function insertOrderWithFallback(
  supabase: SupabaseClient,
  fullPayload: Record<string, unknown>,
): Promise<{
  id: string | number | null;
  order_number: string | null;
  error: SupabaseError | null;
}> {
  const payload: Record<string, unknown> = { ...fullPayload };
  const folded: string[] = [];
  const maxAttempts = Object.keys(payload).length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from("orders")
      .insert(payload)
      .select("id, order_number")
      .single();

    if (!error) {
      return {
        id: (data?.id as string | number) ?? null,
        order_number: (data?.order_number as string | null) ?? null,
        error: null,
      };
    }

    const missing = findMissingColumn(error, Object.keys(payload));
    if (!missing) return { id: null, order_number: null, error };

    // Preserve the dropped value by folding it into notes (if notes survives).
    const value = payload[missing];
    if (missing !== "notes" && value != null && value !== "") {
      folded.push(`${missing.replace(/_/g, " ")}: ${value}`);
    }
    delete payload[missing];

    if ("notes" in payload) {
      const original = typeof fullPayload.notes === "string" ? fullPayload.notes : "";
      payload.notes = [original, ...folded].filter(Boolean).join(" | ") || null;
    }
  }

  return {
    id: null,
    order_number: null,
    error: { message: "Order table is missing required columns." },
  };
}

export async function POST(request: Request): Promise<NextResponse<CreateOrderResponse>> {
  let body: CreateOrderRequest;
  try {
    body = (await request.json()) as CreateOrderRequest;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const customer = body?.customer;
  const firstName = customer?.first_name?.trim();
  const lastName = customer?.last_name?.trim();
  const wechatName = customer?.wechat_name?.trim();
  const phone = customer?.phone?.trim();
  const email = customer?.email?.trim();
  const address = customer?.address?.trim();
  const postcode = customer?.postcode?.trim();
  const paymentMethod = customer?.payment_method?.trim();
  const currencyRaw = customer?.currency?.trim().toUpperCase();
  const currency = currencyRaw === "GBP" ? "GBP" : "CNY";
  const notes = customer?.notes?.trim() || null;

  if (!firstName) return badRequest("First name is required.");
  if (!lastName) return badRequest("Last name is required.");
  if (!wechatName) return badRequest("WeChat ID is required.");
  if (!phone) return badRequest("Phone number is required.");
  if (!email) return badRequest("Email address is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Please enter a valid email address.");
  if (!address) return badRequest("Delivery address is required.");
  if (!postcode) return badRequest("Postcode is required.");
  if (!paymentMethod) return badRequest("Please choose a payment method.");

  const customerName = `${firstName} ${lastName}`;

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
    .select("id, name, price, stock, active, weight_grams")
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

  // Allocate order number early so stock movements can reference it.
  const reservedOrderNumber = await allocateOrderNumber(supabase);

  // Reserve stock via immutable ledger movements (falls back if warehouse not configured).
  const warehouseLoc = await getDefaultWarehouseLocation(supabase);
  const applied: { productId: string | number; quantity: number }[] = [];

  if (warehouseLoc) {
    const { error: movError } = await recordCustomerOrderMovements(
      supabase,
      items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
      "pending",
      reservedOrderNumber,
      warehouseLoc.warehouseId,
      warehouseLoc.locationId,
    );
    if (movError) {
      return NextResponse.json<CreateOrderError>(
        {
          success: false,
          error: "Some items sold out while you were checking out.",
          issues: items.map((item) => {
            const product = productMap.get(String(item.product_id));
            return {
              product_id: item.product_id,
              name: product?.name ?? "Unknown item",
              requested: item.quantity,
              available: product?.stock ?? 0,
            };
          }),
        },
        { status: 409 },
      );
    }
    for (const item of items) applied.push({ productId: item.product_id, quantity: item.quantity });
  } else {
    for (const item of items) {
      const ok = await decrementStock(supabase, item.product_id, item.quantity);
      if (!ok) {
        await restoreStock(supabase, applied);
        const product = productMap.get(String(item.product_id));
        return NextResponse.json<CreateOrderError>(
          {
            success: false,
            error: "Some items sold out while you were checking out.",
            issues: [{
              product_id: item.product_id,
              name: product?.name ?? "Unknown item",
              requested: item.quantity,
              available: product?.stock ?? 0,
            }],
          },
          { status: 409 },
        );
      }
      applied.push({ productId: item.product_id, quantity: item.quantity });
    }
  }

  const totalCny = items.reduce((sum, item) => {
    const product = productMap.get(String(item.product_id));
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);
  const total = priceForCurrency(totalCny, currency);

  const totalWeightGrams = computeTotalWeightGrams(
    items.map((item) => {
      const product = productMap.get(String(item.product_id));
      return { weight_grams: product?.weight_grams, quantity: item.quantity };
    }),
  );

  const orderPayload = {
    customer_name: customerName,
    first_name: firstName,
    last_name: lastName,
    wechat_name: wechatName,
    phone,
    email,
    address,
    postcode,
    payment_method: paymentMethod,
    currency,
    notes,
    total_weight_grams: totalWeightGrams,
    fulfilment_status: "pending",
  };

  let orderId: string | number | null = null;
  let orderNumber: string | null = null;
  let orderError: SupabaseError | null = null;

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const candidateNumber = attempt === 0 ? reservedOrderNumber : await allocateOrderNumber(supabase);
    const result = await insertOrderWithFallback(supabase, {
      ...orderPayload,
      order_number: candidateNumber,
    });

    orderId = result.id;
    orderNumber = result.order_number ?? candidateNumber;
    orderError = result.error;

    if (!orderError && orderId != null) break;
    if (orderError && isOrderNumberConflict(orderError)) continue;
    break;
  }

  if (orderError || orderId == null || !orderNumber) {
    if (warehouseLoc) {
      await restoreCustomerOrderMovements(
        supabase,
        applied.map((a) => ({ product_id: a.productId, quantity: a.quantity })),
        reservedOrderNumber,
        warehouseLoc.warehouseId,
        warehouseLoc.locationId,
      );
    } else {
      await restoreStock(supabase, applied);
    }
    return NextResponse.json<CreateOrderError>(
      { success: false, error: "Could not create your order. Please try again." },
      { status: 500 },
    );
  }

  const orderItemsPayload = items.map((item) => {
    const product = productMap.get(String(item.product_id))!;
    const cnyPrice = product.price ?? 0;
    return {
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      price: priceForCurrency(cnyPrice, currency),
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", orderId);
    if (warehouseLoc) {
      await restoreCustomerOrderMovements(
        supabase,
        applied.map((a) => ({ product_id: a.productId, quantity: a.quantity })),
        orderNumber,
        warehouseLoc.warehouseId,
        warehouseLoc.locationId,
      );
    } else {
      await restoreStock(supabase, applied);
    }
    return NextResponse.json<CreateOrderError>(
      { success: false, error: "Could not save your order items. Please try again." },
      { status: 500 },
    );
  }

  const emailSent = await sendOrderConfirmationEmail({
    orderNumber,
    customer: {
      first_name: firstName,
      last_name: lastName,
      wechat_name: wechatName,
      phone,
      email,
      address,
      postcode,
      payment_method: paymentMethod,
      currency,
      notes: notes ?? undefined,
    },
    items: items.map((item) => {
      const product = productMap.get(String(item.product_id))!;
      const cnyPrice = product.price ?? 0;
      return {
        name: product.name,
        quantity: item.quantity,
        price: priceForCurrency(cnyPrice, currency),
      };
    }),
    total,
  });

  return NextResponse.json({
    success: true,
    order_id: orderId,
    order_number: orderNumber,
    total,
    email_sent: emailSent,
  });
}
