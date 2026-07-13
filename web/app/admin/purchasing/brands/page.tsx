"use client";

import { useEffect, useState } from "react";
import type { Brand, Supplier } from "@/types/supplier";

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", country: "", supplier_id: "", website: "" });
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    Promise.all([
      fetch("/api/purchasing?resource=brands").then((r) => r.json()),
      fetch("/api/purchasing?resource=suppliers").then((r) => r.json()),
    ]).then(([b, s]) => {
      if (b.success) setBrands(b.brands ?? []);
      if (s.success) setSuppliers(s.suppliers ?? []);
    });
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/purchasing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "brand",
        name: form.name,
        country: form.country || null,
        supplier_id: form.supplier_id || null,
        website: form.website || null,
        contract_status: "active",
      }),
    });
    const result = await res.json();
    if (result.success) {
      setMessage(`Brand ${form.name} saved.`);
      setShowForm(false);
      setForm({ name: "", country: "", supplier_id: "", website: "" });
      load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-espresso">Brands</h2>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-full bg-cocoa px-4 py-2 text-sm font-semibold text-cream">
          {showForm ? "Cancel" : "Add Brand"}
        </button>
      </div>

      {message && <p className="rounded-xl bg-green-50 px-4 py-2 text-sm text-green-800">{message}</p>}

      {showForm && (
        <form onSubmit={save} className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-sand/60 sm:grid-cols-2">
          <input required placeholder="Brand name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <input placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="rounded-xl border border-sand px-3 py-2">
            <option value="">Select supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input placeholder="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <button type="submit" className="rounded-xl bg-cocoa px-4 py-2 font-semibold text-cream sm:col-span-2">Save Brand</button>
        </form>
      )}

      <ul className="divide-y divide-sand/40 rounded-2xl bg-white ring-1 ring-sand/60">
        {brands.map((b) => (
          <li key={b.id} className="px-5 py-4">
            <p className="font-semibold text-espresso">{b.name}</p>
            <p className="text-sm text-muted">{b.supplier?.name ?? "No supplier"} · {b.country ?? "—"}</p>
          </li>
        ))}
        {brands.length === 0 && <li className="px-5 py-8 text-center text-muted">No brands yet.</li>}
      </ul>
    </div>
  );
}
