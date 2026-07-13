"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatOrderPrice } from "@/lib/format";
import { PO_STATUS_LABELS, type POStatus, type PurchaseOrder } from "@/types/purchase-order";
import type { Warehouse } from "@/types/warehouse";

type PageProps = { params: Promise<{ id: string }> };

const NEXT_STATUS: Partial<Record<POStatus, POStatus>> = {
  draft: "sent",
  sent: "confirmed",
  confirmed: "manufacturing",
  manufacturing: "ready",
  ready: "shipped",
  shipped: "delivered",
};

export default function PurchaseOrderDetailPage({ params }: PageProps) {
  const [poId, setPoId] = useState<string | null>(null);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setPoId(p.id));
  }, [params]);

  function load(id: string) {
    fetch(`/api/purchasing?resource=purchase-order&id=${id}`)
      .then((r) => r.json())
      .then((res) => res.success && setPo(res.po));
  }

  useEffect(() => {
    if (!poId) return;
    load(poId);
    fetch("/api/inventory/warehouses")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setWarehouses(res.warehouses ?? []);
          const defaultWh = res.warehouses?.find((w: Warehouse) => w.is_default) ?? res.warehouses?.[0];
          if (defaultWh) {
            setWarehouseId(defaultWh.id);
            setLocationId(defaultWh.locations?.[0]?.id ?? "");
          }
        }
      });
  }, [poId]);

  async function advanceStatus() {
    if (!po || !poId) return;
    const next = NEXT_STATUS[po.status];
    if (!next) return;
    await fetch("/api/purchasing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: "po-status", id: poId, status: next }),
    });
    load(poId);
  }

  async function receiveGoods() {
    if (!po || !poId) return;
    const lines = (po.lines ?? [])
      .filter((l) => (receiveQty[l.id] ?? 0) > 0)
      .map((l) => ({ line_id: l.id, quantity_received: receiveQty[l.id] }));

    if (lines.length === 0) {
      setMessage("Enter quantities to receive.");
      return;
    }

    const res = await fetch("/api/purchasing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "receive-po",
        purchase_order_id: poId,
        warehouse_id: warehouseId,
        location_id: locationId,
        lines,
      }),
    });
    const result = await res.json();
    if (result.success) {
      setMessage("Goods received — inventory updated.");
      setReceiveQty({});
      load(poId);
    } else {
      setMessage(result.error ?? "Receive failed.");
    }
  }

  if (!po) return <div className="h-48 animate-pulse rounded-2xl bg-white/70" />;

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);
  const canReceive = ["shipped", "delivered", "confirmed", "ready"].includes(po.status);

  return (
    <div className="space-y-6">
      <Link href="/admin/purchasing/purchase-orders" className="text-sm text-clay">&larr; Purchase Orders</Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-espresso">{po.po_number}</h2>
          <p className="text-muted">{po.supplier?.name} · {PO_STATUS_LABELS[po.status]}</p>
        </div>
        <p className="font-serif text-xl">{formatOrderPrice(po.total, po.currency)}</p>
      </header>

      {message && (
        <p className={`rounded-xl px-4 py-2 text-sm ${message.includes("failed") || message.includes("Enter") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>
          {message}
        </p>
      )}

      {NEXT_STATUS[po.status] && (
        <button type="button" onClick={advanceStatus} className="rounded-full bg-cocoa px-5 py-2 text-sm font-semibold text-cream">
          Mark as {PO_STATUS_LABELS[NEXT_STATUS[po.status]!]}
        </button>
      )}

      <section className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
        <h3 className="font-semibold text-espresso">Line Items</h3>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2">Product</th>
              <th className="pb-2">Qty</th>
              <th className="pb-2">Received</th>
              <th className="pb-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {(po.lines ?? []).map((l) => (
              <tr key={l.id} className="border-t border-sand/40">
                <td className="py-2">{l.product_name}</td>
                <td className="py-2">{l.quantity}</td>
                <td className="py-2">{l.quantity_received}</td>
                <td className="py-2">{formatOrderPrice(l.unit_cost, po.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {canReceive && (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
          <h3 className="font-semibold text-espresso">Receive Goods</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); const w = warehouses.find((wh) => wh.id === e.target.value); setLocationId(w?.locations?.[0]?.id ?? ""); }} className="rounded-xl border border-sand px-3 py-2">
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="rounded-xl border border-sand px-3 py-2">
              {(selectedWarehouse?.locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
            </select>
          </div>
          <ul className="mt-4 space-y-3">
            {(po.lines ?? []).map((l) => {
              const remaining = l.quantity - l.quantity_received;
              if (remaining <= 0) return null;
              return (
                <li key={l.id} className="flex items-center justify-between gap-4">
                  <span className="text-sm">{l.product_name} ({remaining} remaining)</span>
                  <input
                    type="number"
                    min={0}
                    max={remaining}
                    value={receiveQty[l.id] ?? ""}
                    onChange={(e) => setReceiveQty({ ...receiveQty, [l.id]: Number(e.target.value) })}
                    className="w-24 rounded-xl border border-sand px-3 py-2 text-right"
                    placeholder="Qty"
                  />
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={receiveGoods} className="mt-4 rounded-full bg-cocoa px-5 py-2 text-sm font-semibold text-cream">
            Receive into Inventory
          </button>
        </section>
      )}
    </div>
  );
}
