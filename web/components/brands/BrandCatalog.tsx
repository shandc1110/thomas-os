"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Catalog from "@/components/Catalog";
import type { Product } from "@/lib/types";
import { sortToniesCategories } from "@/lib/brands/tonies-categories";

type BrandCatalogProps = {
  products: Product[];
  /** When true, show category chips + search. */
  enableBrowse?: boolean;
};

const MICRO_CATEGORY_ORDER = [
  "Mini & Maxi Micro's",
  "Nursery & Travel Range",
  "5+ Scooters",
  "Helmets",
  "Accessories",
];

function sortCategories(categories: string[]): string[] {
  const hasMicro = categories.some((c) => MICRO_CATEGORY_ORDER.includes(c));
  if (hasMicro) {
    const rank = new Map(MICRO_CATEGORY_ORDER.map((c, i) => [c, i]));
    return [...categories].sort((a, b) => {
      const ra = rank.get(a) ?? 1000;
      const rb = rank.get(b) ?? 1000;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
  }
  return sortToniesCategories(categories);
}

function matchesSearch(product: Product, q: string): boolean {
  if (!q) return true;
  const hay = [product.name, product.sku, product.description, product.category, product.barcode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => hay.includes(token));
}

export function BrandCatalog({ products, enableBrowse = false }: BrandCatalogProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const deferredQuery = useDeferredValue(query.trim());

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const c = p.category?.trim();
      if (!c) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const names = sortCategories([...counts.keys()]);
    return names.map((name) => ({ name, count: counts.get(name) ?? 0 }));
  }, [products]);

  const filtered = useMemo(() => {
    if (!enableBrowse) return products;
    return products.filter((p) => {
      if (category !== "all" && (p.category?.trim() ?? "") !== category) return false;
      return matchesSearch(p, deferredQuery);
    });
  }, [products, enableBrowse, category, deferredQuery]);

  if (products.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-sand/60">
        <p className="font-serif text-xl text-espresso">Nothing in this collection yet</p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
          Products for this brand will appear here when they are listed.
        </p>
      </div>
    );
  }

  return (
    <div>
      {enableBrowse && (
        <div className="mb-6 space-y-4">
          <label className="block">
            <span className="sr-only">Search Tonies</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, SKU…"
              className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-espresso shadow-sm ring-1 ring-sand/70 placeholder:text-muted outline-none focus:ring-2 focus:ring-cocoa/40"
              autoComplete="off"
            />
          </label>

          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            role="tablist"
            aria-label="Categories"
          >
            <CategoryChip
              label="All"
              count={products.length}
              active={category === "all"}
              onClick={() => setCategory("all")}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c.name}
                label={c.name}
                count={c.count}
                active={category === c.name}
                onClick={() => setCategory(c.name)}
              />
            ))}
          </div>

          <p className="text-xs text-muted">
            Showing {filtered.length} of {products.length}
            {category !== "all" ? ` in ${category}` : ""}
            {deferredQuery ? ` matching “${deferredQuery}”` : ""}
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-sand/60">
          <p className="font-serif text-xl text-espresso">No matches</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
            Try another search or category.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
            className="mt-4 text-sm font-semibold text-cocoa underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <Catalog products={filtered} />
      )}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition ${
        active
          ? "bg-cocoa text-cream"
          : "bg-white text-espresso ring-1 ring-sand/80 hover:bg-linen"
      }`}
    >
      {label}
      <span className={`ml-1.5 ${active ? "text-cream/70" : "text-muted"}`}>{count}</span>
    </button>
  );
}
