import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PickList, PickLine } from "@/types/warehouse-ops";
import { logWarehouseEvent, updateOrderWarehouseStatus } from "./dashboard";

async function allocatePickListNumber(supabase: SupabaseClient): Promise<string> {
  const { count } = await supabase
    .from("warehouse_pick_lists")
    .select("id", { count: "exact", head: true });
  return `PICK-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

/** Find best stock location for a product (highest available). */
async function findProductLocation(
  supabase: SupabaseClient,
  productId: string | number,
): Promise<{ location_id: string; location_code: string } | null> {
  const { data } = await supabase
    .from("inventory_balances")
    .select("location_id, available, warehouse_locations ( code )")
    .eq("product_id", productId)
    .gt("available", 0)
    .order("available", { ascending: false })
    .limit(1);

  const row = data?.[0];
  if (!row) return { location_id: "", location_code: "UNASSIGNED" };

  const locations = (row as { warehouse_locations?: { code: string } | { code: string }[] | null })
    .warehouse_locations;
  const locationCode = Array.isArray(locations) ? locations[0]?.code : locations?.code;

  return {
    location_id: row.location_id as string,
    location_code: locationCode ?? "UNKNOWN",
  };
}

export async function generatePickList(
  supabase: SupabaseClient,
  orderId: string | number,
): Promise<{ pickList: PickList | null; error: string | null }> {
  const { data: existing } = await supabase
    .from("warehouse_pick_lists")
    .select("id")
    .eq("order_id", orderId)
    .not("status", "eq", "cancelled")
    .limit(1);

  if (existing?.length) {
    return getPickList(supabase, existing[0].id as string);
  }

  const { order, error: orderErr } = await import("@/lib/orders").then((m) =>
    m.getOrderById(supabase, String(orderId)),
  );

  if (orderErr || !order) return { pickList: null, error: orderErr ?? "Order not found." };

  const pickListNumber = await allocatePickListNumber(supabase);

  const { data: pickList, error: plErr } = await supabase
    .from("warehouse_pick_lists")
    .insert({ pick_list_number: pickListNumber, order_id: orderId })
    .select()
    .single();

  if (plErr || !pickList) return { pickList: null, error: plErr?.message ?? "Failed to create pick list." };

  const lineInputs: {
    product_id: string | number;
    location_id: string;
    location_code: string;
    sku: string | null;
    product_name: string;
    quantity_required: number;
    order_item_id: string | number;
  }[] = [];

  for (const item of order.items) {
    const loc = await findProductLocation(supabase, item.product_id);
    lineInputs.push({
      product_id: item.product_id,
      location_id: loc?.location_id ?? "",
      location_code: loc?.location_code ?? "UNASSIGNED",
      sku: item.product_sku,
      product_name: item.product_name,
      quantity_required: item.quantity,
      order_item_id: item.id,
    });
  }

  // Sort by location code to minimise walking distance
  lineInputs.sort((a, b) => a.location_code.localeCompare(b.location_code));

  const lines = lineInputs.map((l) => ({
    pick_list_id: pickList.id,
    order_item_id: l.order_item_id,
    product_id: l.product_id,
    location_id: l.location_id || null,
    location_code: l.location_code,
    sku: l.sku,
    product_name: l.product_name,
    quantity_required: l.quantity_required,
  }));

  await supabase.from("warehouse_pick_lines").insert(lines);

  await logWarehouseEvent(supabase, {
    event_type: "pick_list_generated",
    order_id: orderId,
    metadata: { pick_list_number: pickListNumber },
  });

  return getPickList(supabase, pickList.id as string);
}

export async function getPickList(
  supabase: SupabaseClient,
  pickListId: string,
): Promise<{ pickList: PickList | null; error: string | null }> {
  const { data, error } = await supabase
    .from("warehouse_pick_lists")
    .select(`*, orders ( order_number, customer_name ), warehouse_pick_lines ( * )`)
    .eq("id", pickListId)
    .single();

  if (error) return { pickList: null, error: error.message };

  const lines = ((data as { warehouse_pick_lines?: PickLine[] }).warehouse_pick_lines ?? [])
    .sort((a, b) => a.location_code.localeCompare(b.location_code));

  return {
    pickList: {
      id: data.id,
      pick_list_number: data.pick_list_number,
      order_id: data.order_id,
      status: data.status,
      picked_by: data.picked_by,
      started_at: data.started_at,
      completed_at: data.completed_at,
      notes: data.notes,
      created_at: data.created_at,
      order_number: (data as { orders?: { order_number: string } }).orders?.order_number,
      customer_name: (data as { orders?: { customer_name: string } }).orders?.customer_name,
      lines,
    },
    error: null,
  };
}

export async function startPicking(
  supabase: SupabaseClient,
  pickListId: string,
  pickedBy?: string,
): Promise<{ error: string | null }> {
  const { data: pl } = await supabase
    .from("warehouse_pick_lists")
    .select("order_id")
    .eq("id", pickListId)
    .single();

  if (!pl) return { error: "Pick list not found." };

  await supabase
    .from("warehouse_pick_lists")
    .update({ status: "in_progress", picked_by: pickedBy ?? "operator", started_at: new Date().toISOString() })
    .eq("id", pickListId);

  await updateOrderWarehouseStatus(supabase, pl.order_id as string | number, "picking", {
    pick_started_at: new Date().toISOString(),
  });

  await logWarehouseEvent(supabase, {
    event_type: "pick_started",
    order_id: pl.order_id as string | number,
    user_name: pickedBy,
  });

  return { error: null };
}

export async function confirmPickLine(
  supabase: SupabaseClient,
  lineId: string,
  input: {
    quantity_picked: number;
    issue_type?: "short" | "damaged" | "missing";
    issue_notes?: string;
    picked_by?: string;
  },
): Promise<{ error: string | null }> {
  const { data: line } = await supabase
    .from("warehouse_pick_lines")
    .select("*, warehouse_pick_lists ( id, order_id, started_at )")
    .eq("id", lineId)
    .single();

  if (!line) return { error: "Pick line not found." };

  const required = line.quantity_required as number;
  const picked = input.quantity_picked;
  let status = "picked";
  if (picked < required) status = input.issue_type ?? "short";
  if (picked === 0 && input.issue_type === "missing") status = "missing";
  if (input.issue_type === "damaged") status = "damaged";

  await supabase
    .from("warehouse_pick_lines")
    .update({
      quantity_picked: picked,
      status,
      issue_type: input.issue_type ?? null,
      issue_notes: input.issue_notes ?? null,
    })
    .eq("id", lineId);

  if (input.issue_type) {
    await logWarehouseEvent(supabase, {
      event_type: `${input.issue_type}_pick`,
      order_id: (line as { warehouse_pick_lists?: { order_id: number } }).warehouse_pick_lists?.order_id,
      user_name: input.picked_by,
      metadata: { line_id: lineId, required, picked },
    });
  }

  return { error: null };
}

export async function completePicking(
  supabase: SupabaseClient,
  pickListId: string,
  pickedBy?: string,
): Promise<{ error: string | null }> {
  const { pickList } = await getPickList(supabase, pickListId);
  if (!pickList) return { error: "Pick list not found." };

  const started = pickList.started_at ? new Date(pickList.started_at).getTime() : Date.now();
  const duration = Math.round((Date.now() - started) / 1000);

  await supabase
    .from("warehouse_pick_lists")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", pickListId);

  await updateOrderWarehouseStatus(supabase, pickList.order_id, "picked", {
    pick_completed_at: new Date().toISOString(),
  });

  await logWarehouseEvent(supabase, {
    event_type: "pick_completed",
    order_id: pickList.order_id,
    user_name: pickedBy,
    duration_seconds: duration,
  });

  return { error: null };
}

export async function getPickListByOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ pickList: PickList | null; error: string | null }> {
  const { data } = await supabase
    .from("warehouse_pick_lists")
    .select("id")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return { pickList: null, error: null };
  return getPickList(supabase, data.id as string);
}
