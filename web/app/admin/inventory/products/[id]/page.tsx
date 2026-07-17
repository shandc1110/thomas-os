"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatOrderPrice } from "@/lib/format";
import { ARRIVAL_MONTH_OPTIONS, formatExpectedArrival } from "@/lib/presell";
import type { ProductMaster, InventoryBalance, ProductLedgerEntry } from "@/types/inventory";

type PageProps = { params: Promise<{ id: string }> };

function PresellPanel({
  product,
  onSaved,
}: {
  product: ProductMaster;
  onSaved: (p: ProductMaster) => void;
}) {
  const [enabled, setEnabled] = useState(Boolean(product.presell_enabled));
  const [quantity, setQuantity] = useState(product.presell_quantity ?? 0);
  const [arrivalMonth, setArrivalMonth] = useState(product.expected_arrival_month ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(Boolean(product.presell_enabled));
    setQuantity(product.presell_quantity ?? 0);
    setArrivalMonth(product.expected_arrival_month ?? "");
  }, [product]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/inventory/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "presell",
        presell_enabled: enabled,
        presell_quantity: quantity,
        expected_arrival_month: arrivalMonth || null,
      }),
    });
    const result = await res.json();
    setSaving(false);
    if (!result.success) {
      setMessage(result.error ?? "Could not save pre-sell settings.");
      return;
    }
    onSaved(result.product);
    setMessage("Pre-sell settings saved.");
  }

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
      <h3 className="font-serif text-lg text-espresso">Pre-sell (in transit)</h3>
      <p className="mt-1 text-sm text-muted">
        Sell units before they arrive in the warehouse. Customers see the expected arrival month on the shop.
      </p>

      <div className="mt-4 space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-sand"
          />
          Enable pre-sell for this product
        </label>

        <label className="block text-sm">
          <span className="font-medium text-espresso">Pre-sell quantity (in shipment)</span>
          <input
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="mt-1.5 w-full max-w-xs rounded-2xl border border-sand px-4 py-2.5"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-espresso">Expected arrival</span>
          <select
            value={arrivalMonth}
            onChange={(e) => setArrivalMonth(e.target.value)}
            className="mt-1.5 w-full max-w-xs rounded-2xl border border-sand px-4 py-2.5"
          >
            <option value="">Select month…</option>
            {ARRIVAL_MONTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {arrivalMonth && (
          <p className="text-xs text-muted">
            Shop label: Pre-order · {formatExpectedArrival(arrivalMonth)}
          </p>
        )}

        {message && (
          <p className={`text-sm ${message.includes("saved") ? "text-green-700" : "text-red-700"}`}>
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-cocoa px-5 py-2 text-sm font-semibold text-cream disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save pre-sell"}
        </button>
      </div>
    </section>
  );
}

export default function ProductDetailPage({ params }: PageProps) {
  const [productId, setProductId] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductMaster | null>(null);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [ledger, setLedger] = useState<ProductLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setProductId(p.id));
  }, [params]);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/inventory/products/${productId}?include=balances,ledger`)
      .then((r) => r.json())
      .then((result) => {
        if (result.success) {
          setProduct(result.product);
          setBalances(result.balances ?? []);
          setLedger(result.ledger ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) return <div className="h-48 animate-pulse rounded-2xl bg-white/70" />;
  if (!product) return <p className="text-muted">Product not found.</p>;

  const totalAvailable = balances.reduce((s, b) => s + b.available, 0);

  return (
    <div className="space-y-6">
      <Link href="/admin/inventory/products" className="text-sm text-clay hover:text-cocoa">
        &larr; All products
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-espresso">{product.name}</h2>
          <p className="text-sm text-muted">
            SKU {product.sku} · {product.brand ?? "No brand"}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/inventory/products/${product.id}/barcode?format=ean`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-linen px-4 py-2 text-xs font-semibold ring-1 ring-sand"
          >
            View Barcode
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["On hand", totalAvailable],
          ["Pre-sell", product.presell_enabled ? product.presell_quantity ?? 0 : 0],
          ["Cost", formatOrderPrice(product.cost_price, product.currency)],
          ["Retail", formatOrderPrice(product.retail_price ?? product.price, product.currency)],
          ["Weight", product.weight_grams ? `${product.weight_grams}g` : "—"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-white p-4 ring-1 ring-sand/60">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 font-semibold text-espresso">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
        <h3 className="font-serif text-lg text-espresso">Product Master</h3>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["Barcode", product.barcode],
            ["Category", product.category],
            ["HS Code", product.hs_code],
            ["Origin", product.country_of_origin],
            ["Dimensions", product.length_mm ? `${product.length_mm}×${product.width_mm}×${product.height_mm} mm` : "—"],
            ["Wholesale", formatOrderPrice(product.wholesale_price, product.currency)],
            ["Low stock at", product.low_stock_threshold],
            ["Tags", product.tags?.join(", ") || "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex gap-3">
              <dt className="w-28 shrink-0 text-muted">{k}</dt>
              <dd>{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <PresellPanel product={product} onSaved={setProduct} />

      {balances.length > 0 && (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
          <h3 className="font-serif text-lg text-espresso">Inventory by Location</h3>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-muted">
                <th className="pb-2">Warehouse</th>
                <th>Location</th>
                <th>Available</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.id} className="border-t border-sand/40">
                  <td className="py-2">{b.warehouse?.name}</td>
                  <td>{b.location?.code}</td>
                  <td>{b.available}</td>
                  <td>{b.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
        <h3 className="font-serif text-lg text-espresso">Stock Ledger</h3>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted">
              <th className="pb-2">Date</th>
              <th>Event</th>
              <th>Qty</th>
              <th>Balance</th>
              <th>Ref</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((entry, i) => (
              <tr key={i} className="border-t border-sand/40">
                <td className="py-2 text-muted">
                  {new Date(entry.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </td>
                <td>{entry.description}</td>
                <td className={entry.quantity < 0 ? "text-red-700" : "text-green-700"}>
                  {entry.quantity > 0 ? "+" : ""}
                  {entry.quantity}
                </td>
                <td className="font-semibold">{entry.balance}</td>
                <td className="text-muted">{entry.reference ?? "—"}</td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted">
                  No movements recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
