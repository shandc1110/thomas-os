"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PackSession } from "@/types/warehouse-ops";
import { BigButton, ScanInput } from "@/components/warehouse/WarehouseUI";

type PageProps = { params: Promise<{ orderId: string }> };

export default function PackingPage({ params }: PageProps) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [session, setSession] = useState<PackSession | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setOrderId(p.orderId));
  }, [params]);

  useEffect(() => {
    if (!orderId) return;
    fetch("/api/warehouse/packing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", order_id: orderId }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setSession(res.session);
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  async function handleScan() {
    if (!session || !scanCode) return;
    const res = await fetch("/api/warehouse/packing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", session_id: session.id, code: scanCode }),
    });
    const result = await res.json();
    if (result.match) {
      setMessage({ text: `✅ ${result.product_name}`, ok: true });
      const refresh = await fetch(`/api/warehouse/packing?order_id=${orderId}`);
      const data = await refresh.json();
      if (data.success) setSession(data.session);
    } else {
      setMessage({ text: "❌ Wrong item — does not match order", ok: false });
    }
    setScanCode("");
  }

  async function downloadSlip() {
    if (!orderId || !session) return;
    const res = await fetch(`/api/orders/${orderId}/packing-slip`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `packing-slip.pdf`;
    a.click();
    await fetch("/api/warehouse/packing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "slip_printed", session_id: session.id }),
    });
    setSession((s) => (s ? { ...s, packing_slip_printed: true } : s));
  }

  async function markLabel() {
    if (!session || !orderId) return;
    await fetch("/api/warehouse/packing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "label_printed", session_id: session.id, order_id: orderId }),
    });
    setSession((s) => (s ? { ...s, label_printed: true } : s));
    setMessage({ text: "Shipping label marked as printed", ok: true });
  }

  async function completePack() {
    if (!session) return;
    const res = await fetch("/api/warehouse/packing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", session_id: session.id }),
    });
    const result = await res.json();
    if (!result.success) {
      setMessage({ text: result.error ?? "Complete verification first", ok: false });
      return;
    }
    window.location.href = "/admin/warehouse";
  }

  if (loading) return <div className="h-48 animate-pulse rounded-2xl bg-white/70" />;
  if (!session) return <p className="text-muted">Could not start packing session.</p>;

  const allVerified = (session.verifications ?? []).every((v) => v.status === "ok");

  return (
    <div className="space-y-5">
      <Link href="/admin/warehouse" className="text-sm text-clay">&larr; Warehouse</Link>
      <h2 className="font-serif text-2xl text-espresso">Pack {session.order_number}</h2>

      <ScanInput value={scanCode} onChange={setScanCode} onSubmit={handleScan} placeholder="Scan SKU to verify…" />

      {message && (
        <p className={`rounded-xl px-4 py-4 text-base font-bold ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}

      <ul className="space-y-2">
        {(session.verifications ?? []).map((v) => (
          <li
            key={v.id}
            className={`flex items-center justify-between rounded-xl px-4 py-3 text-base ring-1 ${
              v.status === "ok" ? "bg-green-50 ring-green-200" : v.status === "mismatch" ? "bg-red-50 ring-red-200" : "bg-white ring-sand/60"
            }`}
          >
            <span>{v.expected_quantity} × {v.product_name ?? v.sku}</span>
            <span className="text-xl">{v.status === "ok" ? "✅" : v.status === "mismatch" ? "❌" : "○"}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <BigButton onClick={downloadSlip} variant="secondary">
          {session.packing_slip_printed ? "✓ Packing Slip Printed" : "Download Packing Slip"}
        </BigButton>
        <BigButton onClick={markLabel} variant="secondary">
          {session.label_printed ? "✓ Label Printed" : "Mark Label Printed"}
        </BigButton>
        <BigButton onClick={completePack} disabled={!allVerified}>
          Pack Complete
        </BigButton>
      </div>
    </div>
  );
}
