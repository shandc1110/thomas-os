"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  AssortmentReviewFilter,
  ReadinessFilter,
  StorefrontReadinessCounts,
  StorefrontReadinessRow,
} from "@/lib/storefront/readiness-admin";
import { AssortmentStatusBadge } from "@/components/inventory/assortment/AssortmentStatusBadge";

const ASSORTMENT_TABS: { key: AssortmentReviewFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "not_reviewed", label: "Unreviewed" },
  { key: "active", label: "Active (sell)" },
  { key: "paused", label: "Paused" },
  { key: "retired", label: "Retired" },
];

const READINESS_TABS: { key: ReadinessFilter; label: string }[] = [
  { key: "all", label: "All readiness" },
  { key: "ready", label: "READY" },
  { key: "not_ready", label: "Not ready" },
  { key: "NOT_ELIGIBLE", label: "NOT_ELIGIBLE" },
  { key: "MISSING_IMAGE", label: "MISSING_IMAGE" },
  { key: "MISSING_BRAND", label: "MISSING_BRAND" },
  { key: "MISSING_PRICE", label: "MISSING_PRICE" },
  { key: "MISSING_CATEGORY", label: "MISSING_CATEGORY" },
  { key: "MISSING_DESCRIPTION", label: "MISSING_DESCRIPTION" },
];

function storefrontTone(label: string): string {
  if (label === "READY") return "bg-sage/25 text-charcoal";
  if (label === "NOT_ELIGIBLE") return "bg-sand text-muted";
  return "bg-charcoal/90 text-ivory";
}

function joybuyLabel(row: StorefrontReadinessRow): string {
  return row.joybuyCommercialStatus === "READY" ? "GBP READY" : "GBP MISSING";
}

function shopifyCommercialLabel(row: StorefrontReadinessRow): string {
  return row.shopifyCommercialStatus === "READY" ? "GBP READY" : "GBP MISSING";
}

export default function StorefrontReadinessAdminPage() {
  const [products, setProducts] = useState<StorefrontReadinessRow[]>([]);
  const [counts, setCounts] = useState<StorefrontReadinessCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [assortment, setAssortment] = useState<AssortmentReviewFilter>("active");
  const [readiness, setReadiness] = useState<ReadinessFilter>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      assortment,
      readiness,
    });
    if (search) params.set("search", search);

    const res = await fetch(`/api/inventory/storefront-readiness?${params}`);
    const result = await res.json();
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Could not load storefront readiness.");
      return;
    }

    setProducts(result.products ?? []);
    setCounts(result.counts ?? null);
    setTotal(result.total ?? 0);
  }, [page, assortment, readiness, search]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-charcoal">Storefront readiness</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Which products have we decided to sell, and what is preventing each one from being
          storefront-ready? Assortment and readiness are separate — this view never changes
          assortment status.
        </p>
        <p className="mt-2 text-xs text-muted">
          Assortment is managed on{" "}
          <Link href="/admin/inventory/assortment" className="underline hover:text-charcoal">
            Assortment
          </Link>
          . Preview opens the live customer PDP.
        </p>
      </div>

      {counts ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border border-sand bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage">
              Assortment
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted">All listings</dt>
                <dd className="font-semibold text-charcoal">{counts.assortment.all}</dd>
              </div>
              <div>
                <dt className="text-muted">Unreviewed</dt>
                <dd className="font-semibold text-charcoal">{counts.assortment.not_reviewed}</dd>
              </div>
              <div>
                <dt className="text-muted">Active (sell)</dt>
                <dd className="font-semibold text-charcoal">{counts.assortment.active}</dd>
              </div>
              <div>
                <dt className="text-muted">Paused</dt>
                <dd className="font-semibold text-charcoal">{counts.assortment.paused}</dd>
              </div>
              <div>
                <dt className="text-muted">Retired</dt>
                <dd className="font-semibold text-charcoal">{counts.assortment.retired}</dd>
              </div>
            </dl>
          </div>
          <div className="border border-sand bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage">
              Storefront readiness (all listings)
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted">READY</dt>
                <dd className="font-semibold text-charcoal">{counts.readiness.ready}</dd>
              </div>
              <div>
                <dt className="text-muted">Not ready</dt>
                <dd className="font-semibold text-charcoal">{counts.readiness.not_ready}</dd>
              </div>
              <div>
                <dt className="text-muted">MISSING_IMAGE</dt>
                <dd className="font-semibold text-charcoal">{counts.readiness.MISSING_IMAGE}</dd>
              </div>
              <div>
                <dt className="text-muted">MISSING_DESCRIPTION</dt>
                <dd className="font-semibold text-charcoal">
                  {counts.readiness.MISSING_DESCRIPTION}
                </dd>
              </div>
              <div>
                <dt className="text-muted">MISSING_CATEGORY</dt>
                <dd className="font-semibold text-charcoal">{counts.readiness.MISSING_CATEGORY}</dd>
              </div>
              <div>
                <dt className="text-muted">NOT_ELIGIBLE</dt>
                <dd className="font-semibold text-charcoal">{counts.readiness.NOT_ELIGIBLE}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {ASSORTMENT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setAssortment(tab.key);
              setPage(1);
            }}
            className={`rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
              assortment === tab.key
                ? "bg-charcoal text-ivory"
                : "border border-sand bg-white text-muted hover:border-sage"
            }`}
          >
            {tab.label}
            {counts
              ? ` (${
                  tab.key === "all"
                    ? counts.assortment.all
                    : tab.key === "not_reviewed"
                      ? counts.assortment.not_reviewed
                      : counts.assortment[tab.key]
                })`
              : ""}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {READINESS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setReadiness(tab.key);
              setPage(1);
            }}
            className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
              readiness === tab.key
                ? "bg-sage text-charcoal"
                : "border border-sand bg-white text-muted hover:border-sage"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name, SKU, brand, tags…"
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
              <th className="px-3 py-3 font-semibold">Assortment</th>
              <th className="px-3 py-3 font-semibold">Content</th>
              <th className="px-3 py-3 font-semibold">Shopify UK</th>
              <th className="px-3 py-3 font-semibold">Joybuy UK</th>
              <th className="px-3 py-3 font-semibold">Issues</th>
              <th className="px-3 py-3 font-semibold">Preview</th>
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
                  No products match these filters.
                </td>
              </tr>
            ) : (
              products.map((row) => (
                <tr key={row.productId} className="border-b border-sand/70 align-top">
                  <td className="px-3 py-3">
                    <div className="flex gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden bg-sand/40">
                        {row.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.imageUrl}
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
                        <p className="text-xs text-muted">{row.brand ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-charcoal">{row.sku ?? "—"}</td>
                  <td className="px-3 py-3">
                    <AssortmentStatusBadge status={row.assortmentStatus} />
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${storefrontTone(row.storefrontLabel)}`}
                    >
                      {row.storefrontLabel}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">{shopifyCommercialLabel(row)}</td>
                  <td className="px-3 py-3 text-xs text-muted">{joybuyLabel(row)}</td>
                  <td className="px-3 py-3">
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {row.issues.length === 0 ? (
                        <span className="text-xs text-muted">—</span>
                      ) : (
                        row.issues.map((issue) => (
                          <span
                            key={issue}
                            className="bg-sand/60 px-1.5 py-0.5 text-[10px] font-medium text-charcoal"
                          >
                            {issue}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold uppercase tracking-wider text-charcoal underline hover:text-sage"
                    >
                      Open PDP
                    </a>
                  </td>
                </tr>
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
