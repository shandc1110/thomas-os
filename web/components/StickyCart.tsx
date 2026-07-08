"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/format";

export default function StickyCart() {
  const { totalItems, totalPrice, hydrated } = useCart();
  const hasItems = hydrated && totalItems > 0;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-20 transition-transform duration-300 ${
        hasItems ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!hasItems}
    >
      <div className="mx-auto max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <Link
          href="/checkout"
          className="flex w-full items-center justify-between rounded-full bg-cocoa px-6 py-4 text-cream shadow-lg shadow-espresso/20 transition-colors hover:bg-espresso"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-cream/20 px-1.5 text-xs font-semibold">
              {totalItems}
            </span>
            {totalItems === 1 ? "item" : "items"} &middot; Checkout
          </span>
          <span className="text-base font-semibold">{formatPrice(totalPrice)}</span>
        </Link>
      </div>
    </div>
  );
}
