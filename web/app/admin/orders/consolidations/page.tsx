"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatOrderPrice } from "@/lib/format";
import type {
  ConsolidationCandidateGroup,
  OrderConsolidationRecord,
} from "@/types/consolidation";

export default function AdminConsolidationsPage() {
  const [tab, setTab] = useState<"candidates" | "consolidations">("candidates");
  const [candidates, setCandidates] = useState<ConsolidationCandidateGroup[]>([]);
  const [consolidations, setConsolidations] = useState<OrderConsolidationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [cRes, listRes] = await Promise.all([
      fetch("/api/orders/consolidations?candidates=1"),
      fetch("/api/orders/consolidations"),
    ]);
    const cJson = (await cRes.json()) as {
      success: boolean;
      candidates?: ConsolidationCandidateGroup[];
      error?: string;
    };
    const lJson = (await listRes.json()) as {
      success: boolean;
      consolidations?: OrderConsolidationRecord[];
      error?: string;
    };
    if (!cRes.ok || !cJson.success) {
      throw new Error(cJson.error ?? "Could not load candidates.");
    }
    if (!listRes.ok || !lJson.success) {
      throw new Error(lJson.error ?? "Could not load consolidations.");
    }
    setCandidates(cJson.candidates ?? []);
    setConsolidations(lJson.consolidations ?? []);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Load failed.");
      })
      .finally(() => setLoading(false));
  }, [load]);

  async function createFromCandidate(group: ConsolidationCandidateGroup) {
    setBusyKey(group.match_key);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/orders/consolidations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_ids: group.orders.map((o) => o.id),
        }),
      });
      const result = (await response.json()) as {
        success: boolean;
        consolidation?: OrderConsolidationRecord;
        error?: string;
      };
      if (!response.ok || !result.success || !result.consolidation) {
        throw new Error(result.error ?? "Could not create consolidation.");
      }
      setMessage(`Created ${result.consolidation.consolidation_number}.`);
      await load();
      setTab("consolidations");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function generateInvoice(id: string) {
    setBusyKey(id);
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
        throw new Error(result.error ?? "Invoice generation failed.");
      }
      setMessage(`Invoice ${result.invoice?.invoice_number} ready.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invoice failed.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-16">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Orders</p>
          <h1 className="font-serif text-3xl text-espresso">Consolidations</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Group compatible orders (same name, email, and delivery address) into one
            invoice. Original orders stay unchanged.
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="rounded-full bg-linen px-4 py-2 text-sm font-semibold text-espresso ring-1 ring-sand hover:bg-sand/40"
        >
          All orders
        </Link>
      </header>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("candidates")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            tab === "candidates"
              ? "bg-cocoa text-cream"
              : "bg-white text-espresso ring-1 ring-sand"
          }`}
        >
          Candidates ({candidates.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("consolidations")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            tab === "consolidations"
              ? "bg-cocoa text-cream"
              : "bg-white text-espresso ring-1 ring-sand"
          }`}
        >
          Consolidations ({consolidations.length})
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800 ring-1 ring-green-100">
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : tab === "candidates" ? (
        <div className="space-y-4">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted">No eligible consolidation groups right now.</p>
          ) : (
            candidates.map((group) => (
              <section
                key={group.match_key}
                className="rounded-3xl bg-white p-5 ring-1 ring-sand/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl text-espresso">{group.customer_name}</h2>
                    <p className="text-sm text-muted">{group.customer_email}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-espresso">
                      {group.delivery_address}
                      {group.postcode ? `\n${group.postcode}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      {group.order_count} orders · {group.item_count} units
                    </p>
                    <p className="font-semibold">
                      {formatOrderPrice(group.merchandise_total, group.currency)}
                    </p>
                    <p className="text-xs text-amber-700">Delivery review required</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-1 text-sm">
                  {group.orders.map((o) => (
                    <li key={o.id} className="flex flex-wrap gap-x-3 gap-y-1">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-medium text-cocoa hover:underline"
                      >
                        {o.order_number ?? o.id}
                      </Link>
                      <span className="text-muted">{o.fulfilment_status}</span>
                      <span>
                        {formatOrderPrice(o.merchandise_total, o.currency ?? group.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busyKey === group.match_key}
                  onClick={() => createFromCandidate(group)}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-cocoa px-5 text-sm font-bold text-cream disabled:opacity-60"
                >
                  {busyKey === group.match_key ? "Creating…" : "Create consolidation"}
                </button>
              </section>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {consolidations.length === 0 ? (
            <p className="text-sm text-muted">No consolidations yet.</p>
          ) : (
            consolidations.map((c) => (
              <section
                key={c.id}
                className="rounded-3xl bg-white p-5 ring-1 ring-sand/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/orders/consolidations/${c.id}`}
                      className="font-serif text-xl text-espresso hover:text-cocoa"
                    >
                      {c.consolidation_number}
                    </Link>
                    <p className="text-sm text-muted">
                      {c.customer_name} · {c.customer_email}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-clay">
                      {c.status}
                      {c.delivery_review_required ? " · delivery review" : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      {c.order_count ?? 0} orders · {c.item_count ?? 0} units
                    </p>
                    <p className="font-semibold">
                      {formatOrderPrice(c.grand_total, c.currency)}
                    </p>
                    {c.invoice?.invoice_number && (
                      <p className="text-xs text-muted">{c.invoice.invoice_number}</p>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {(c.order_numbers ?? []).join(", ")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/orders/consolidations/${c.id}`}
                    className="rounded-full bg-linen px-4 py-2 text-sm font-semibold ring-1 ring-sand"
                  >
                    Open
                  </Link>
                  {c.status !== "cancelled" && (
                    <button
                      type="button"
                      disabled={busyKey === c.id}
                      onClick={() => generateInvoice(c.id)}
                      className="rounded-full bg-cocoa px-4 py-2 text-sm font-bold text-cream disabled:opacity-60"
                    >
                      {busyKey === c.id
                        ? "Generating…"
                        : c.invoice
                          ? "Regenerate invoice"
                          : "Generate invoice"}
                    </button>
                  )}
                  {c.invoice?.pdf_storage_path && (
                    <a
                      href={`/api/orders/consolidations/${c.id}/invoice/download`}
                      className="rounded-full bg-linen px-4 py-2 text-sm font-semibold ring-1 ring-sand"
                    >
                      Download PDF
                    </a>
                  )}
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </main>
  );
}
