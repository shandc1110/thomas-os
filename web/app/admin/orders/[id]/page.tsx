"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePackingSlipDownload, useShopify } from "@/hooks/useShopify";
import { formatFulfilmentStatus, formatOrderPrice } from "@/lib/format";
import { formatWeightKg } from "@/lib/weight";
import type { OrderWithItems } from "@/types/order";

type PageProps = {
  params: Promise<{ id: string }>;
};

function Notification({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  const styles =
    type === "success"
      ? "bg-green-50 text-green-800 ring-green-200"
      : "bg-red-50 text-red-700 ring-red-200";

  return (
    <div className={`rounded-2xl px-4 py-3 text-sm ring-1 ${styles}`}>{message}</div>
  );
}

export default function AdminOrderDetailPage({ params }: PageProps) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setOrderId(p.id));
  }, [params]);

  useEffect(() => {
    if (!orderId) return;

    async function load() {
      try {
        const response = await fetch(`/api/orders/${orderId}`);
        const result = (await response.json()) as {
          success: boolean;
          order?: OrderWithItems;
          error?: string;
        };
        if (!response.ok || !result.success || !result.order) {
          setError(result.error ?? "Order not found.");
          return;
        }
        setOrder(result.order);
      } catch {
        setError("Network error. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orderId]);

  const orderNumber = order?.order_number ?? orderId ?? "";
  const shopifySynced = Boolean(order?.shopify_draft_order_id);

  const {
    loading: pdfLoading,
    error: pdfError,
    downloadPackingSlip,
  } = usePackingSlipDownload(orderId ?? "", orderNumber);

  const {
    loading: shopifyLoading,
    error: shopifyError,
    success: shopifySuccess,
    synced,
    adminUrl,
    pushToShopify,
  } = useShopify(orderId ?? "", shopifySynced, order?.shopify_admin_url ?? null);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-20">
        <div className="h-48 animate-pulse rounded-3xl bg-white/70 ring-1 ring-sand/50" />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="font-serif text-3xl text-espresso">Order not found</h1>
        <p className="mt-3 text-sm text-muted">{error}</p>
        <Link
          href="/admin/orders"
          className="mt-8 rounded-full bg-cocoa px-6 py-3 text-sm font-semibold text-cream"
        >
          Back to orders
        </Link>
      </main>
    );
  }

  const isReady = order.fulfilment_status === "ready" || synced;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16">
      <header className="flex items-center justify-between pt-8 pb-6">
        <Link
          href="/admin/orders"
          className="text-sm font-medium text-clay hover:text-cocoa"
        >
          &larr; All orders
        </Link>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isReady
              ? "bg-green-50 text-green-800 ring-1 ring-green-200"
              : "bg-linen text-muted ring-1 ring-sand"
          }`}
        >
          {formatFulfilmentStatus(isReady ? "ready" : order.fulfilment_status)}
        </span>
      </header>

      <h1 className="font-serif text-3xl text-espresso">
        {order.order_number ?? order.id}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {order.created_at
          ? new Date(order.created_at).toLocaleString("en-GB", {
              dateStyle: "full",
              timeStyle: "short",
            })
          : ""}
      </p>

      {/* Fulfilment actions */}
      <section className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-sand/60">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
          Fulfilment
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadPackingSlip}
            disabled={pdfLoading}
            className="rounded-full bg-cocoa px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-espresso disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pdfLoading ? "Generating PDF…" : "Download Packing Slip"}
          </button>

          <button
            type="button"
            onClick={pushToShopify}
            disabled={shopifyLoading}
            className="rounded-full bg-linen px-5 py-2.5 text-sm font-semibold text-espresso ring-1 ring-sand transition-colors hover:bg-sand/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {shopifyLoading
              ? "Pushing to Shopify…"
              : synced
                ? "Already Synced"
                : "Push to Shopify"}
          </button>

          {(adminUrl || order.shopify_admin_url) && (
            <a
              href={adminUrl ?? order.shopify_admin_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-linen px-5 py-2.5 text-sm font-semibold text-espresso ring-1 ring-sand transition-colors hover:bg-sand/40"
            >
              Open Shopify
            </a>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {pdfError && <Notification type="error" message={pdfError} />}
          {shopifyError && <Notification type="error" message={shopifyError} />}
          {shopifySuccess && <Notification type="success" message={shopifySuccess} />}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-xl bg-linen px-3 py-2">
            <p className="text-xs text-muted">Packing Slip</p>
            <p className="font-medium text-green-700">✅ Ready</p>
          </div>
          <div className="rounded-xl bg-linen px-3 py-2">
            <p className="text-xs text-muted">Shopify</p>
            <p className={`font-medium ${synced ? "text-green-700" : "text-muted"}`}>
              {synced ? "✅ Synced" : "— Pending"}
            </p>
          </div>
          <div className="rounded-xl bg-linen px-3 py-2">
            <p className="text-xs text-muted">Weight</p>
            <p className="font-medium text-espresso">
              {formatWeightKg(order.total_weight_grams)}
            </p>
          </div>
          <div className="rounded-xl bg-linen px-3 py-2">
            <p className="text-xs text-muted">Total</p>
            <p className="font-medium text-espresso">
              {formatOrderPrice(order.total, order.currency)}
            </p>
          </div>
        </div>
      </section>

      {/* Customer details */}
      <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-sand/60">
        <h2 className="font-serif text-xl text-espresso">Customer</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 text-muted">First name</dt>
            <dd>{order.first_name ?? order.customer_name.split(" ")[0]}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 text-muted">Last name</dt>
            <dd>
              {(order.last_name ?? order.customer_name.split(" ").slice(1).join(" ")) || "—"}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 text-muted">Email</dt>
            <dd>{order.email}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 text-muted">WeChat ID</dt>
            <dd>{order.wechat_name}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 text-muted">Phone</dt>
            <dd>{order.phone}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 text-muted">Address</dt>
            <dd className="whitespace-pre-line">{order.address}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 text-muted">Postcode</dt>
            <dd>{order.postcode ?? "—"}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 text-muted">Payment</dt>
            <dd>
              {order.payment_method} · {order.currency}
            </dd>
          </div>
          {order.notes && (
            <div className="flex gap-4">
              <dt className="w-28 shrink-0 text-muted">Notes</dt>
              <dd>{order.notes}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Line items */}
      <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-sand/60">
        <h2 className="font-serif text-xl text-espresso">Items</h2>
        <ul className="mt-4 divide-y divide-sand/60">
          {order.items.map((item) => (
            <li key={String(item.id)} className="flex items-center gap-3 py-3 first:pt-0">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-espresso">{item.product_name}</p>
                <p className="text-xs text-muted">
                  {item.product_sku ? `SKU ${item.product_sku}` : "No SKU"}
                  {item.product_weight_grams
                    ? ` · ${item.product_weight_grams}g each`
                    : ""}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="text-espresso">×{item.quantity}</p>
                <p className="text-muted">
                  {formatOrderPrice(item.price * item.quantity, order.currency)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-sand/60 pt-4">
          <span className="font-serif text-lg text-espresso">Grand Total</span>
          <span className="font-serif text-lg text-espresso">
            {formatOrderPrice(order.total, order.currency)}
          </span>
        </div>
      </section>
    </main>
  );
}
