"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PickList } from "@/types/warehouse-ops";
import { BigButton, ScanInput } from "@/components/warehouse/WarehouseUI";

type PageProps = { params: Promise<{ orderId: string }> };

export default function PickingPage({ params }: PageProps) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pickList, setPickList] = useState<PickList | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setOrderId(p.orderId));
  }, [params]);

  useEffect(() => {
    if (!orderId) return;
    fetch("/api/warehouse/picking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", order_id: orderId }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setPickList(res.pick_list);
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  async function startPick() {
    if (!pickList) return;
    await fetch("/api/warehouse/picking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", pick_list_id: pickList.id }),
    });
    setPickList((p) => (p ? { ...p, status: "in_progress" } : p));
  }

  async function handleScan() {
    if (!pickList || !scanCode) return;
    const line = pickList.lines?.find(
      (l) => l.sku === scanCode || l.product_name.toLowerCase().includes(scanCode.toLowerCase()),
    );
    if (!line) {
      setMessage("Product not in pick list.");
      return;
    }
    await fetch("/api/warehouse/picking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm_line",
        line_id: line.id,
        quantity_picked: line.quantity_required,
      }),
    });
    setMessage(`✅ Picked ${line.product_name}`);
    setScanCode("");
    setPickList((p) =>
      p
        ? {
            ...p,
            lines: p.lines?.map((l) =>
              l.id === line.id ? { ...l, quantity_picked: l.quantity_required, status: "picked" } : l,
            ),
          }
        : p,
    );
  }

  async function completePick() {
    if (!pickList) return;
    await fetch("/api/warehouse/picking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", pick_list_id: pickList.id }),
    });
    window.location.href = `/admin/warehouse/packing/${orderId}`;
  }

  if (loading) return <div className="h-48 animate-pulse rounded-2xl bg-white/70" />;
  if (!pickList) return <p className="text-muted">Could not generate pick list.</p>;

  const byLocation = new Map<string, typeof pickList.lines>();
  for (const line of pickList.lines ?? []) {
    const group = byLocation.get(line.location_code) ?? [];
    group.push(line);
    byLocation.set(line.location_code, group);
  }

  return (
    <div className="space-y-5">
      <Link href="/admin/warehouse" className="text-sm text-clay">&larr; Warehouse</Link>
      <div>
        <h2 className="font-serif text-2xl text-espresso">{pickList.order_number}</h2>
        <p className="text-muted">{pickList.customer_name}</p>
      </div>

      {pickList.status === "pending" && <BigButton onClick={startPick}>Start Picking</BigButton>}

      {pickList.status !== "pending" && (
        <>
          <ScanInput value={scanCode} onChange={setScanCode} onSubmit={handleScan} />
          {message && (
            <p className={`rounded-xl px-4 py-3 text-sm font-medium ${message.startsWith("✅") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
              {message}
            </p>
          )}
        </>
      )}

      {[...byLocation.entries()].map(([loc, lines]) => (
        <div key={loc} className="rounded-2xl bg-white p-4 ring-1 ring-sand/60">
          <h3 className="font-bold text-cocoa">Shelf {loc}</h3>
          <ul className="mt-3 space-y-3">
            {lines?.map((line) => (
              <li key={line.id} className="flex items-center justify-between text-base">
                <div>
                  <p className="font-medium">{line.quantity_required} × {line.product_name}</p>
                  <p className="text-xs text-muted">{line.sku}</p>
                </div>
                <span className={line.status === "picked" ? "text-2xl text-green-600" : "text-2xl text-muted"}>
                  {line.status === "picked" ? "✓" : "○"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {pickList.status === "in_progress" && (
        <BigButton onClick={completePick}>Complete Picking</BigButton>
      )}
    </div>
  );
}
