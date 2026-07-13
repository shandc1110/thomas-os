"use client";

import { useEffect, useState } from "react";
import type { Warehouse } from "@/types/warehouse";
import type { ProductMaster } from "@/types/inventory";

export default function ReceiveGoodsPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [poReference, setPoReference] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [lines, setLines] = useState<{ product_id: string | number; quantity_received: number; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/inventory/warehouses").then((r) => r.json()),
      fetch("/api/inventory/products").then((r) => r.json()),
    ]).then(([wh, prod]) => {
      if (wh.success) {
        setWarehouses(wh.warehouses ?? []);
        const defaultWh = wh.warehouses?.find((w: Warehouse) => w.is_default) ?? wh.warehouses?.[0];
        if (defaultWh) {
          setWarehouseId(defaultWh.id);
          setLocationId(defaultWh.locations?.[0]?.id ?? "");
        }
      }
      if (prod.success) setProducts(prod.products ?? []);
    });
  }, []);

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);

  function addLine() {
    const product = products.find((p) => String(p.id) === productId);
    if (!product || quantity <= 0) return;
    setLines((prev) => [
      ...prev,
      { product_id: product.id, quantity_received: quantity, name: product.name },
    ]);
    setProductId("");
    setQuantity(1);
  }

  async function submitReceipt() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/inventory/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id: warehouseId,
          location_id: locationId,
          po_reference: poReference || undefined,
          lines: lines.map((l) => ({
            product_id: l.product_id,
            quantity_received: l.quantity_received,
          })),
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage(`Receipt ${result.receipt.receipt_number} completed.`);
      setLines([]);
      setPoReference("");
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="font-serif text-xl text-espresso">Goods Receiving</h2>

      <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-sand/60">
        <label className="block text-sm">
          <span className="font-medium text-espresso">Warehouse</span>
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              const wh = warehouses.find((w) => w.id === e.target.value);
              setLocationId(wh?.locations?.[0]?.id ?? "");
            }}
            className="mt-1 w-full rounded-2xl border border-sand px-4 py-2.5 text-sm"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-espresso">Location</span>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-sand px-4 py-2.5 text-sm"
          >
            {(selectedWarehouse?.locations ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.code}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-espresso">PO Reference (optional)</span>
          <input
            value={poReference}
            onChange={(e) => setPoReference(e.target.value)}
            placeholder="PO1008"
            className="mt-1 w-full rounded-2xl border border-sand px-4 py-2.5 text-sm"
          />
        </label>
      </div>

      <div className="rounded-2xl bg-white p-5 ring-1 ring-sand/60">
        <h3 className="text-sm font-semibold text-espresso">Add line</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="flex-1 rounded-2xl border border-sand px-4 py-2.5 text-sm"
          >
            <option value="">Select product…</option>
            {products.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {p.sku} — {p.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-24 rounded-2xl border border-sand px-4 py-2.5 text-sm"
          />
          <button
            type="button"
            onClick={addLine}
            className="rounded-full bg-linen px-4 py-2 text-xs font-semibold ring-1 ring-sand"
          >
            Add
          </button>
        </div>

        {lines.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {lines.map((l, i) => (
              <li key={i} className="flex justify-between">
                <span>{l.name}</span>
                <span className="font-semibold">+{l.quantity_received}</span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={submitReceipt}
          disabled={submitting || lines.length === 0}
          className="mt-4 w-full rounded-full bg-cocoa py-3 text-sm font-semibold text-cream disabled:opacity-60"
        >
          {submitting ? "Receiving…" : "Confirm Receipt"}
        </button>
      </div>

      {message && (
        <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800 ring-1 ring-green-200">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
