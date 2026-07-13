"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProductMaster } from "@/types/inventory";

export default function InventoryProductsPage() {
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (term?: string) => {
    const q = term ? `?search=${encodeURIComponent(term)}` : "";
    const response = await fetch(`/api/inventory/products${q}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    setProducts(result.products ?? []);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);

  const filtered = useMemo(() => {
    if (!search) return products;
    const t = search.toLowerCase();
    return products.filter(
      (p) =>
        p.sku?.toLowerCase().includes(t) ||
        p.name.toLowerCase().includes(t) ||
        p.barcode?.toLowerCase().includes(t),
    );
  }, [products, search]);

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => String(p.id))));
  }

  function exportCsv() {
    const rows = filtered.filter((p) => selected.has(String(p.id)));
    const target = rows.length ? rows : filtered;
    const headers = ["SKU", "Name", "Brand", "Stock", "Cost", "Retail", "Barcode", "Status"];
    const lines = [
      headers.join(","),
      ...target.map((p) =>
        [p.sku, p.name, p.brand, p.stock, p.cost_price, p.retail_price, p.barcode, p.status]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search SKU, name, barcode…"
          className="flex-1 rounded-2xl border border-sand bg-white px-4 py-2.5 text-sm outline-none focus:border-clay"
        />
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-full bg-cocoa px-4 py-2 text-xs font-semibold text-cream"
        >
          Export CSV
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/70" />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-sand/60">
          <div className="grid grid-cols-[2rem_1fr_0.6fr_0.5fr_0.5fr] gap-3 border-b border-sand/60 px-4 py-3 text-xs font-medium uppercase tracking-widest text-muted">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Select all"
              className="h-4 w-4"
            />
            <span>Product</span>
            <span>SKU</span>
            <span>Stock</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-sand/60">
            {filtered.map((p) => (
              <li
                key={String(p.id)}
                className="grid grid-cols-[2rem_1fr_0.6fr_0.5fr_0.5fr] items-center gap-3 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={selected.has(String(p.id))}
                  onChange={() => {
                    const next = new Set(selected);
                    const key = String(p.id);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    setSelected(next);
                  }}
                  className="h-4 w-4"
                />
                <Link
                  href={`/admin/inventory/products/${p.id}`}
                  className="font-medium text-espresso hover:text-cocoa"
                >
                  {p.name}
                </Link>
                <span className="text-sm text-muted">{p.sku ?? "—"}</span>
                <span className="text-sm font-semibold text-espresso">{p.stock ?? 0}</span>
                <span className="text-xs text-muted">{p.status ?? "active"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
