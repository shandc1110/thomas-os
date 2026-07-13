"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatOrderPrice } from "@/lib/format";
import type { ProcurementDashboardStats } from "@/types/supplier";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-sand/60">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 font-serif text-2xl text-espresso">{value}</p>
    </div>
  );
}

export default function PurchasingDashboardPage() {
  const [stats, setStats] = useState<ProcurementDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/purchasing?resource=dashboard")
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) {
          setError(res.error ?? "Failed to load dashboard.");
          return;
        }
        setStats(res.stats);
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-white/70 ring-1 ring-sand/50" />;

  if (error || !stats) {
    return (
      <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
        {error ?? "Dashboard unavailable. Have you run migration 0008?"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Open POs" value={stats.open_purchase_orders} />
        <Stat label="Goods In Transit" value={stats.goods_in_transit} />
        <Stat label="Awaiting Payment" value={stats.awaiting_payment} />
        <Stat label="Outstanding Spend" value={formatOrderPrice(stats.outstanding_spend, "CNY")} />
        <Stat label="Inventory Incoming" value={stats.inventory_incoming} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
          <h2 className="font-serif text-lg text-espresso">Spend by Supplier</h2>
          <ul className="mt-4 space-y-2">
            {stats.spend_by_supplier.slice(0, 8).map((s) => (
              <li key={s.supplier} className="flex justify-between text-sm">
                <span>{s.supplier}</span>
                <span className="font-semibold">{formatOrderPrice(s.spend, "CNY")}</span>
              </li>
            ))}
            {stats.spend_by_supplier.length === 0 && (
              <li className="text-sm text-muted">No purchase orders yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
          <h2 className="font-serif text-lg text-espresso">Monthly Purchasing</h2>
          <ul className="mt-4 space-y-2">
            {stats.monthly_purchasing.slice(-6).map((m) => (
              <li key={m.month} className="flex justify-between text-sm">
                <span>{m.month}</span>
                <span className="font-semibold">{formatOrderPrice(m.spend, "CNY")}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/purchasing/purchase-orders" className="rounded-full bg-cocoa px-5 py-2 text-sm font-semibold text-cream">
          View Purchase Orders
        </Link>
        <Link href="/admin/purchasing/suppliers" className="rounded-full bg-linen px-5 py-2 text-sm font-semibold text-espresso ring-1 ring-sand">
          Manage Suppliers
        </Link>
      </div>
    </div>
  );
}
