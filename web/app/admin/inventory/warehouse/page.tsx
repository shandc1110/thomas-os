"use client";

import { useEffect, useState } from "react";
import type { Warehouse } from "@/types/warehouse";

export default function WarehousePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/inventory/warehouses")
      .then((r) => r.json())
      .then((result) => {
        if (result.success) setWarehouses(result.warehouses ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-48 animate-pulse rounded-2xl bg-white/70" />;

  return (
    <div className="space-y-4">
      {warehouses.map((wh) => (
        <div key={wh.id} className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl text-espresso">
                {wh.name}
                {wh.is_default && (
                  <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-800 ring-1 ring-green-200">
                    Default
                  </span>
                )}
              </h2>
              <p className="text-sm text-muted">
                {wh.code} · {wh.address ?? "No address"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(wh.locations ?? []).map((loc) => (
              <span
                key={loc.id}
                className="rounded-full bg-linen px-3 py-1 text-xs font-semibold text-espresso ring-1 ring-sand"
              >
                {loc.code}
                {loc.name && loc.name !== loc.code ? ` · ${loc.name}` : ""}
              </span>
            ))}
          </div>
        </div>
      ))}
      {warehouses.length === 0 && (
        <p className="text-muted">No warehouses configured. Run migration 0006.</p>
      )}
    </div>
  );
}
