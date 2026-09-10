"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import type {
  ActiveEnrichmentCounts,
  ActiveEnrichmentRow,
  EnrichmentFilter,
} from "@/lib/storefront/enrichment-admin";

const FILTER_TABS: { key: EnrichmentFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "complete", label: "Complete" },
  { key: "missing_description", label: "Missing description" },
  { key: "missing_category", label: "Missing category" },
  { key: "missing_image", label: "Missing image" },
  { key: "missing_brand", label: "Missing brand" },
];

function statusChip(ok: boolean, okLabel: string, badLabel: string) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        ok ? "bg-sage/25 text-charcoal" : "bg-charcoal/90 text-ivory"
      }`}
    >
      {ok ? okLabel : badLabel}
    </span>
  );
}

export default function StorefrontEnrichmentAdminPage() {
  const [products, setProducts] = useState<ActiveEnrichmentRow[]>([]);
  const [counts, setCounts] = useState<ActiveEnrichmentCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [enrichment, setEnrichment] = useState<EnrichmentFilter>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      enrichment,
    });
    if (search) params.set("search", search);

    const res = await fetch(`/api/inventory/storefront-enrichment?${params}`);
    const result = await res.json();
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Could not load enrichment audit.");
      return;
    }

    setProducts(result.products ?? []);
    setCounts(result.counts ?? null);
    setTotal(result.total ?? 0);
  }, [page, enrichment, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- admin list fetch
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / limit));

  function openEditor(row: ActiveEnrichmentRow) {
    setEditingId(row.productId);
    setCategoryDraft(row.category ?? "");
    setDescriptionDraft(row.description ?? "");
    setSaveMessage(null);
    setSaveError(null);
  }

  function closeEditor() {
    setEditingId(null);
    setSaveMessage(null);
    setSaveError(null);
  }

  async function saveEnrichment(productId: string) {
    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    const res = await fetch("/api/inventory/storefront-enrichment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        category: categoryDraft,
        description: descriptionDraft,
      }),
    });
    const result = await res.json();
    setSaving(false);

    if (!result.success) {
      setSaveError(result.error ?? "Save failed.");
      return;
    }

    const updated = result.product as ActiveEnrichmentRow;
    setProducts((prev) => prev.map((p) => (p.productId === productId ? updated : p)));
    setCategoryDraft(updated.category ?? "");
    setDescriptionDraft(updated.description ?? "");
    setSaveMessage("Saved. Storefront readiness refreshed.");
    void load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-charcoal">Storefront enrichment</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Enrich <strong className="font-semibold text-charcoal">active</strong> products with
          category and description only. Does not change assortment, price, stock, brand, or SKU.
        </p>
        <p className="mt-2 text-xs text-muted">
          Related:{" "}
          <Link href="/admin/inventory/storefront-readiness" className="underline hover:text-charcoal">
            Storefront readiness
          </Link>{" "}
          ·{" "}
          <Link href="/admin/inventory/assortment" className="underline hover:text-charcoal">
            Assortment
          </Link>
        </p>
      </div>

      {counts ? (
        <div className="border border-sand bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage">
            Active catalogue ({counts.all})
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted">Complete</dt>
              <dd className="font-semibold text-charcoal">{counts.complete}</dd>
            </div>
            <div>
              <dt className="text-muted">Missing description</dt>
              <dd className="font-semibold text-charcoal">{counts.missing_description}</dd>
            </div>
            <div>
              <dt className="text-muted">Missing category</dt>
              <dd className="font-semibold text-charcoal">{counts.missing_category}</dd>
            </div>
            <div>
              <dt className="text-muted">Missing image</dt>
              <dd className="font-semibold text-charcoal">{counts.missing_image}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setEnrichment(tab.key);
              setPage(1);
              closeEditor();
            }}
            className={`rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
              enrichment === tab.key
                ? "bg-charcoal text-ivory"
                : "border border-sand bg-white text-muted hover:border-sage"
            }`}
          >
            {tab.label}
            {counts
              ? ` (${
                  tab.key === "all"
                    ? counts.all
                    : tab.key === "complete"
                      ? counts.complete
                      : counts[tab.key]
                })`
              : ""}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name, SKU, brand…"
          className="min-w-[220px] flex-1 border border-sand bg-white px-3 py-2 text-sm text-charcoal"
        />
        <p className="text-xs text-muted">
          Showing {total} · page {page}/{pageCount}
        </p>
      </div>

      {error ? (
        <p className="border border-sand bg-white px-4 py-3 text-sm text-charcoal">{error}</p>
      ) : null}

      <div className="overflow-x-auto border border-sand bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-sand bg-ivory/80 text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-3 font-semibold">Product</th>
              <th className="px-3 py-3 font-semibold">SKU</th>
              <th className="px-3 py-3 font-semibold">Brand</th>
              <th className="px-3 py-3 font-semibold">Category</th>
              <th className="px-3 py-3 font-semibold">Description</th>
              <th className="px-3 py-3 font-semibold">Image</th>
              <th className="px-3 py-3 font-semibold">Readiness</th>
              <th className="px-3 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  No active products match these filters.
                </td>
              </tr>
            ) : (
              products.map((row) => (
                <Fragment key={row.productId}>
                  <tr className="border-b border-sand/70 align-top">
                    <td className="px-3 py-3">
                      <div className="flex gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden bg-sand/40">
                          {row.primaryImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.primaryImage}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[9px] uppercase text-muted">
                              None
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-charcoal">{row.name}</p>
                          <p className="text-xs text-muted">
                            {row.currency} {row.price ?? "—"} · stock {row.sellableStock}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{row.sku ?? "—"}</td>
                    <td className="px-3 py-3 text-xs">{row.brand ?? "—"}</td>
                    <td className="px-3 py-3 text-xs">
                      {row.hasCategory ? row.category : statusChip(false, "", "Missing")}
                    </td>
                    <td className="px-3 py-3">
                      {statusChip(row.hasDescription, "Present", "Missing")}
                    </td>
                    <td className="px-3 py-3">
                      {statusChip(row.hasImage, "Present", "Missing")}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          row.storefrontLabel === "READY"
                            ? "bg-sage/25 text-charcoal"
                            : "bg-charcoal/90 text-ivory"
                        }`}
                      >
                        {row.storefrontLabel}
                      </span>
                      {row.issues.length > 0 ? (
                        <p className="mt-1 max-w-[180px] text-[10px] text-muted">
                          {row.issues.join(", ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            editingId === row.productId ? closeEditor() : openEditor(row)
                          }
                          className="text-left text-xs font-semibold uppercase tracking-wider text-charcoal underline hover:text-sage"
                        >
                          {editingId === row.productId ? "Close" : "Edit"}
                        </button>
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold uppercase tracking-wider text-muted underline hover:text-charcoal"
                        >
                          Open PDP
                        </a>
                      </div>
                    </td>
                  </tr>
                  {editingId === row.productId ? (
                    <tr className="border-b border-sand bg-ivory/40">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="mx-auto max-w-3xl space-y-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage">
                            Edit enrichment · {row.sku}
                          </p>
                          <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                              Category
                            </span>
                            <input
                              type="text"
                              value={categoryDraft}
                              onChange={(e) => setCategoryDraft(e.target.value)}
                              placeholder="Free-text category (existing model)"
                              className="w-full border border-sand bg-white px-3 py-2 text-sm text-charcoal"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                              Description
                            </span>
                            <textarea
                              value={descriptionDraft}
                              onChange={(e) => setDescriptionDraft(e.target.value)}
                              rows={5}
                              placeholder="Customer-facing description — do not invent copy"
                              className="w-full border border-sand bg-white px-3 py-2 text-sm text-charcoal"
                            />
                          </label>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void saveEnrichment(row.productId)}
                              className="bg-charcoal px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ivory disabled:opacity-50"
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="border border-sand bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-charcoal"
                            >
                              Preview PDP
                            </a>
                            <button
                              type="button"
                              onClick={closeEditor}
                              className="text-xs font-semibold uppercase tracking-wider text-muted underline"
                            >
                              Cancel
                            </button>
                          </div>
                          {saveMessage ? (
                            <p className="text-sm text-charcoal">{saveMessage}</p>
                          ) : null}
                          {saveError ? (
                            <p className="text-sm text-red-800">{saveError}</p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="border border-sand bg-white px-3 py-1.5 text-xs font-semibold uppercase disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => setPage((p) => p + 1)}
          className="border border-sand bg-white px-3 py-1.5 text-xs font-semibold uppercase disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
