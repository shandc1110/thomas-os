"use client";

import { useEffect, useState } from "react";
import type { InboundShipment, PurchaseOrder } from "@/types/purchase-order";
import type { Supplier } from "@/types/supplier";

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    purchase_order_id: "",
    supplier_id: "",
    freight_method: "sea",
    tracking_number: "",
    eta: "",
  });

  function load() {
    Promise.all([
      fetch("/api/purchasing?resource=shipments").then((r) => r.json()),
      fetch("/api/purchasing?resource=purchase-orders").then((r) => r.json()),
      fetch("/api/purchasing?resource=suppliers").then((r) => r.json()),
    ]).then(([sh, po, sup]) => {
      if (sh.success) setShipments(sh.shipments ?? []);
      if (po.success) setPos(po.orders ?? []);
      if (sup.success) setSuppliers(sup.suppliers ?? []);
    });
  }

  useEffect(() => { load(); }, []);

  async function createShipment(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/purchasing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "shipment",
        purchase_order_id: form.purchase_order_id || null,
        supplier_id: form.supplier_id || null,
        freight_method: form.freight_method,
        tracking_number: form.tracking_number || null,
        eta: form.eta || null,
        status: "in_transit",
      }),
    });
    setShowForm(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-espresso">Inbound Shipments</h2>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-full bg-cocoa px-4 py-2 text-sm font-semibold text-cream">
          {showForm ? "Cancel" : "Track Shipment"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createShipment} className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-sand/60 sm:grid-cols-2">
          <select value={form.purchase_order_id} onChange={(e) => setForm({ ...form, purchase_order_id: e.target.value })} className="rounded-xl border border-sand px-3 py-2">
            <option value="">Link PO (optional)</option>
            {pos.map((p) => <option key={p.id} value={p.id}>{p.po_number}</option>)}
          </select>
          <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="rounded-xl border border-sand px-3 py-2">
            <option value="">Supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={form.freight_method} onChange={(e) => setForm({ ...form, freight_method: e.target.value })} className="rounded-xl border border-sand px-3 py-2">
            <option value="sea">Sea Freight</option>
            <option value="air">Air Freight</option>
            <option value="courier">Courier</option>
          </select>
          <input placeholder="Tracking number" value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <input type="date" value={form.eta} onChange={(e) => setForm({ ...form, eta: e.target.value })} className="rounded-xl border border-sand px-3 py-2 sm:col-span-2" />
          <button type="submit" className="rounded-xl bg-cocoa px-4 py-2 font-semibold text-cream sm:col-span-2">Create Shipment</button>
        </form>
      )}

      <ul className="divide-y divide-sand/40 rounded-2xl bg-white ring-1 ring-sand/60">
        {shipments.map((s) => (
          <li key={s.id} className="px-5 py-4">
            <p className="font-semibold text-espresso">{s.shipment_number}</p>
            <p className="text-sm text-muted">
              {s.supplier?.name ?? "—"} · {s.freight_method ?? "—"} · {s.status}
              {s.purchase_order?.po_number ? ` · ${s.purchase_order.po_number}` : ""}
            </p>
            {s.tracking_number && <p className="text-xs text-muted">Tracking: {s.tracking_number}</p>}
            {s.eta && <p className="text-xs text-muted">ETA: {s.eta}</p>}
          </li>
        ))}
        {shipments.length === 0 && <li className="px-5 py-8 text-center text-muted">No shipments tracked yet.</li>}
      </ul>
    </div>
  );
}
