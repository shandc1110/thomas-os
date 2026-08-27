"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type JoybuyStatusPayload = {
  appName: string;
  businessType: string;
  appType: string;
  reviewStatus: string;
  connection: string;
  products: string;
  inventory: string;
  orders: string;
  channel: {
    status: string;
    detail: string;
  };
  credentials: {
    appKey: boolean;
    appSecret: boolean;
    accessToken: boolean;
    apiBaseUrl: boolean;
    callbackUrl: boolean;
    configured: boolean;
  };
};

type ActionMessage = { tone: "info" | "error"; text: string };

function labelConnection(value: string): string {
  if (value === "not_configured") return "Not configured";
  if (value === "credentials_present_api_pending") {
    return "Credentials present — API adapter pending";
  }
  return value;
}

function labelReady(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function JoybuyIntegrationsPage() {
  const [status, setStatus] = useState<JoybuyStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<ActionMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/integrations/joybuy/status")
      .then(async (response) => {
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error ?? "Failed to load Joybuy status.");
        }
        if (!cancelled) setStatus(result.status as JoybuyStatusPayload);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function runSync(kind: "products" | "inventory" | "orders") {
    setBusy(kind);
    setMessage(null);
    try {
      const response = await fetch("/api/integrations/joybuy/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const result = await response.json();
      if (result.success) {
        setMessage({
          tone: "info",
          text: `Unexpected success for ${kind} — verify adapter before production use.`,
        });
      } else {
        setMessage({
          tone: "error",
          text:
            result.message ??
            result.error ??
            "Joybuy integration is not yet configured.",
        });
      }
    } catch (e) {
      setMessage({
        tone: "error",
        text: e instanceof Error ? e.message : "Request failed.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 pb-16">
      <div className="mb-6">
        <Link href="/admin" className="text-sm font-medium text-clay hover:text-cocoa">
          &larr; Admin console
        </Link>
      </div>

      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Integrations</p>
        <h1 className="mt-2 font-serif text-4xl text-espresso">Joybuy</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Joybuy Open Platform as a sales channel. Thomas OS remains the source of truth for
          products, inventory, pricing, and fulfilment.
        </p>
      </header>

      {loading && <p className="text-sm text-muted">Loading status…</p>}
      {error && (
        <p className="rounded-2xl bg-white px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {status && (
        <section className="space-y-4 rounded-3xl bg-white p-6 ring-1 ring-sand/60">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Status</dt>
              <dd className="mt-1 font-semibold text-espresso">Pending Review</dd>
            </div>
            <div>
              <dt className="text-muted">App</dt>
              <dd className="mt-1 font-semibold text-espresso">{status.appName}</dd>
            </div>
            <div>
              <dt className="text-muted">Connection</dt>
              <dd className="mt-1 font-semibold text-espresso">
                {labelConnection(status.connection)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Channel state</dt>
              <dd className="mt-1 font-semibold text-espresso capitalize">
                {status.channel.status}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Products</dt>
              <dd className="mt-1 font-semibold text-espresso">
                {labelReady(status.products)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Inventory</dt>
              <dd className="mt-1 font-semibold text-espresso">
                {labelReady(status.inventory)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Orders</dt>
              <dd className="mt-1 font-semibold text-espresso">
                {labelReady(status.orders)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Business type</dt>
              <dd className="mt-1 font-semibold text-espresso">{status.businessType}</dd>
            </div>
          </dl>

          <p className="text-xs text-muted">{status.channel.detail}</p>

          <div className="rounded-2xl bg-linen/80 px-4 py-3 text-xs text-muted">
            <p className="font-semibold text-espresso">Credential presence (booleans only)</p>
            <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
              <li>App key: {status.credentials.appKey ? "set" : "missing"}</li>
              <li>App secret: {status.credentials.appSecret ? "set" : "missing"}</li>
              <li>Access token: {status.credentials.accessToken ? "set" : "missing"}</li>
              <li>API base URL: {status.credentials.apiBaseUrl ? "set" : "missing"}</li>
              <li>Callback URL: {status.credentials.callbackUrl ? "set" : "missing"}</li>
            </ul>
          </div>

          {message && (
            <p
              className={`rounded-2xl px-4 py-3 text-sm ring-1 ${
                message.tone === "error"
                  ? "bg-red-50 text-red-800 ring-red-200"
                  : "bg-linen text-espresso ring-sand"
              }`}
            >
              {message.text}
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() =>
                setMessage({
                  tone: "info",
                  text:
                    "Configure JOYBUY_* env vars after Joybuy approves the app. See docs/integrations/JOYBUY_IMPLEMENTATION.md.",
                })
              }
              className="rounded-2xl bg-linen px-5 py-3 text-sm font-semibold text-espresso ring-1 ring-sand hover:bg-sand/40 disabled:opacity-50"
            >
              Configure
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => runSync("products")}
              className="rounded-2xl bg-cocoa px-5 py-3 text-sm font-bold text-cream disabled:opacity-50"
            >
              {busy === "products" ? "Working…" : "Sync Products"}
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => runSync("inventory")}
              className="rounded-2xl bg-cocoa px-5 py-3 text-sm font-bold text-cream disabled:opacity-50"
            >
              {busy === "inventory" ? "Working…" : "Sync Inventory"}
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => runSync("orders")}
              className="rounded-2xl bg-cocoa px-5 py-3 text-sm font-bold text-cream disabled:opacity-50"
            >
              {busy === "orders" ? "Working…" : "Sync Orders"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
