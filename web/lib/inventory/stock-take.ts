import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStockMovement } from "./movements";
import type { StockTakeSession } from "@/types/warehouse";

async function allocateSessionNumber(supabase: SupabaseClient): Promise<string> {
  const { count } = await supabase
    .from("stock_take_sessions")
    .select("id", { count: "exact", head: true });
  return `STC-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

export async function startStockTake(
  supabase: SupabaseClient,
  warehouseId: string,
  startedBy?: string,
): Promise<{ session: StockTakeSession | null; error: string | null }> {
  const sessionNumber = await allocateSessionNumber(supabase);

  const { data, error } = await supabase
    .from("stock_take_sessions")
    .insert({
      session_number: sessionNumber,
      warehouse_id: warehouseId,
      started_by: startedBy ?? "system",
    })
    .select()
    .single();

  if (error) return { session: null, error: error.message };

  return {
    session: {
      id: data.id,
      session_number: data.session_number,
      warehouse_id: data.warehouse_id,
      status: data.status,
      started_at: data.started_at,
      completed_at: data.completed_at,
      started_by: data.started_by,
    },
    error: null,
  };
}

export async function addStockTakeLine(
  supabase: SupabaseClient,
  sessionId: string,
  input: {
    product_id: string | number;
    location_id: string;
    counted_quantity: number;
  },
): Promise<{ lineId: string | null; variance: number; error: string | null }> {
  const { data: balance } = await supabase
    .from("inventory_balances")
    .select("available")
    .eq("product_id", input.product_id)
    .eq("location_id", input.location_id)
    .single();

  const systemQty = (balance?.available as number) ?? 0;
  const variance = input.counted_quantity - systemQty;

  const { data, error } = await supabase
    .from("stock_take_lines")
    .insert({
      session_id: sessionId,
      product_id: input.product_id,
      location_id: input.location_id,
      system_quantity: systemQty,
      counted_quantity: input.counted_quantity,
      variance,
    })
    .select("id")
    .single();

  if (error) return { lineId: null, variance: 0, error: error.message };
  return { lineId: data.id as string, variance, error: null };
}

export async function approveStockTake(
  supabase: SupabaseClient,
  sessionId: string,
  approvedBy?: string,
): Promise<{ error: string | null }> {
  const { data: session } = await supabase
    .from("stock_take_sessions")
    .select("session_number, warehouse_id")
    .eq("id", sessionId)
    .single();

  if (!session) return { error: "Session not found." };

  const { data: lines } = await supabase
    .from("stock_take_lines")
    .select("*")
    .eq("session_id", sessionId)
    .eq("approved", false);

  for (const line of lines ?? []) {
    const variance = (line.variance as number) ?? 0;
    if (variance === 0) {
      await supabase.from("stock_take_lines").update({ approved: true }).eq("id", line.id);
      continue;
    }

    const { error: movError } = await createStockMovement(supabase, {
      movement_type: "stock_take",
      product_id: line.product_id as string | number,
      quantity: variance,
      warehouse_id: session.warehouse_id as string,
      location_id: line.location_id as string,
      reference_type: "stock_take",
      reference_id: session.session_number as string,
      reason: `Stock take adjustment (variance ${variance > 0 ? "+" : ""}${variance})`,
      user_name: approvedBy,
      bucket: "available",
    });

    if (movError) return { error: movError };

    await supabase.from("stock_take_lines").update({ approved: true }).eq("id", line.id);
  }

  await supabase
    .from("stock_take_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);

  return { error: null };
}

export async function getStockTakeSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ session: StockTakeSession | null; error: string | null }> {
  const { data, error } = await supabase
    .from("stock_take_sessions")
    .select(
      `*, warehouses ( code, name ), stock_take_lines ( *, products ( sku, name, barcode ), warehouse_locations ( code, name ) )`,
    )
    .eq("id", sessionId)
    .single();

  if (error) return { session: null, error: error.message };

  return {
    session: {
      id: data.id,
      session_number: data.session_number,
      warehouse_id: data.warehouse_id,
      status: data.status,
      started_at: data.started_at,
      completed_at: data.completed_at,
      started_by: data.started_by,
      warehouse: (data as { warehouses?: { code: string; name: string } }).warehouses,
      lines: (
        (data as { stock_take_lines?: Record<string, unknown>[] }).stock_take_lines ?? []
      ).map((line) => ({
        id: line.id as string,
        session_id: line.session_id as string,
        product_id: line.product_id as string | number,
        location_id: line.location_id as string,
        system_quantity: line.system_quantity as number,
        counted_quantity: line.counted_quantity as number | null,
        variance: line.variance as number | null,
        approved: line.approved as boolean,
        created_at: line.created_at as string,
        product: (line as { products?: { sku: string | null; name: string; barcode: string | null } })
          .products,
        location: (line as { warehouse_locations?: { code: string; name: string } })
          .warehouse_locations,
      })),
    },
    error: null,
  };
}
