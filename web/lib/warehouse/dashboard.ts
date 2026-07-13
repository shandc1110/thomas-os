import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WarehouseDashboardStats,
  WarehouseEvent,
  WarehouseOrderStatus,
  WarehousePerformance,
} from "@/types/warehouse-ops";

export async function logWarehouseEvent(
  supabase: SupabaseClient,
  event: {
    event_type: string;
    order_id?: string | number;
    user_name?: string;
    duration_seconds?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from("warehouse_events").insert({
    event_type: event.event_type,
    order_id: event.order_id ?? null,
    user_name: event.user_name ?? "system",
    duration_seconds: event.duration_seconds ?? null,
    metadata: event.metadata ?? {},
  });
}

export async function updateOrderWarehouseStatus(
  supabase: SupabaseClient,
  orderId: string | number,
  status: WarehouseOrderStatus,
  extra?: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("orders")
    .update({ warehouse_status: status, ...extra })
    .eq("id", orderId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function getWarehouseDashboard(
  supabase: SupabaseClient,
): Promise<{ stats: WarehouseDashboardStats | null; error: string | null }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: orders, error: ordErr } = await supabase
    .from("orders")
    .select("id, warehouse_status, created_at, shipped_at");

  if (ordErr) return { stats: null, error: ordErr.message };

  const orderList = orders ?? [];
  const count = (status: string) =>
    orderList.filter((o) => (o.warehouse_status as string) === status).length;

  const completed_today = orderList.filter((o) => {
    const shipped = o.shipped_at as string | null;
    return shipped && new Date(shipped) >= today;
  }).length;

  const { data: events } = await supabase
    .from("warehouse_events")
    .select("*, orders ( order_number )")
    .order("created_at", { ascending: false })
    .limit(15);

  const performance = await computePerformance(supabase);

  return {
    stats: {
      orders_waiting: count("pending"),
      picking: count("picking"),
      packing: count("packing") + count("packed") + count("awaiting_label"),
      ready_to_ship: count("ready_to_ship"),
      completed_today,
      backorders: 0,
      recent_activity: (events ?? []).map((e) => ({
        id: e.id as string,
        event_type: e.event_type as string,
        order_id: e.order_id as string | number | null,
        user_name: e.user_name as string | null,
        duration_seconds: e.duration_seconds as number | null,
        metadata: (e.metadata as Record<string, unknown>) ?? {},
        created_at: e.created_at as string,
        order_number: (e as { orders?: { order_number: string } }).orders?.order_number ?? null,
      })),
      performance,
    },
    error: null,
  };
}

async function computePerformance(
  supabase: SupabaseClient,
): Promise<WarehousePerformance> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: events } = await supabase
    .from("warehouse_events")
    .select("event_type, duration_seconds")
    .gte("created_at", since.toISOString());

  const list = events ?? [];
  const pickTimes = list
    .filter((e) => e.event_type === "pick_completed" && e.duration_seconds)
    .map((e) => e.duration_seconds as number);
  const packTimes = list
    .filter((e) => e.event_type === "pack_completed" && e.duration_seconds)
    .map((e) => e.duration_seconds as number);

  const shipped = list.filter((e) => e.event_type === "shipped").length;
  const hours = 30 * 24;

  const pickIssues = list.filter((e) =>
    ["short_pick", "damaged_pick", "missing_pick"].includes(e.event_type as string),
  ).length;
  const packMismatches = list.filter((e) => e.event_type === "pack_mismatch").length;
  const totalPicks = list.filter((e) => e.event_type === "pick_completed").length || 1;
  const totalPacks = list.filter((e) => e.event_type === "pack_completed").length || 1;

  return {
    avg_pick_time_minutes: pickTimes.length
      ? Math.round((pickTimes.reduce((a, b) => a + b, 0) / pickTimes.length / 60) * 10) / 10
      : null,
    avg_pack_time_minutes: packTimes.length
      ? Math.round((packTimes.reduce((a, b) => a + b, 0) / packTimes.length / 60) * 10) / 10
      : null,
    orders_per_hour: shipped > 0 ? Math.round((shipped / hours) * 100) / 100 : null,
    picking_accuracy_pct: Math.round(((totalPicks - pickIssues) / totalPicks) * 1000) / 10,
    packing_accuracy_pct: Math.round(((totalPacks - packMismatches) / totalPacks) * 1000) / 10,
    inventory_errors: pickIssues + packMismatches,
  };
}

export async function listWarehouseOrders(
  supabase: SupabaseClient,
  status?: WarehouseOrderStatus,
): Promise<{ orders: Record<string, unknown>[]; error: string | null }> {
  let query = supabase
    .from("orders")
    .select("id, order_number, customer_name, warehouse_status, created_at, total_weight_grams")
    .order("created_at", { ascending: true });

  if (status) query = query.eq("warehouse_status", status);
  else query = query.not("warehouse_status", "in", '("shipped","delivered","cancelled")');

  const { data, error } = await query.limit(50);
  if (error) return { orders: [], error: error.message };
  return { orders: data ?? [], error: null };
}
