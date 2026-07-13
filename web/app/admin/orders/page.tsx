"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatFulfilmentStatus, formatOrderPrice } from "@/lib/format";
import { formatWeightKg } from "@/lib/weight";
import type { OrderListItem } from "@/types/order";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        ok ? "text-green-700" : "text-muted"
      }`}
    >
      <span aria-hidden>{ok ? "✅" : "—"}</span>
      {label}
    </span>
  );
}

async function downloadPackingSlip(orderId: string | number, orderNumber: string) {
  const response = await fetch(`/api/orders/${orderId}/packing-slip`);
  if (!response.ok) throw new Error(`Failed to download ${orderNumber}`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `packing-slip-${orderNumber}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState<"pdf" | "shopify" | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    const response = await fetch("/api/orders/list");
    const result = (await response.json()) as {
      success: boolean;
      orders?: OrderListItem[];
      error?: string;
    };
    if (!response.ok || !result.success) {
      throw new Error(result.error ?? "Could not load orders.");
    }
    setOrders(result.orders ?? []);
  }, []);

  useEffect(() => {
    loadOrders().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    }).finally(() => setLoading(false));
  }, [loadOrders]);

  const allSelected = orders.length > 0 && selected.size === orders.length;
  const someSelected = selected.size > 0;

  const selectedOrders = useMemo(
    () => orders.filter((o) => selected.has(String(o.id))),
    [orders, selected],
  );

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map((o) => String(o.id))));
    }
  }

  function toggleOne(id: string | number) {
    const key = String(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleBulkDownload() {
    setBulkLoading("pdf");
    setBulkMessage(null);
    setError(null);
    let succeeded = 0;
    try {
      for (const order of selectedOrders) {
        const orderNumber = order.order_number ?? String(order.id);
        await downloadPackingSlip(order.id, orderNumber);
        succeeded++;
        await new Promise((r) => setTimeout(r, 400));
      }
      setBulkMessage(`Downloaded ${succeeded} packing slip${succeeded === 1 ? "" : "s"}.`);
    } catch {
      setError(`Downloaded ${succeeded} of ${selectedOrders.length} before an error occurred.`);
    } finally {
      setBulkLoading(null);
    }
  }

  async function handleBulkShopify() {
    setBulkLoading("shopify");
    setBulkMessage(null);
    setError(null);
    let synced = 0;
    let failed = 0;
    for (const order of selectedOrders) {
      try {
        const response = await fetch(`/api/orders/${order.id}/shopify`, { method: "POST" });
        const result = (await response.json()) as { success: boolean };
        if (response.ok && result.success) synced++;
        else failed++;
      } catch {
        failed++;
      }
    }
    await loadOrders();
    setBulkMessage(
      `Shopify sync complete: ${synced} succeeded${failed > 0 ? `, ${failed} failed` : ""}.`,
    );
    setBulkLoading(null);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16">
      <header className="flex items-center justify-between pt-8 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Fulfilment</p>
          <h1 className="font-serif text-3xl text-espresso">Orders</h1>
        </div>
        <Link href="/" className="text-sm font-medium text-clay hover:text-cocoa">
          Shop &rarr;
        </Link>
      </header>

      {someSelected && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-linen px-4 py-3 ring-1 ring-sand/60">
          <span className="text-sm font-medium text-espresso">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={handleBulkDownload}
            disabled={bulkLoading !== null}
            className="rounded-full bg-cocoa px-4 py-2 text-xs font-semibold text-cream disabled:opacity-60"
          >
            {bulkLoading === "pdf" ? "Downloading…" : "Download PDFs"}
          </button>
          <button
            type="button"
            onClick={handleBulkShopify}
            disabled={bulkLoading !== null}
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-espresso ring-1 ring-sand disabled:opacity-60"
          >
            {bulkLoading === "shopify" ? "Pushing…" : "Push to Shopify"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted hover:text-cocoa"
          >
            Clear selection
          </button>
        </div>
      )}

      {bulkMessage && (
        <div className="mb-4 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800 ring-1 ring-green-200">
          {bulkMessage}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl bg-white/70 ring-1 ring-sand/50"
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-sand/60">
          <p className="font-serif text-xl text-espresso">No orders yet</p>
          <p className="mt-2 text-sm text-muted">
            Orders placed through the shop will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-sand/60">
          <div className="hidden border-b border-sand/60 px-4 py-3 text-xs font-medium uppercase tracking-widest text-muted sm:grid sm:grid-cols-[2rem_1.4fr_0.8fr_0.8fr_0.7fr_0.7fr] sm:items-center sm:gap-3">
            <label className="flex cursor-pointer items-center justify-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all orders"
                className="h-4 w-4 rounded border-sand text-cocoa focus:ring-clay"
              />
            </label>
            <span>Order</span>
            <span>Packing Slip</span>
            <span>Shopify</span>
            <span>Weight</span>
            <span>Status</span>
          </div>

          <div className="flex items-center gap-3 border-b border-sand/60 px-4 py-3 sm:hidden">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Select all orders"
              className="h-4 w-4 rounded border-sand text-cocoa focus:ring-clay"
            />
            <span className="text-sm font-medium text-espresso">Select all</span>
          </div>

          <ul className="divide-y divide-sand/60">
            {orders.map((order) => {
              const orderNumber = order.order_number ?? String(order.id);
              const shopifySynced = Boolean(order.shopify_draft_order_id);
              const isReady = order.fulfilment_status === "ready" || shopifySynced;
              const isChecked = selected.has(String(order.id));

              return (
                <li
                  key={String(order.id)}
                  className="px-4 py-4 sm:grid sm:grid-cols-[2rem_1.4fr_0.8fr_0.8fr_0.7fr_0.7fr] sm:items-center sm:gap-3"
                >
                  <label className="flex cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(order.id)}
                      aria-label={`Select order ${orderNumber}`}
                      className="h-4 w-4 rounded border-sand text-cocoa focus:ring-clay"
                    />
                  </label>

                  <div>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-serif text-lg text-espresso hover:text-cocoa"
                    >
                      {orderNumber}
                    </Link>
                    <p className="text-sm text-muted">
                      {order.customer_name} · {order.item_count}{" "}
                      {order.item_count === 1 ? "item" : "items"} ·{" "}
                      {formatOrderPrice(order.total, order.currency)}
                    </p>
                    {order.created_at && (
                      <p className="mt-0.5 text-xs text-muted">
                        {new Date(order.created_at).toLocaleString("en-GB")}
                      </p>
                    )}
                  </div>
                  <div>
                    <StatusBadge ok={true} label="PDF" />
                  </div>
                  <div>
                    <StatusBadge
                      ok={shopifySynced}
                      label={shopifySynced ? "Synced" : "Pending"}
                    />
                  </div>
                  <div className="text-sm text-espresso">
                    {formatWeightKg(order.total_weight_grams)}
                  </div>
                  <div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isReady
                          ? "bg-green-50 text-green-800 ring-1 ring-green-200"
                          : "bg-linen text-muted ring-1 ring-sand"
                      }`}
                    >
                      {formatFulfilmentStatus(isReady ? "ready" : order.fulfilment_status)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}
