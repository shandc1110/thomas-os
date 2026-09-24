"use client";

import { useEffect, useState } from "react";
import type { Brand, Supplier } from "@/types/supplier";

function isActiveStatus(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "active";
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", country: "", supplier_id: "", website: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  function load() {
    Promise.all([
      fetch("/api/purchasing?resource=brands").then((r) => r.json()),
      fetch("/api/purchasing?resource=suppliers").then((r) => r.json()),
    ]).then(([b, s]) => {
      if (b.success) setBrands(b.brands ?? []);
      if (s.success) setSuppliers(s.suppliers ?? []);
    });
  }

  useEffect(() => {
    load();
  }, []);

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
    } else {
      setMessage(result.error ?? "Save failed.");
    }
  }

  async function seedFromStorefront() {
    setSeeding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/purchasing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "seed-storefront-brands" }),
      });
      const result = await res.json();
      if (result.success) {
        setBrands(result.brands ?? []);
        setMessage(
          `Seeded storefront brands: ${result.inserted} added, ${result.skipped} already present.`,
        );
      } else {
        setMessage(result.error ?? "Seed failed.");
      }
    } finally {
      setSeeding(false);
    }
  }

  async function toggleActive(brand: Brand) {
    const next = isActiveStatus(brand.contract_status) ? "inactive" : "active";
    setBusyId(brand.id);
    setMessage(null);
    try {
      const res = await fetch("/api/purchasing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "brand-status",
          id: brand.id,
          contract_status: next,
        }),
      });
      const result = await res.json();
      if (result.success && result.brand) {
        setBrands((prev) =>
          prev.map((b) => (b.id === brand.id ? { ...b, ...result.brand } : b)),
        );
        setMessage(
          `${brand.name} is now ${next === "active" ? "active on storefront" : "hidden from storefront"}.`,
        );
      } else {
        setMessage(result.error ?? "Update failed.");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl text-espresso">Brands</h2>
          <p className="mt-1 text-sm text-muted">
            Active brands appear on the Chosen by Chloe storefront. Inactive brands are hidden.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={seedFromStorefront}
            disabled={seeding}
            className="rounded-full border border-sand bg-white px-4 py-2 text-sm font-semibold text-espresso disabled:opacity-60"
          >
            {seeding ? "Seeding…" : "Seed from storefront registry"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-full bg-cocoa px-4 py-2 text-sm font-semibold text-cream"
          >
            {showForm ? "Cancel" : "Add Brand"}
          </button>
        </div>
      </div>

      {message && <p className="rounded-xl bg-green-50 px-4 py-2 text-sm text-green-800">{message}</p>}

      {showForm && (
        <form
          onSubmit={save}
          className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-sand/60 sm:grid-cols-2"
        >
          <input
            required
            placeholder="Brand name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-xl border border-sand px-3 py-2"
          />
          <input
            placeholder="Country"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="rounded-xl border border-sand px-3 py-2"
          />
          <select
            value={form.supplier_id}
            onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            className="rounded-xl border border-sand px-3 py-2"
          >
            <option value="">Select supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Website"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            className="rounded-xl border border-sand px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-xl bg-cocoa px-4 py-2 font-semibold text-cream sm:col-span-2"
          >
            Save Brand
          </button>
        </form>
      )}

      <ul className="divide-y divide-sand/40 rounded-2xl bg-white ring-1 ring-sand/60">
        {brands.map((b) => {
          const active = isActiveStatus(b.contract_status);
          return (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-semibold text-espresso">{b.name}</p>
                <p className="text-sm text-muted">
                  {b.supplier?.name ?? "No supplier"} · {b.country ?? "—"} ·{" "}
                  <span className={active ? "text-green-700" : "text-amber-700"}>
                    {active ? "Storefront active" : "Storefront inactive"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === b.id}
                onClick={() => toggleActive(b)}
                className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                  active
                    ? "border border-sand bg-white text-espresso"
                    : "bg-cocoa text-cream"
                }`}
              >
                {busyId === b.id ? "Saving…" : active ? "Set inactive" : "Set active"}
              </button>
            </li>
          );
        })}
        {brands.length === 0 && (
          <li className="px-5 py-8 text-center text-muted">
            No brands yet. Use &quot;Seed from storefront registry&quot; to add Mideer, Tonies,
            Kidywolf, and the rest.
          </li>
        )}
      </ul>
    </div>
  );
}
