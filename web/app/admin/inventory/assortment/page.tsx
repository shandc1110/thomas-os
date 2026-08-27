"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssortmentStatus } from "@/lib/types";
import type { AssortmentCounts, AssortmentListItem } from "@/lib/inventory/assortment";
import { getSellableStock } from "@/lib/presell";
import { formatPrice } from "@/lib/format";
import { AssortmentStatusBadge } from "@/components/inventory/assortment/AssortmentStatusBadge";
import { AssortmentStatusSelect } from "@/components/inventory/assortment/AssortmentStatusSelect";

type AssortmentFilter = "all" | "not_reviewed" | AssortmentStatus;

type FilterOptions = {
  brands: string[];
  categories: string[];
};

type BulkConfirm = {
  status: AssortmentStatus;
  count: number;
} | null;

const COUNT_TABS: { key: AssortmentFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "not_reviewed", label: "Not reviewed" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "retired", label: "Retired" },
];

export default function AssortmentAdminPage() {
  const [products, setProducts] = useState<AssortmentListItem[]>([]);
  const [counts, setCounts] = useState<AssortmentCounts | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ brands: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [assortmentFilter, setAssortmentFilter] = useState<AssortmentFilter>("not_reviewed");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "out_of_stock" | "presell">(
    "all",
  );
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Record<string, AssortmentStatus>>({});
  const [rowSaving, setRowSaving] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<BulkConfirm>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      assortment: assortmentFilter,
      active: activeFilter,
      stock: stockFilter,
    });
    if (search) params.set("search", search);
    if (brand) params.set("brand", brand);
    if (category) params.set("category", category);

    const res = await fetch(`/api/inventory/assortment?${params}`);
    const result = await res.json();
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Could not load assortment.");
      return;
    }

    setProducts(result.products ?? []);
    setCounts(result.counts ?? null);
    setTotal(result.total ?? 0);
    setFilterOptions(result.filterOptions ?? { brands: [], categories: [] });
    setPending((prev) => {
      const next = { ...prev };
      for (const p of result.products ?? []) {
        const id = String(p.id);
        const saved = p.assortment_status;
        if (next[id] && next[id] === saved) delete next[id];
      }
      return next;
    });
  }, [page, assortmentFilter, brand, category, activeFilter, stockFilter, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- admin list fetch on filter/page change
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / limit));
  const allOnPageSelected =
    products.length > 0 && products.every((p) => selected.has(String(p.id)));

  function toggleAllOnPage() {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of products) next.delete(String(p.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of products) next.add(String(p.id));
        return next;
      });
    }
  }

  function setRowPending(id: string, status: AssortmentStatus) {
    setPending((prev) => ({ ...prev, [id]: status }));
  }

  async function saveRow(product: AssortmentListItem) {
    const id = String(product.id);
    const status = pending[id];
    if (!status) return;

    setRowSaving(id);
    setMessage(null);
    const res = await fetch("/api/inventory/assortment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: id, assortment_status: status }),
    });
    const result = await res.json();
    setRowSaving(null);

    if (!result.success) {
      setMessage(result.error ?? "Save failed.");
      return;
    }

    setProducts((prev) =>
      prev.map((p) =>
        String(p.id) === id
          ? { ...p, assortment_status: result.product?.assortment_status ?? status }
          : p,
      ),
    );
    setPending((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCounts((c) => adjustCounts(c, product.assortment_status, status));
    setMessage("Assortment status saved.");
    load();
  }

  function adjustCounts(
    counts: AssortmentCounts | null,
    from: AssortmentStatus | null,
    to: AssortmentStatus,
  ): AssortmentCounts | null {
    if (!counts) return counts;
    const next = { ...counts };
    const dec = (key: keyof Omit<AssortmentCounts, "all">) => {
      next[key] = Math.max(0, next[key] - 1);
    };
    const inc = (key: keyof Omit<AssortmentCounts, "all">) => {
      next[key] += 1;
    };
    if (from == null) dec("not_reviewed");
    else if (from === "active") dec("active");
    else if (from === "paused") dec("paused");
    else if (from === "retired") dec("retired");
    if (to === "active") inc("active");
    else if (to === "paused") inc("paused");
    else if (to === "retired") inc("retired");
    return next;
  }

  async function confirmBulk() {
    if (!bulkConfirm) return;
    const ids = [...selected];
    if (ids.length === 0) return;

    setBulkSaving(true);
    setMessage(null);
    const res = await fetch("/api/inventory/assortment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_ids: ids,
        assortment_status: bulkConfirm.status,
      }),
    });
    const result = await res.json();
    setBulkSaving(false);
    setBulkConfirm(null);

    if (!result.success) {
      setMessage(result.error ?? "Bulk update failed.");
      return;
    }

    const failed = result.failed?.length ?? 0;
    setMessage(
      failed > 0
        ? `Updated ${result.updated} products. ${failed} could not be updated.`
        : `Updated ${result.updated} products.`,
    );
    setSelected(new Set());
    load();
  }

  const bulkLabel = useMemo(() => {
    if (!bulkConfirm) return "";
    const name =
      bulkConfirm.status === "active"
        ? "Active"
        : bulkConfirm.status === "paused"
          ? "Paused"
          : "Retired";
    return `Set ${bulkConfirm.count} products to ${name}?`;
  }, [bulkConfirm]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-serif text-2xl text-espresso">Assortment</h2>
        <p className="mt-1 text-sm text-muted">
          Review and classify products for the Chosen by Chloe selling assortment. Storefront
          eligibility is unchanged until a future sprint.
        </p>
      </div>

      {counts && (
        <div className="mb-4 flex flex-wrap gap-2">
          {COUNT_TABS.map((tab) => {
            const countKey =
              tab.key === "all"
                ? "all"
                : tab.key === "not_reviewed"
                  ? "not_reviewed"
                  : tab.key;
            const count = counts[countKey as keyof AssortmentCounts];
            const active = assortmentFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setAssortmentFilter(tab.key);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1.5 text-sm ring-1 ${
                  active
                    ? "bg-cocoa text-cream ring-cocoa"
                    : "bg-white text-espresso ring-sand/60 hover:ring-clay"
                }`}
              >
                {tab.label} {count}
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name, SKU, brand…"
          className="min-w-[200px] flex-1 rounded-2xl border border-sand bg-white px-4 py-2.5 text-sm outline-none focus:border-clay"
        />
        <select
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            setPage(1);
          }}
          className="rounded-2xl border border-sand bg-white px-3 py-2.5 text-sm"
        >
          <option value="">All brands</option>
          {filterOptions.brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-2xl border border-sand bg-white px-3 py-2.5 text-sm"
        >
          <option value="">All categories</option>
          {filterOptions.categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value as typeof activeFilter);
            setPage(1);
          }}
          className="rounded-2xl border border-sand bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">Technical: all</option>
          <option value="active">Technical: active</option>
          <option value="inactive">Technical: inactive</option>
        </select>
        <select
          value={stockFilter}
          onChange={(e) => {
            setStockFilter(e.target.value as typeof stockFilter);
            setPage(1);
          }}
          className="rounded-2xl border border-sand bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">Stock: all</option>
          <option value="in_stock">In stock</option>
          <option value="out_of_stock">Out of stock</option>
          <option value="presell">Presell</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-linen px-4 py-3 ring-1 ring-sand/60">
          <span className="text-sm text-espresso">{selected.size} selected</span>
          <button
            type="button"
            disabled={bulkSaving}
            onClick={() => setBulkConfirm({ status: "active", count: selected.size })}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-sand"
          >
            Set Active
          </button>
          <button
            type="button"
            disabled={bulkSaving}
            onClick={() => setBulkConfirm({ status: "paused", count: selected.size })}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-sand"
          >
            Set Paused
          </button>
          <button
            type="button"
            disabled={bulkSaving}
            onClick={() => setBulkConfirm({ status: "retired", count: selected.size })}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-sand"
          >
            Set Retired
          </button>
        </div>
      )}

      {message && (
        <p
          className={`mb-4 text-sm ${message.includes("failed") || message.includes("Could") ? "text-red-700" : "text-green-700"}`}
        >
          {message}
        </p>
      )}

      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/70" />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-sand/60">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-sand/60 text-left text-xs text-muted">
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Select all on page"
                  />
                </th>
                <th className="p-3">Product</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Brand</th>
                <th className="p-3">Category</th>
                <th className="p-3">Price</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Current status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const id = String(product.id);
                const sellable = getSellableStock(product);
                const rowStatus = pending[id] ?? product.assortment_status;
                const hasPending = pending[id] != null && pending[id] !== product.assortment_status;
                return (
                  <tr key={id} className="border-b border-sand/40 last:border-0">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                          });
                        }}
                        aria-label={`Select ${product.name}`}
                      />
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin/inventory/products/${id}`}
                        className="flex items-center gap-3 hover:text-cocoa"
                      >
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image_url}
                            alt=""
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-lg object-cover ring-1 ring-sand/60"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-linen ring-1 ring-sand/60" />
                        )}
                        <span className="font-medium text-espresso">{product.name}</span>
                      </Link>
                    </td>
                    <td className="p-3 text-muted">{product.sku ?? "—"}</td>
                    <td className="p-3">{product.brand ?? "—"}</td>
                    <td className="p-3">{product.category ?? "—"}</td>
                    <td className="p-3">
                      {formatPrice(product.price, product.currency)}
                    </td>
                    <td className="p-3">{sellable}</td>
                    <td className="p-3">
                      <AssortmentStatusBadge status={product.assortment_status} />
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <AssortmentStatusSelect
                          value={rowStatus}
                          onChange={(s) => setRowPending(id, s)}
                          disabled={rowSaving === id}
                        />
                        <button
                          type="button"
                          onClick={() => saveRow(product)}
                          disabled={!hasPending || rowSaving === id}
                          className="rounded-full bg-cocoa px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-50"
                        >
                          {rowSaving === id ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted">
                    No products match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted">
          {total === 0 ? "No results" : `Showing page ${page} of ${pageCount} (${total} products)`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-full bg-white px-4 py-2 ring-1 ring-sand disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= pageCount || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full bg-white px-4 py-2 ring-1 ring-sand disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {bulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg ring-1 ring-sand/60">
            <h3 className="font-serif text-lg text-espresso">Confirm bulk update</h3>
            <p className="mt-2 text-sm text-muted">{bulkLabel}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={bulkSaving}
                onClick={() => setBulkConfirm(null)}
                className="rounded-full px-4 py-2 text-sm ring-1 ring-sand"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkSaving}
                onClick={confirmBulk}
                className="rounded-full bg-cocoa px-4 py-2 text-sm font-semibold text-cream disabled:opacity-60"
              >
                {bulkSaving ? "Updating…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
