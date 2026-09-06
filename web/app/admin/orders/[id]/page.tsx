"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { usePackingSlipDownload, useShopify } from "@/hooks/useShopify";
import { formatFulfilmentStatus, formatOrderPrice, formatPaymentStatus } from "@/lib/format";
import { formatWeightKg } from "@/lib/weight";
import type { OrderWithItems } from "@/types/order";

type AdjacentOrderRef = {
  id: string | number;
  order_number: string | null;
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

function OrderNavButton({
  href,
  label,
  orderNumber,
  disabled,
  align,
}: {
  href: string | null;
  label: string;
  orderNumber?: string | null;
  disabled: boolean;
  align: "left" | "right";
}) {
  const base =
    "inline-flex min-w-[8.5rem] flex-col rounded-full px-4 py-2.5 text-sm ring-1 transition-colors";
  if (disabled || !href) {
    return (
      <span
        className={`${base} cursor-not-allowed bg-linen/50 text-muted ring-sand/40 ${
          align === "right" ? "items-end text-right" : "items-start text-left"
        }`}
        aria-disabled="true"
      >
        <span className="font-semibold">{label}</span>
        <span className="text-xs">End of list</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} bg-white text-espresso ring-sand/60 hover:bg-linen hover:ring-clay/40 ${
        align === "right" ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <span className="font-semibold">{label}</span>
      {orderNumber ? <span className="text-xs text-muted">{orderNumber}</span> : null}
    </Link>
  );
}

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = typeof params.id === "string" ? params.id : null;
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [previous, setPrevious] = useState<AdjacentOrderRef | null>(null);
  const [next, setNext] = useState<AdjacentOrderRef | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"fulfill" | "cancel" | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setActionMessage(null);
      try {
        const response = await fetch(`/api/orders/${orderId}`);
        const result = (await response.json()) as {
          success: boolean;
          order?: OrderWithItems;
          previous?: AdjacentOrderRef | null;
          next?: AdjacentOrderRef | null;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok || !result.success || !result.order) {
          setOrder(null);
          setPrevious(null);
          setNext(null);
          setError(result.error ?? "Order not found.");
          return;
        }
        setOrder(result.order);
        setPrevious(result.previous ?? null);
        setNext(result.next ?? null);
      } catch {
        if (!cancelled) {
          setOrder(null);
          setPrevious(null);
          setNext(null);
          setError("Network error. Please refresh the page.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
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

  async function runOrderAction(action: "fulfill" | "cancel") {
    if (!orderId) return;
    const confirmMsg =
      action === "cancel"
        ? "Cancel this order and restore stock?"
        : "Mark this order as fulfilled?";
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(action);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json()) as {
        success: boolean;
        order?: OrderWithItems;
        error?: string;
      };
      if (!response.ok || !result.success || !result.order) {
        setActionMessage({ type: "error", message: result.error ?? "Action failed." });
        return;
      }
      setOrder(result.order);
      setActionMessage({
        type: "success",
        message:
          action === "cancel" ? "Order cancelled. Stock restored." : "Order marked as fulfilled.",
      });
    } catch {
      setActionMessage({ type: "error", message: "Network error. Please try again." });
    } finally {
      setActionLoading(null);
    }
  }

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

  const isCancelled =
    order.fulfilment_status === "cancelled" || order.warehouse_status === "cancelled";
  const isFulfilled =
    order.fulfilment_status === "fulfilled" ||
    order.warehouse_status === "shipped" ||
    order.warehouse_status === "delivered";
  const isReady = !isCancelled && !isFulfilled && (order.fulfilment_status === "ready" || synced);
  const canCancel = !isCancelled && !isFulfilled;
  const canFulfill = !isCancelled && !isFulfilled;

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
            isCancelled
              ? "bg-red-50 text-red-800 ring-1 ring-red-200"
              : isFulfilled
                ? "bg-green-50 text-green-800 ring-1 ring-green-200"
                : isReady
                  ? "bg-green-50 text-green-800 ring-1 ring-green-200"
                  : "bg-linen text-muted ring-1 ring-sand"
          }`}
        >
          {formatFulfilmentStatus(
            isCancelled
              ? "cancelled"
              : isFulfilled
                ? "fulfilled"
                : isReady
                  ? "ready"
                  : order.fulfilment_status,
          )}
        </span>
      </header>

      <nav
        className="mb-6 flex items-center justify-between gap-3"
        aria-label="Order navigation"
      >
        <OrderNavButton
          href={previous ? `/admin/orders/${previous.id}` : null}
          label="← Previous"
          orderNumber={previous?.order_number}
          disabled={!previous}
          align="left"
        />
        <OrderNavButton
          href={next ? `/admin/orders/${next.id}` : null}
          label="Next →"
          orderNumber={next?.order_number}
          disabled={!next}
          align="right"
        />
      </nav>

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

          {canFulfill && (
            <button
              type="button"
              onClick={() => runOrderAction("fulfill")}
              disabled={actionLoading !== null}
              className="rounded-full bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading === "fulfill" ? "Marking…" : "Mark as Fulfilled"}
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={() => runOrderAction("cancel")}
              disabled={actionLoading !== null}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-red-700 ring-1 ring-red-200 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading === "cancel" ? "Cancelling…" : "Cancel Order"}
            </button>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {pdfError && <Notification type="error" message={pdfError} />}
          {shopifyError && <Notification type="error" message={shopifyError} />}
          {shopifySuccess && <Notification type="success" message={shopifySuccess} />}
          {actionMessage && (
            <Notification type={actionMessage.type} message={actionMessage.message} />
          )}
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
              {order.payment_status !== "unpaid" && (
                <span className="ml-2 rounded-full bg-linen px-2 py-0.5 text-xs font-medium text-espresso ring-1 ring-sand">
                  {formatPaymentStatus(order.payment_status)}
                </span>
              )}
              {order.paid_at && (
                <span className="mt-1 block text-xs text-muted">
                  Paid {new Date(order.paid_at).toLocaleString("en-GB")}
                </span>
              )}
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

      <nav
        className="mt-8 flex items-center justify-between gap-3"
        aria-label="Order navigation"
      >
        <OrderNavButton
          href={previous ? `/admin/orders/${previous.id}` : null}
          label="← Previous"
          orderNumber={previous?.order_number}
          disabled={!previous}
          align="left"
        />
        <OrderNavButton
          href={next ? `/admin/orders/${next.id}` : null}
          label="Next →"
          orderNumber={next?.order_number}
          disabled={!next}
          align="right"
        />
      </nav>
    </main>
  );
}
