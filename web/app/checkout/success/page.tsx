"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type SessionResult = {
  success: boolean;
  order_number?: string;
  error?: string;
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [result, setResult] = useState<SessionResult | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setResult({ success: false, error: "Missing payment reference." });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`);
        const data = (await response.json()) as SessionResult;
        if (!cancelled) setResult(data);
      } catch {
        if (!cancelled) {
          setResult({ success: false, error: "Could not confirm payment. Please contact us." });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const loading = result === null;
  const failed = result !== null && !result.success;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl ${
          failed ? "bg-red-100 text-red-700" : "bg-cocoa text-cream"
        }`}
      >
        {failed ? "!" : "✓"}
      </div>
      <h1 className="mt-6 font-serif text-3xl text-espresso">
        {loading ? "Confirming payment…" : failed ? "Payment issue" : "Payment received"}
      </h1>
      <p className="mt-3 max-w-sm text-sm text-muted">
        {loading &&
          "Please wait while we confirm your card payment. This usually takes a few seconds."}
        {!loading && failed && (result?.error ?? "Something went wrong.")}
        {!loading && !failed &&
          "Thank you! Your payment was successful. A confirmation email is on its way."}
      </p>
      {result?.order_number && (
        <p className="mt-2 text-xs uppercase tracking-widest text-clay">
          Reference {result.order_number}
        </p>
      )}
      <Link
        href="/"
        className="mt-8 rounded-full bg-cocoa px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-espresso"
      >
        Back to shop
      </Link>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
          <p className="text-sm text-muted">Confirming payment…</p>
        </main>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
