"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { convertCnyToGbp, getDisplayCnyToGbpMarkup, getDisplayCnyToGbpRate } from "@/lib/currency";
import { formatExpectedArrival } from "@/lib/presell";
import { formatOrderPrice } from "@/lib/format";
import type { ProductMaster } from "@/types/inventory";

type Filter = "in-transit" | "needs-price" | "all";

type Draft = {
  cost_price: string;
  price: string;
  shopify_price: string;
};

function toDraft(product: ProductMaster): Draft {
  return {
    cost_price: product.cost_price != null ? String(product.cost_price) : "",
    price: product.price != null ? String(product.price) : "",
    shopify_price: product.shopify_price != null ? String(product.shopify_price) : "",
  };
}

function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

/** Console formula: supplier cost × 1.25 + weight_kg × 14 × 1.25 */
function suggestedConsolePrice(costCny: number, weightGrams: number | null | undefined): number {
  const weightKg = Math.max((weightGrams ?? 0) / 1000, 0);
  return Math.round((costCny * 1.25 + weightKg * 14 * 1.25) * 100) / 100;
}

function needsPrice(product: ProductMaster): boolean {
  const consolePrice = product.price ?? product.retail_price;
  return consolePrice == null || consolePrice <= 0;
}

function isInTransit(product: ProductMaster): boolean {
  return Boolean(product.expected_arrival_month);
}

