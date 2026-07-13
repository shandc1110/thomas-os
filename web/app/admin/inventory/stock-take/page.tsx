"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Warehouse } from "@/types/warehouse";
import type { StockTakeSession } from "@/types/warehouse";

export default function StockTakePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sessions, setSessions] = useState<StockTakeSession[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/inventory/warehouses").then((r) => r.json()),
      fetch("/api/inventory/stock-take").then((r) => r.json()),
    ]).then(([wh, st]) => {
      if (wh.success) {
        setWarehouses(wh.warehouses ?? []);
        const defaultWh = wh.warehouses?.find((w: Warehouse) => w.is_default);
        if (defaultWh) setWarehouseId(defaultWh.id);
      }
      if (st.success) setSessions(st.sessions ?? []);
    }).finally(() => setLoading(false));
  }, []);

  async function startSession() {
    const response = await fetch("/api/inventory/stock-take", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warehouse_id: warehouseId }),
    });
    const result = await response.json();
    if (result.success) {
      window.location.href = `/admin/inventory/stock-take/${result.session.id}`;
    }
  }

  if (loading) return <div className="h-48 animate-pulse rounded-2xl bg-white/70" />;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
        <h2 className="font-serif text-xl text-espresso">Start Stock Count</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="rounded-2xl border border-sand px-4 py-2.5 text-sm"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={startSession}
            className="rounded-full bg-cocoa px-5 py-2.5 text-sm font-semibold text-cream"
          >
            Start Stock Take
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
        <h3 className="font-serif text-lg text-espresso">Recent Sessions</h3>
        <ul className="mt-4 divide-y divide-sand/60">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-espresso">{s.session_number}</p>
                <p className="text-xs text-muted">
                  {(s as { warehouses?: { name: string } }).warehouses?.name} · {s.status}
                </p>
              </div>
              <Link
                href={`/admin/inventory/stock-take/${s.id}`}
                className="text-sm text-clay hover:text-cocoa"
              >
                Open &rarr;
              </Link>
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="py-4 text-sm text-muted">No stock take sessions yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
