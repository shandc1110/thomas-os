"use client";

import { useEffect, useState } from "react";
import type { Supplier } from "@/types/supplier";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", country: "", email: "", phone: "", payment_terms: "", lead_time_days: "" });
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/purchasing?resource=suppliers")
      .then((r) => r.json())
      .then((res) => res.success && setSuppliers(res.suppliers ?? []));
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/purchasing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "supplier",
        name: form.name,
        country: form.country || null,
        email: form.email || null,
        phone: form.phone || null,
        payment_terms: form.payment_terms || null,
        lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
        status: "active",
      }),
    });
    const result = await res.json();
    if (result.success) {
      setMessage(`Supplier ${form.name} saved.`);
      setShowForm(false);
      setForm({ name: "", country: "", email: "", phone: "", payment_terms: "", lead_time_days: "" });
      load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-espresso">Suppliers</h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-full bg-cocoa px-4 py-2 text-sm font-semibold text-cream"
        >
          {showForm ? "Cancel" : "Add Supplier"}
        </button>
      </div>

      {message && <p className="rounded-xl bg-green-50 px-4 py-2 text-sm text-green-800">{message}</p>}

      {showForm && (
        <form onSubmit={save} className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-sand/60 sm:grid-cols-2">
          <input required placeholder="Supplier name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <input placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <input placeholder="Payment terms" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <input placeholder="Lead time (days)" type="number" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} className="rounded-xl border border-sand px-3 py-2" />
          <button type="submit" className="rounded-xl bg-cocoa px-4 py-2 font-semibold text-cream sm:col-span-2">Save Supplier</button>
        </form>
      )}

      <ul className="divide-y divide-sand/40 rounded-2xl bg-white ring-1 ring-sand/60">
        {suppliers.map((s) => (
          <li key={s.id} className="px-5 py-4">
            <p className="font-semibold text-espresso">{s.name}</p>
            <p className="text-sm text-muted">
              {[s.country, s.email, s.payment_terms].filter(Boolean).join(" · ") || "No details"}
            </p>
          </li>
        ))}
        {suppliers.length === 0 && <li className="px-5 py-8 text-center text-muted">No suppliers yet.</li>}
      </ul>
    </div>
  );
}