export default function PricingPage() {
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [filter, setFilter] = useState<Filter>("in-transit");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const rate = getDisplayCnyToGbpRate();
  const markup = getDisplayCnyToGbpMarkup();

  const load = useCallback(async () => {
    const response = await fetch("/api/inventory/products");
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    const rows = (result.products ?? []) as ProductMaster[];
    setProducts(rows);
    setDrafts(Object.fromEntries(rows.map((p) => [String(p.id), toDraft(p)])));
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);

  const filtered = useMemo(() => {
    let rows = products;
    if (filter === "in-transit") rows = rows.filter(isInTransit);
    if (filter === "needs-price") rows = rows.filter(needsPrice);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          p.sku?.toLowerCase().includes(term) ||
          p.name.toLowerCase().includes(term) ||
          p.brand?.toLowerCase().includes(term),
      );
    }
    return rows.slice().sort((a, b) => (a.sku ?? "").localeCompare(b.sku ?? ""));
  }, [products, filter, search]);

  function updateDraft(id: string, field: keyof Draft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  function applyConsoleFormula(id: string) {
    const product = products.find((p) => String(p.id) === id);
    const draft = drafts[id];
    if (!product || !draft) return;
    const cost = parseAmount(draft.cost_price) ?? product.cost_price;
    if (cost == null || cost <= 0) return;
    const consolePrice = suggestedConsolePrice(cost, product.weight_grams);
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], price: String(consolePrice) },
    }));
  }

  async function saveProduct(id: string) {
    const draft = drafts[id];
    if (!draft) return;

    setSavingId(id);
    setMessage(null);

    const consolePrice = parseAmount(draft.price);
    const response = await fetch(`/api/inventory/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "pricing",
        cost_price: parseAmount(draft.cost_price),
        price: consolePrice,
        retail_price: consolePrice,
        shopify_price: parseAmount(draft.shopify_price),
      }),
    });
    const result = await response.json();
    setSavingId(null);

    if (!result.success) {
      setMessage(result.error ?? "Could not save pricing.");
      return;
    }

    const product = result.product as ProductMaster;
    setProducts((prev) => prev.map((p) => (String(p.id) === id ? product : p)));
    setDrafts((prev) => ({ ...prev, [id]: toDraft(product) }));
    setMessage(`Saved ${product.sku ?? product.name}.`);
  }

  async function applyConsoleFormulaToBlank() {
    const targets = filtered.filter((p) => {
      const hasConsole = (p.price ?? p.retail_price ?? 0) > 0;
      return !hasConsole && (p.cost_price ?? 0) > 0;
    });
    if (targets.length === 0) {
      setMessage("No blank console prices with supplier cost in this view.");
      return;
    }

    setMessage(`Applying console formula to ${targets.length} blank product(s)…`);
    for (const product of targets) {
      const consolePrice = suggestedConsolePrice(product.cost_price!, product.weight_grams);
      const response = await fetch(`/api/inventory/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pricing",
          price: consolePrice,
          retail_price: consolePrice,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
    }
    await load();
    setMessage(`Set console prices for ${targets.length} product(s). Existing prices untouched. Shopify unchanged.`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl text-espresso">Pricing</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Console price (this portal):{" "}
          <span className="font-medium text-espresso">
            supplier cost × 1.25 + weight(kg) × 14 × 1.25
          </span>
          . Checkout GBP uses ¥{rate} × {markup}. Shopify price is set manually — never overwritten by
          the formula.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {(
          [
            ["in-transit", "In transit"],
            ["needs-price", "Needs price"],
            ["all", "All products"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              filter === value ? "bg-cocoa text-cream" : "bg-linen text-espresso ring-1 ring-sand"
            }`}
          >
            {label}
          </button>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search SKU or name…"
          className="min-w-[220px] flex-1 rounded-2xl border border-sand bg-white px-4 py-2.5 text-sm outline-none focus:border-clay"
        />
        <button
          type="button"
          onClick={applyConsoleFormulaToBlank}
          className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-cream"
        >
          Fill blank console prices
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800 ring-1 ring-green-200">
          {message}
        </div>
      )}

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/70" />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-sand/60">
          <table className="min-w-full text-sm">
            <thead className="border-b border-sand/60 text-left text-xs uppercase tracking-widest text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Arrival</th>
                <th className="px-4 py-3">Supplier cost</th>
                <th className="px-4 py-3">Console price</th>
                <th className="px-4 py-3">Checkout GBP</th>
                <th className="px-4 py-3">Shopify (manual)</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand/60">
              {filtered.map((product) => {
                const id = String(product.id);
                const draft = drafts[id] ?? toDraft(product);
                const consolePrice = parseAmount(draft.price);
                const gbp = consolePrice != null ? convertCnyToGbp(consolePrice) : null;
                const suggested =
                  (parseAmount(draft.cost_price) ?? product.cost_price ?? 0) > 0
                    ? suggestedConsolePrice(
                        parseAmount(draft.cost_price) ?? product.cost_price!,
                        product.weight_grams,
                      )
                    : null;

                return (
                  <tr key={id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/inventory/products/${id}`}
                        className="font-medium text-espresso hover:text-cocoa"
                      >
                        {product.name}
                      </Link>
                      <p className="text-xs text-muted">{product.sku ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatExpectedArrival(product.expected_arrival_month) ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.cost_price}
                        onChange={(e) => updateDraft(id, "cost_price", e.target.value)}
                        className="w-28 rounded-xl border border-sand px-3 py-2"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.price}
                        onChange={(e) => updateDraft(id, "price", e.target.value)}
                        placeholder={suggested != null ? String(suggested) : ""}
                        className="w-28 rounded-xl border border-sand px-3 py-2"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-espresso">
                      {gbp != null ? formatOrderPrice(gbp, "GBP") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.shopify_price}
                        onChange={(e) => updateDraft(id, "shopify_price", e.target.value)}
                        placeholder="Manual"
                        className="w-28 rounded-xl border border-sand px-3 py-2"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {suggested != null && (
                          <button
                            type="button"
                            onClick={() => applyConsoleFormula(id)}
                            className="rounded-full bg-linen px-3 py-1.5 text-xs font-semibold text-espresso ring-1 ring-sand"
                          >
                            Console formula
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => saveProduct(id)}
                          disabled={savingId === id}
                          className="rounded-full bg-cocoa px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-60"
                        >
                          {savingId === id ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">No products in this view.</p>
          )}
        </div>
      )}
    </div>
  );
}
