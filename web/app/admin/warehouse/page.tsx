"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { WarehouseDashboardStats } from "@/types/warehouse-ops";
import { StatusPill } from "@/components/warehouse/WarehouseUI";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-sand/60">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl text-espresso">{value}</p>
    </div>
  );
}

export default function WarehouseDashboardPage() {
  const [stats, setStats] = useState<WarehouseDashboardStats | null>(null);
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/warehouse/dashboard")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setStats(res.stats);
          setOrders(res.orders ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-48 animate-pulse rounded-2xl bg-white/70" />;

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Waiting" value={stats.orders_waiting} />
          <Stat label="Picking" value={stats.picking} />
          <Stat label="Packing" value={stats.packing} />
          <Stat label="Ready" value={stats.ready_to_ship} />
          <Stat label="Done Today" value={stats.completed_today} />
          <Stat label="Backorders" value={stats.backorders} />
        </div>
      )}

      {stats?.performance && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-sand/60">
          <h2 className="text-sm font-semibold text-espresso">Performance</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-muted">Avg pick</dt><dd className="font-semibold">{stats.performance.avg_pick_time_minutes ?? "—"} min</dd></div>
            <div><dt className="text-muted">Avg pack</dt><dd className="font-semibold">{stats.performance.avg_pack_time_minutes ?? "—"} min</dd></div>
            <div><dt className="text-muted">Pick accuracy</dt><dd className="font-semibold">{stats.performance.picking_accuracy_pct}%</dd></div>
            <div><dt className="text-muted">Pack accuracy</dt><dd className="font-semibold">{stats.performance.packing_accuracy_pct}%</dd></div>
          </dl>
        </div>
      )}

      {stats?.recent_activity && stats.recent_activity.length > 0 && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-sand/60">
          <h2 className="text-sm font-semibold text-espresso">Recent Activity</h2>
          <ul className="mt-3 space-y-2">
            {stats.recent_activity.slice(0, 8).map((e) => (
              <li key={e.id} className="text-sm text-muted">
                <span className="font-medium text-espresso">{e.event_type.replace(/_/g, " ")}</span>
                {e.order_number ? ` · ${e.order_number}` : ""}
                <span className="block text-xs">{new Date(e.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-serif text-lg text-espresso">Orders to Fulfil</h2>
        <ul className="space-y-3">
          {orders.map((o) => {
            const status = (o.warehouse_status as string) ?? "pending";
            const nextAction =
              status === "pending" || status === "picking"
                ? "picking"
                : status === "picked" || status === "packing"
                  ? "packing"
                  : "dispatch";

            return (
              <li key={String(o.id)} className="rounded-2xl bg-white p-4 ring-1 ring-sand/60">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-lg">{o.order_number as string}</span>
                  <StatusPill status={status} />
                </div>
                <p className="mt-1 text-sm text-muted">{o.customer_name as string}</p>
                <div className="mt-3 flex gap-2">
                  {(status === "pending" || status === "picking") && (
                    <Link
                      href={`/admin/warehouse/picking/${o.id}`}
                      className="flex-1 rounded-xl bg-cocoa py-3 text-center text-sm font-bold text-cream"
                    >
                      Pick
                    </Link>
                  )}
                  {(status === "picked" || status === "packing" || status === "packed") && (
                    <Link
                      href={`/admin/warehouse/packing/${o.id}`}
                      className="flex-1 rounded-xl bg-cocoa py-3 text-center text-sm font-bold text-cream"
                    >
                      Pack
                    </Link>
                  )}
                  {status === "ready_to_ship" && (
                    <Link
                      href={`/admin/warehouse/dispatch/${o.id}`}
                      className="flex-1 rounded-xl bg-green-700 py-3 text-center text-sm font-bold text-white"
                    >
                      Dispatch
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
          {orders.length === 0 && (
            <li className="py-8 text-center text-muted">No orders awaiting fulfilment.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
