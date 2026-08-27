"use client";

import { useState } from "react";
import type { ProductMaster } from "@/types/inventory";
import type { AssortmentStatus } from "@/lib/types";
import { AssortmentStatusBadge } from "@/components/inventory/assortment/AssortmentStatusBadge";
import { AssortmentStatusSelect } from "@/components/inventory/assortment/AssortmentStatusSelect";

export function AssortmentPanel({
  product,
  onSaved,
}: {
  product: ProductMaster;
  onSaved: (p: ProductMaster) => void;
}) {
  const [status, setStatus] = useState<AssortmentStatus | null>(product.assortment_status ?? null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const pending =
    status !== null && status !== (product.assortment_status ?? null);

  async function handleSave() {
    if (!status) {
      setMessage("Choose Active, Paused, or Retired to save.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/inventory/assortment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id, assortment_status: status }),
    });
    const result = await res.json();
    setSaving(false);

    if (!result.success) {
      setMessage(result.error ?? "Could not save assortment status.");
      return;
    }

    onSaved({ ...product, assortment_status: result.product?.assortment_status ?? status });
    setStatus(result.product?.assortment_status ?? status);
    setMessage("Assortment status saved.");
  }

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg text-espresso">Assortment</h3>
          <p className="mt-1 text-sm text-muted">
            Business decision for the Chosen by Chloe selling assortment. Does not change technical
            active flag or inventory.
          </p>
        </div>
        <AssortmentStatusBadge status={product.assortment_status} />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="font-medium text-espresso">Assortment status</span>
          <AssortmentStatusSelect
            value={status}
            onChange={setStatus}
            disabled={saving}
            className="mt-1.5 w-full max-w-xs rounded-2xl border border-sand px-4 py-2.5"
          />
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !pending}
          className="rounded-full bg-cocoa px-5 py-2 text-sm font-semibold text-cream disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save assortment"}
        </button>
      </div>

      {message && (
        <p
          className={`mt-3 text-sm ${message.includes("saved") ? "text-green-700" : "text-red-700"}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
