"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatOrderPrice } from "@/lib/format";
import type { OrderConsolidationRecord } from "@/types/consolidation";

export default function ConsolidationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [consolidation, setConsolidation] = useState<OrderConsolidationRecord | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (consolidationId: string) => {
    setError(null);
    const response = await fetch(`/api/orders/consolidations/${consolidationId}`);
    const result = (await response.json()) as {
      success: boolean;
      consolidation?: OrderConsolidationRecord;
      error?: string;
    };
    if (!response.ok || !result.success || !result.consolidation) {
      throw new Error(result.error ?? "Not found.");
    }
    setConsolidation(result.consolidation);
  }, []);

  useEffect(() => {
    if (!id) return;
    load(id)
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed."))
      .finally(() => setLoading(false));
  }, [id, load]);

  async function removeOrder(orderId: string) {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/consolidations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_order", order_id: orderId }),
      });
      const result = (await response.json()) as {
        success: boolean;
        consolidation?: OrderConsolidationRecord;
        error?: string;
      };
      if (!response.ok || !result.success || !result.consolidation) {
        throw new Error(result.error ?? "Could not remove order.");
      }
      setConsolidation(result.consolidation);
      setMessage("Order removed from draft consolidation.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
    } finally {
      setBusy(false);
    }
  }

  async function generateInvoice() {
    if (!id) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/orders/consolidations/${id}/invoice`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        success: boolean;
        invoice?: { invoice_number: string };
        error?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Invoice failed.");
      }
      setMessage(`Invoice ${result.invoice?.invoice_number} ready.`);
      await load(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invoice failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !consolidation) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        {error ? (
          <p className="text-sm text-red-800">{error}</p>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 pb-16">
      <Link
        href="/admin/orders/consolidations"
        className="text-sm font-semibold text-cocoa hover:underline"
      >
        ← Consolidations
      </Link>

      <header className="mt-4 mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">
          {consolidation.status}
        </p>
        <h1 className="font-serif text-3xl text-espresso">
          {consolidation.consolidation_number}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {consolidation.customer_name} · {consolidation.customer_email}
        </p>
        <p className="mt-1 whitespace-pre-line text-sm">
          {consolidation.delivery_address_snapshot}
          {consolidation.postcode_snapshot
            ? `\n${consolidation.postcode_snapshot}`
            : ""}
        </p>
        {consolidation.delivery_review_required && (
          <p className="mt-2 text-sm text-amber-800">
            Delivery review required — source orders have no delivery fee field.
            Invoice delivery = £0.
          </p>
        )}
      </header>

      {error && (
        <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}
      {message && (
        <p className="mb-4 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </p>
      )}

      <section className="rounded-3xl bg-white p-5 ring-1 ring-sand/60">
        <h2 className="font-serif text-xl text-espresso">Orders</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(consolidation.orders ?? []).map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-sand/50 py-2"
            >
              <div>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="font-medium text-cocoa hover:underline"
                >
                  {o.order_number ?? o.id}
                </Link>
                <span className="ml-2 text-muted">{o.fulfilment_status}</span>
              </div>
              <div className="flex items-center gap-3">
                <span>
                  {formatOrderPrice(
                    o.merchandise_total,
                    o.currency ?? consolidation.currency,
                  )}
                </span>
                {consolidation.status === "draft" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeOrder(o.id)}
                    className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-sand pt-4 text-sm">
          <div className="flex justify-between">
            <span>Merchandise</span>
            <span>
              {formatOrderPrice(consolidation.merchandise_total, consolidation.currency)}
            </span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Delivery / Discount / VAT</span>
            <span>£0.00</span>
          </div>
          <div className="mt-2 flex justify-between font-semibold">
            <span>Total</span>
            <span>
              {formatOrderPrice(consolidation.grand_total, consolidation.currency)}
            </span>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        {consolidation.status !== "cancelled" && (
          <button
            type="button"
            disabled={busy}
            onClick={generateInvoice}
            className="rounded-2xl bg-cocoa px-5 py-3 text-sm font-bold text-cream disabled:opacity-60"
          >
            {busy
              ? "Working…"
              : consolidation.invoice
                ? "Regenerate invoice"
                : "Generate invoice"}
          </button>
        )}
        {consolidation.invoice?.pdf_storage_path && (
          <a
            href={`/api/orders/consolidations/${consolidation.id}/invoice/download`}
            className="rounded-2xl bg-linen px-5 py-3 text-sm font-semibold ring-1 ring-sand"
          >
            Download PDF ({consolidation.invoice.invoice_number})
          </a>
        )}
      </div>
    </main>
  );
}
