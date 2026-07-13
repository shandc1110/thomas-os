"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatOrderPrice } from "@/lib/format";
import { PO_STATUS_LABELS } from "@/types/purchase-order";
import type { PurchaseOrder } from "@/types/purchase-order";
import type { Supplier } from "@/types/supplier";

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    supplier_id: "",
    product_name: "",
    sku: "",
    quantity: "1",
    unit_cost: "",
  });

  function load() {
    Promise.all([
      fetch("/api/purchasing?resource=purchase-orders").then((r) => r.json()),
      fetch("/api/purchasing?resource=suppliers").then((r) => r.json()),
    ]).then(([o, s]) => {
      if (o.success) setOrders(o.orders ?? []);
      if (s.success) setSuppliers(s.suppliers ?? []);
    });
  }

  useEffect(() => { load(); }, []);

  async function createPo(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/purchasing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "purchase-order",
        supplier_id: form.supplier_id,
        lines: [{
          product_name: form.product_name,
          sku: form.sku || undefined,
          quantity: Number(form.quantity),
          unit_cost: Number(form.unit_cost),
        }],
      }),
    });
    const result = await res.json();
    if (result.success) {
      setShowForm(false);
      load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-espresso">Purchase Orders</h2>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-full bg-cocoa px-4 py-2 text-sm font-semibold text-cream">
          {showForm ? "Cancel" : "New PO"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createPo} className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-sand/60 sm:grid-cols-2">
          <select required value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="rounded-xl border border-sand px-3 py-2 sm:col-span-2">
            <option value="">Select supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input required placeholder="Product name" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <input required type="number" min="1" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <input required type="number" step="0.01" placeholder="Unit cost" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <button type="submit" className="rounded-xl bg-cocoa px-4 py-2 font-semibold text-cream sm:col-span-2">Create PO</button>
        </form>
      )}

      <ul className="divide-y divide-sand/40 rounded-2xl bg-white ring-1 ring-sand/60">
        {orders.map((po) => (
          <li key={po.id}>
            <Link href={`/admin/purchasing/purchase-orders/${po.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-linen/50">
              <div>
                <p className="font-semibold text-espresso">{po.po_number}</p>
                <p className="text-sm text-muted">{po.supplier?.name} · {PO_STATUS_LABELS[po.status]}</p>
              </div>
              <span className="font-semibold">{formatOrderPrice(po.total, po.currency)}</span>
            </Link>
          </li>
        ))}
        {orders.length === 0 && <li className="px-5 py-8 text-center text-muted">No purchase orders yet.</li>}
      </ul>
    </div>
  );
}
