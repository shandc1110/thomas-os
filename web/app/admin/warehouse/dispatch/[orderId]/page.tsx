"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BigButton } from "@/components/warehouse/WarehouseUI";

type PageProps = { params: Promise<{ orderId: string }> };

export default function DispatchPage({ params }: PageProps) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    params.then((p) => setOrderId(p.orderId));
  }, [params]);

  async function dispatch() {
    if (!orderId) return;
    await fetch("/api/warehouse/packing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "dispatch",
        order_id: orderId,
        tracking_number: tracking || undefined,
      }),
    });
    setDone(true);
  }

  if (done) {
    return (
      <div className="py-16 text-center">
        <p className="text-4xl">✅</p>
        <h2 className="mt-4 font-serif text-2xl text-espresso">Dispatched</h2>
        <Link href="/admin/warehouse" className="mt-6 inline-block text-cocoa">
          Back to warehouse
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/warehouse" className="text-sm text-clay">&larr; Warehouse</Link>
      <h2 className="font-serif text-2xl text-espresso">Dispatch Order</h2>
      <label className="block">
        <span className="text-sm font-medium text-espresso">Tracking number (optional)</span>
        <input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          className="mt-2 min-h-14 w-full rounded-2xl border-2 border-sand px-4 text-lg"
          placeholder="Royal Mail / DPD tracking"
        />
      </label>
      <BigButton onClick={dispatch}>Confirm Dispatch</BigButton>
    </div>
  );
}
