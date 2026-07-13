import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PackSession } from "@/types/warehouse-ops";
import { logWarehouseEvent, updateOrderWarehouseStatus } from "./dashboard";

export async function startPacking(
  supabase: SupabaseClient,
  orderId: string | number,
  packedBy?: string,
): Promise<{ session: PackSession | null; error: string | null }> {
  const { data: existing } = await supabase
    .from("warehouse_pack_sessions")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "in_progress")
    .limit(1);

  if (existing?.length) {
    return getPackSession(supabase, existing[0].id as string);
  }

  const { order } = await import("@/lib/orders").then((m) =>
    m.getOrderById(supabase, String(orderId)),
  );

  if (!order) return { session: null, error: "Order not found." };

  const { data: session, error } = await supabase
    .from("warehouse_pack_sessions")
    .insert({ order_id: orderId, packed_by: packedBy ?? "operator" })
    .select()
    .single();

  if (error || !session) return { session: null, error: error?.message ?? "Failed to start packing." };

  const verifications = order.items.map((item) => ({
    pack_session_id: session.id,
    product_id: item.product_id,
    sku: item.product_sku,
    expected_quantity: item.quantity,
  }));

  await supabase.from("warehouse_pack_verifications").insert(verifications);

  await updateOrderWarehouseStatus(supabase, orderId, "packing", {
    pack_started_at: new Date().toISOString(),
  });

  await logWarehouseEvent(supabase, {
    event_type: "pack_started",
    order_id: orderId,
    user_name: packedBy,
  });

  return getPackSession(supabase, session.id as string);
}

export async function getPackSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ session: PackSession | null; error: string | null }> {
  const { data, error } = await supabase
    .from("warehouse_pack_sessions")
    .select(
      `*, orders ( order_number ), warehouse_pack_verifications ( *, products ( name ) )`,
    )
    .eq("id", sessionId)
    .single();

  if (error) return { session: null, error: error.message };

  return {
    session: {
      id: data.id,
      order_id: data.order_id,
      status: data.status,
      packed_by: data.packed_by,
      packing_slip_printed: data.packing_slip_printed,
      label_printed: data.label_printed,
      started_at: data.started_at,
      completed_at: data.completed_at,
      order_number: (data as { orders?: { order_number: string } }).orders?.order_number,
      verifications: (
        (data as { warehouse_pack_verifications?: Record<string, unknown>[] })
          .warehouse_pack_verifications ?? []
      ).map((v) => ({
        id: v.id as string,
        pack_session_id: v.pack_session_id as string,
        product_id: v.product_id as string | number,
        sku: v.sku as string | null,
        expected_quantity: v.expected_quantity as number,
        verified_quantity: v.verified_quantity as number,
        status: v.status as "pending" | "ok" | "mismatch",
        verified_at: v.verified_at as string | null,
        product_name: (v as { products?: { name: string } }).products?.name,
      })),
    },
    error: null,
  };
}

export async function verifyPackItem(
  supabase: SupabaseClient,
  sessionId: string,
  input: { sku_or_barcode: string; quantity?: number },
): Promise<{
  match: boolean;
  verification_id?: string;
  product_name?: string;
  error: string | null;
}> {
  const code = input.sku_or_barcode.trim();

  const { data: verifications } = await supabase
    .from("warehouse_pack_verifications")
    .select("*, products ( name, barcode, sku )")
    .eq("pack_session_id", sessionId);

  const match = (verifications ?? []).find((v) => {
    const p = (v as { products?: { sku: string; barcode: string } }).products;
    return v.sku === code || p?.sku === code || p?.barcode === code;
  });

  if (!match) {
    const { data: session } = await supabase
      .from("warehouse_pack_sessions")
      .select("order_id")
      .eq("id", sessionId)
      .single();

    await logWarehouseEvent(supabase, {
      event_type: "pack_mismatch",
      order_id: session?.order_id as number,
      metadata: { scanned: code },
    });

    return { match: false, error: null };
  }

  const qty = input.quantity ?? 1;
  const newVerified = ((match.verified_quantity as number) ?? 0) + qty;
  const expected = match.expected_quantity as number;
  const status = newVerified >= expected ? "ok" : "pending";

  await supabase
    .from("warehouse_pack_verifications")
    .update({
      verified_quantity: newVerified,
      status: newVerified > expected ? "mismatch" : status,
      verified_at: new Date().toISOString(),
    })
    .eq("id", match.id);

  if (newVerified > expected) {
    await logWarehouseEvent(supabase, {
      event_type: "pack_mismatch",
      metadata: { verification_id: match.id, expected, verified: newVerified },
    });
  }

  return {
    match: true,
    verification_id: match.id as string,
    product_name: (match as { products?: { name: string } }).products?.name,
    error: null,
  };
}

export async function markPackingSlipPrinted(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<void> {
  await supabase
    .from("warehouse_pack_sessions")
    .update({ packing_slip_printed: true })
    .eq("id", sessionId);
}

export async function markLabelPrinted(
  supabase: SupabaseClient,
  sessionId: string,
  orderId: string | number,
): Promise<void> {
  await supabase
    .from("warehouse_pack_sessions")
    .update({ label_printed: true })
    .eq("id", sessionId);

  await updateOrderWarehouseStatus(supabase, orderId, "awaiting_label");
}

export async function completePacking(
  supabase: SupabaseClient,
  sessionId: string,
  packedBy?: string,
): Promise<{ error: string | null }> {
  const { session } = await getPackSession(supabase, sessionId);
  if (!session) return { error: "Session not found." };

  const allOk = (session.verifications ?? []).every((v) => v.status === "ok");
  if (!allOk) {
    return { error: "Not all items verified. Scan every item before completing." };
  }

  const started = new Date(session.started_at).getTime();
  const duration = Math.round((Date.now() - started) / 1000);

  await supabase
    .from("warehouse_pack_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);

  const newStatus = session.label_printed ? "ready_to_ship" : "packed";
  await updateOrderWarehouseStatus(supabase, session.order_id, newStatus, {
    pack_completed_at: new Date().toISOString(),
  });

  await logWarehouseEvent(supabase, {
    event_type: "pack_completed",
    order_id: session.order_id,
    user_name: packedBy,
    duration_seconds: duration,
  });

  return { error: null };
}

export async function dispatchOrder(
  supabase: SupabaseClient,
  orderId: string | number,
  trackingNumber?: string,
  userName?: string,
): Promise<{ error: string | null }> {
  await updateOrderWarehouseStatus(supabase, orderId, "shipped", {
    shipped_at: new Date().toISOString(),
    tracking_number: trackingNumber ?? null,
    fulfilment_status: "fulfilled",
  });

  await logWarehouseEvent(supabase, {
    event_type: "shipped",
    order_id: orderId,
    user_name: userName,
    metadata: { tracking_number: trackingNumber },
  });

  return { error: null };
}

export async function getPackSessionByOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ session: PackSession | null; error: string | null }> {
  const { data } = await supabase
    .from("warehouse_pack_sessions")
    .select("id")
    .eq("order_id", orderId)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return { session: null, error: null };
  return getPackSession(supabase, data.id as string);
}
