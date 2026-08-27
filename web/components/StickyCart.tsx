"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCart } from "@/context/CartContext";
import { normaliseCurrency, unitPriceForOrder } from "@/lib/currency";
import { formatOrderPrice } from "@/lib/format";

export default function StickyCart() {
  const { items, totalItems, hydrated } = useCart();
  const hasItems = hydrated && totalItems > 0;

  const { displayTotal, displayCurrency } = useMemo(() => {
    const currencies = new Set(
      items.map((item) => normaliseCurrency(item.product.currency)),
    );
    const displayCurrency =
      currencies.size === 1 ? [...currencies][0]! : currencies.has("GBP") ? "GBP" : "CNY";
    let total = 0;
    for (const item of items) {
      total +=
        unitPriceForOrder(item.product.price ?? 0, item.product.currency, displayCurrency) *
        item.quantity;
    }
    return { displayTotal: total, displayCurrency };
  }, [items]);

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
          className="flex w-full items-center justify-between bg-charcoal px-6 py-4 text-ivory transition-colors hover:bg-charcoal/90"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-cream/20 px-1.5 text-xs font-semibold">
              {totalItems}
            </span>
            {totalItems === 1 ? "item" : "items"}
            <span aria-hidden="true"> · </span>
            Basket
          </span>
          <span className="text-base font-semibold">
            {formatOrderPrice(displayTotal, displayCurrency)}
          </span>
        </Link>
      </div>
    </div>
  );
}
