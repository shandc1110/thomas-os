"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StockTakeSession } from "@/types/warehouse";
import type { ProductMaster } from "@/types/inventory";

type PageProps = { params: Promise<{ id: string }> };

export default function StockTakeSessionPage({ params }: PageProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<StockTakeSession | null>(null);
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [barcode, setBarcode] = useState("");
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [counted, setCounted] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setSessionId(p.id));
  }, [params]);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/inventory/stock-take?session=${sessionId}`)
      .then((r) => r.json())
      .then((result) => {
        if (result.success) setSession(result.session);
      });
    fetch("/api/inventory/products")
      .then((r) => r.json())
      .then((result) => {
        if (result.success) setProducts(result.products ?? []);
      });
  }, [sessionId]);

  async function scanBarcode() {
    if (!barcode.trim()) return;
    const response = await fetch(`/api/inventory/barcode?code=${encodeURIComponent(barcode)}`);
    const result = await response.json();
    if (result.success) {
      setProductId(String(result.product.id));
      setMessage(`Found: ${result.product.name}`);
    } else {
      setMessage("Product not found for barcode.");
    }
  }

  async function addCount() {
    if (!sessionId || !productId || !locationId) return;
    setSubmitting(true);
    const response = await fetch(`/api/inventory/stock-take/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, location_id: locationId, counted_quantity: counted }),
    });
    const result = await response.json();
    setSubmitting(false);
    if (result.success) {
      setMessage(`Counted. Variance: ${result.variance > 0 ? "+" : ""}${result.variance}`);
      const refresh = await fetch(`/api/inventory/stock-take?session=${sessionId}`);
      const data = await refresh.json();
      if (data.success) setSession(data.session);
    }
  }

  async function approve() {
    if (!sessionId) return;
    setSubmitting(true);
    const response = await fetch(`/api/inventory/stock-take/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    const result = await response.json();
    setSubmitting(false);
    if (result.success) {
      setMessage("Stock take approved. Adjustments applied.");
      const refresh = await fetch(`/api/inventory/stock-take?session=${sessionId}`);
      const data = await refresh.json();
      if (data.success) setSession(data.session);
    }
  }

  if (!session) return <div className="h-48 animate-pulse rounded-2xl bg-white/70" />;

  return (
    <div className="space-y-6">
      <Link href="/admin/inventory/stock-take" className="text-sm text-clay hover:text-cocoa">
        &larr; All sessions
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-espresso">{session.session_number}</h2>
          <p className="text-sm text-muted">
            {session.warehouse?.name} · {session.status}
          </p>
        </div>
        {session.status === "in_progress" && (
          <button
            type="button"
            onClick={approve}
            disabled={submitting}
            className="rounded-full bg-cocoa px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-60"
          >
            Approve & Apply
          </button>
        )}
      </div>

      {session.status === "in_progress" && (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
          <h3 className="text-sm font-semibold text-espresso">Scan / Count Product</h3>
          <div className="mt-3 flex gap-2">
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan barcode…"
              className="flex-1 rounded-2xl border border-sand px-4 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={scanBarcode}
              className="rounded-full bg-linen px-4 py-2 text-xs font-semibold ring-1 ring-sand"
            >
              Search
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="rounded-2xl border border-sand px-4 py-2.5 text-sm"
            >
              <option value="">Product…</option>
              {products.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={counted}
              onChange={(e) => setCounted(Number(e.target.value))}
              placeholder="Counted qty"
              className="rounded-2xl border border-sand px-4 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={addCount}
              disabled={submitting}
              className="rounded-full bg-cocoa py-2.5 text-sm font-semibold text-cream disabled:opacity-60"
            >
              Record Count
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-2xl bg-linen px-4 py-3 text-sm text-espresso ring-1 ring-sand">
          {message}
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
        <h3 className="font-serif text-lg text-espresso">Variance Report</h3>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted">
              <th className="pb-2">Product</th>
              <th>System</th>
              <th>Counted</th>
              <th>Variance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(session.lines ?? []).map((line) => (
              <tr key={line.id} className="border-t border-sand/40">
                <td className="py-2">{line.product?.name}</td>
                <td>{line.system_quantity}</td>
                <td>{line.counted_quantity ?? "—"}</td>
                <td className={line.variance && line.variance !== 0 ? "font-semibold text-amber-700" : ""}>
                  {line.variance != null ? (line.variance > 0 ? "+" : "") + line.variance : "—"}
                </td>
                <td>{line.approved ? "✅" : "Pending"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
