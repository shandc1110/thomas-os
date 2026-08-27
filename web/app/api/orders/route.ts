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
import { getSellableStock, getOnHandStock } from "@/lib/presell";
import { unitPriceForOrder } from "@/lib/currency";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";
import { isStripeConfigured } from "@/lib/stripe/client";
import { amountGbpForStripe, createStripeCheckoutSession } from "@/lib/stripe/checkout";
import { isStripePaymentMethod } from "@/lib/stripe/constants";
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
  currency: string | null;
  stock: number | null;
  presell_enabled: boolean | null;
  presell_quantity: number | null;
  expected_arrival_month: string | null;
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
    .select("id, name, price, currency, stock, presell_enabled, presell_quantity, expected_arrival_month, active, weight_grams")
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
    const sellable = getSellableStock(product);
    if (sellable < item.quantity) {
      issues.push({
        product_id: item.product_id,
        name: product.name,
        requested: item.quantity,
        available: sellable,
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

  const warehouseLoc = await getDefaultWarehouseLocation(supabase);
  if (!warehouseLoc) {
    return NextResponse.json<CreateOrderError>(
      {
        success: false,
        error: "Inventory is not configured. Please run migration 0006 and try again later.",
      },
      { status: 503 },
    );
  }

  const applied = items.map((item) => ({ productId: item.product_id, quantity: item.quantity }));

  const { allocations, error: movError } = await recordCustomerOrderMovements(
    supabase,
    items.map((item) => {
      const product = productMap.get(String(item.product_id))!;
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        on_hand: getOnHandStock(product),
      };
    }),
    "pending",
    reservedOrderNumber,
    warehouseLoc.warehouseId,
    warehouseLoc.locationId,
  );

  const allocationMap = new Map(allocations.map((a) => [String(a.product_id), a.presell_quantity]));

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
            available: product ? getSellableStock(product) : 0,
          };
        }),
      },
      { status: 409 },
    );
  }

  const total = items.reduce((sum, item) => {
    const product = productMap.get(String(item.product_id));
    return (
      sum +
      unitPriceForOrder(product?.price ?? 0, product?.currency, currency) * item.quantity
    );
  }, 0);

  const totalWeightGrams = computeTotalWeightGrams(
    items.map((item) => {
      const product = productMap.get(String(item.product_id));
      return { weight_grams: product?.weight_grams, quantity: item.quantity };
    }),
  );

  const tenant = getActiveTenant();
  const hasPresell = allocations.some((a) => a.presell_quantity > 0);
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
    fulfilment_status: hasPresell ? "awaiting_stock" : "pending",
    organization_id: tenant.organizationId,
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
    await restoreCustomerOrderMovements(
      supabase,
      applied.map((a) => ({
        product_id: a.productId,
        quantity: a.quantity,
        presell_quantity: allocationMap.get(String(a.productId)) ?? 0,
      })),
      reservedOrderNumber,
      warehouseLoc.warehouseId,
      warehouseLoc.locationId,
    );
    return NextResponse.json<CreateOrderError>(
      { success: false, error: "Could not create your order. Please try again." },
      { status: 500 },
    );
  }

  const orderItemsPayload = items.map((item) => {
    const product = productMap.get(String(item.product_id))!;
    return {
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      price: unitPriceForOrder(product.price ?? 0, product.currency, currency),
      presell_quantity: allocationMap.get(String(item.product_id)) ?? 0,
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", orderId);
    await restoreCustomerOrderMovements(
      supabase,
      applied.map((a) => ({
        product_id: a.productId,
        quantity: a.quantity,
        presell_quantity: allocationMap.get(String(a.productId)) ?? 0,
      })),
      orderNumber,
      warehouseLoc.warehouseId,
      warehouseLoc.locationId,
    );
    return NextResponse.json<CreateOrderError>(
      { success: false, error: "Could not save your order items. Please try again." },
      { status: 500 },
    );
  }

  const payByStripe = isStripePaymentMethod(paymentMethod);

  if (payByStripe) {
    if (!isStripeConfigured()) {
      await supabase.from("orders").delete().eq("id", orderId);
      await restoreCustomerOrderMovements(
        supabase,
        applied.map((a) => ({
          product_id: a.productId,
          quantity: a.quantity,
          presell_quantity: allocationMap.get(String(a.productId)) ?? 0,
        })),
        orderNumber,
        warehouseLoc.warehouseId,
        warehouseLoc.locationId,
      );
      return NextResponse.json<CreateOrderError>(
        { success: false, error: "Card payments are not available right now. Please choose another method." },
        { status: 503 },
      );
    }

    try {
      const stripeLines = items.map((item) => {
        const product = productMap.get(String(item.product_id))!;
        const unitPrice = unitPriceForOrder(product.price ?? 0, product.currency, currency);
        return {
          name: product.name,
          quantity: item.quantity,
          unitAmountGbp: amountGbpForStripe(unitPrice, currency),
        };
      });

      const { sessionId, url } = await createStripeCheckoutSession({
        orderId,
        orderNumber,
        customerEmail: email,
        portalCurrency: currency,
        lines: stripeLines,
      });

      await supabase
        .from("orders")
        .update({
          payment_status: "pending",
          stripe_checkout_session_id: sessionId,
        })
        .eq("id", orderId);

      return NextResponse.json({
        success: true,
        order_id: orderId,
        order_number: orderNumber,
        total,
        email_sent: false,
        checkout_url: url,
      });
    } catch (stripeError) {
      console.error("Stripe checkout session failed:", stripeError);
      await supabase.from("orders").delete().eq("id", orderId);
      await restoreCustomerOrderMovements(
        supabase,
        applied.map((a) => ({
          product_id: a.productId,
          quantity: a.quantity,
          presell_quantity: allocationMap.get(String(a.productId)) ?? 0,
        })),
        orderNumber,
        warehouseLoc.warehouseId,
        warehouseLoc.locationId,
      );
      return NextResponse.json<CreateOrderError>(
        { success: false, error: "Could not start card payment. Please try again or choose another method." },
        { status: 502 },
      );
    }
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
      return {
        name: product.name,
        quantity: item.quantity,
        price: unitPriceForOrder(product.price ?? 0, product.currency, currency),
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
