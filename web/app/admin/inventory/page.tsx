"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatOrderPrice } from "@/lib/format";
import { MOVEMENT_TYPE_LABELS } from "@/types/movement";
import type { InventoryDashboardStats, InventoryAlert } from "@/types/inventory";
import type { MovementType } from "@/types/movement";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-sand/60">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 font-serif text-2xl text-espresso">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default function InventoryDashboardPage() {
  const [stats, setStats] = useState<InventoryDashboardStats | null>(null);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/inventory/dashboard")
      .then((r) => r.json())
      .then((result) => {
        if (!result.success) {
          setError(result.error ?? "Failed to load dashboard.");
          return;
        }
        setStats(result.stats);
        setAlerts(result.alerts ?? []);
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-white/70 ring-1 ring-sand/50" />;
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
        {error ?? "Dashboard unavailable. Have you run migration 0006?"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <h2 className="text-sm font-semibold text-amber-900">Alerts ({alerts.length})</h2>
          <ul className="mt-2 space-y-1">
            {alerts.slice(0, 5).map((a) => (
              <li key={a.id} className="text-sm text-amber-800">
                {a.severity === "critical" ? "🔴" : "🟡"} {a.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Products" value={stats.total_products} />
        <StatCard label="Total SKUs" value={stats.total_skus} />
        <StatCard label="Inventory Value" value={formatOrderPrice(stats.inventory_value, "CNY")} />
        <StatCard label="Available Units" value={stats.available_units} />
        <StatCard label="Incoming" value={stats.incoming_units} />
        <StatCard label="Allocated" value={stats.allocated_units} />
        <StatCard label="Low Stock" value={stats.low_stock_count} sub="At or below threshold" />
        <StatCard label="Out of Stock" value={stats.out_of_stock_count} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
          <h2 className="font-serif text-lg text-espresso">Inventory by Brand</h2>
          <ul className="mt-4 space-y-2">
            {stats.by_brand.slice(0, 8).map((b) => (
              <li key={b.brand} className="flex justify-between text-sm">
                <span className="text-espresso">{b.brand}</span>
                <span className="text-muted">
                  {b.units} units · {formatOrderPrice(b.value, "CNY")}
                </span>
              </li>
            ))}
            {stats.by_brand.length === 0 && (
              <li className="text-sm text-muted">No brand data yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
          <h2 className="font-serif text-lg text-espresso">Recent Movements</h2>
          <ul className="mt-4 space-y-2">
            {stats.recent_movements.map((m) => (
              <li key={m.id} className="text-sm">
                <span className="font-medium text-espresso">
                  {MOVEMENT_TYPE_LABELS[m.movement_type as MovementType] ?? m.movement_type}
                </span>
                <span className="text-muted">
                  {" "}
                  · {m.sku} · {m.quantity > 0 ? "+" : ""}
                  {m.quantity}
                </span>
              </li>
            ))}
            {stats.recent_movements.length === 0 && (
              <li className="text-sm text-muted">No movements yet.</li>
            )}
          </ul>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/inventory/products"
          className="rounded-full bg-cocoa px-5 py-2.5 text-sm font-semibold text-cream"
        >
          Manage Products
        </Link>
        <Link
          href="/admin/inventory/receive"
          className="rounded-full bg-linen px-5 py-2.5 text-sm font-semibold text-espresso ring-1 ring-sand"
        >
          Receive Goods
        </Link>
        <Link
          href="/admin/inventory/stock-take"
          className="rounded-full bg-linen px-5 py-2.5 text-sm font-semibold text-espresso ring-1 ring-sand"
        >
          Stock Take
        </Link>
      </div>
    </div>
  );
}
