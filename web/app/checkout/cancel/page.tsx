"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CancelContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order_number");

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="font-serif text-3xl text-espresso">Payment cancelled</h1>
      <p className="mt-3 max-w-sm text-sm text-muted">
        Your card payment was not completed. Your order is saved as awaiting payment — you can
        complete checkout again or pay by bank transfer. Contact us on WeChat if you need help.
      </p>
      {orderNumber && (
        <p className="mt-2 text-xs uppercase tracking-widest text-clay">Reference {orderNumber}</p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/checkout"
          className="rounded-full bg-cocoa px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-espresso"
        >
          Return to checkout
        </Link>
        <Link
          href="/"
          className="rounded-full border border-sand bg-white px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-linen"
        >
          Back to shop
        </Link>
      </div>
    </main>
  );
}

export default function CheckoutCancelPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
          <p className="text-sm text-muted">Loading…</p>
        </main>
      }
    >
      <CancelContent />
    </Suspense>
  );
}
