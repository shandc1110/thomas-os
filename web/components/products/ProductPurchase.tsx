"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/format";
import {
  getSellableStock,
  isPresellOnly,
} from "@/lib/presell";
import type { Product } from "@/lib/types";

type ProductPurchaseProps = {
  product: Product;
};

export function ProductPurchase({ product }: ProductPurchaseProps) {
  const { addItem, getQuantity } = useCart();
  const [selected, setSelected] = useState(1);

  const sellable = getSellableStock(product);
  const presellOnly = isPresellOnly(product);
  const soldOut = sellable <= 0;
  const inCart = getQuantity(product.id);
  const remaining = Math.max(sellable - inCart, 0);
  const maxSelectable = Math.max(remaining, 1);
  const clampedSelected = Math.min(selected, maxSelectable);
  const canAdd = !soldOut && remaining > 0;

  function decrement() {
    setSelected((value) => Math.max(1, value - 1));
  }

  function increment() {
    setSelected((value) => Math.min(maxSelectable, value + 1));
  }

  function handleAdd() {
    if (!canAdd) return;
    addItem(product, clampedSelected);
    setSelected(1);
  }

  return (
    <div className="space-y-4 border-t border-sand/80 pt-6">
      <p className="text-xl font-semibold text-charcoal">
        {formatPrice(product.price, product.currency)}
      </p>

      {soldOut ? (
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed border border-sand py-3 text-sm font-medium text-muted"
        >
          Sold out
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border border-sand bg-white p-1">
            <button
              type="button"
              onClick={decrement}
              disabled={clampedSelected <= 1}
              aria-label={`Decrease quantity of ${product.name}`}
              className="flex h-10 w-10 items-center justify-center text-lg text-charcoal transition hover:bg-ivory disabled:opacity-40"
            >
              &minus;
            </button>
            <span className="min-w-8 text-center text-sm font-semibold text-charcoal">
              {clampedSelected}
            </span>
            <button
              type="button"
              onClick={increment}
              disabled={clampedSelected >= maxSelectable}
              aria-label={`Increase quantity of ${product.name}`}
              className="flex h-10 w-10 items-center justify-center bg-charcoal text-lg text-ivory transition hover:bg-charcoal/90 disabled:opacity-40"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="w-full bg-charcoal py-3 text-sm font-semibold tracking-wide text-ivory transition hover:bg-charcoal/90 disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted"
          >
            {canAdd ? (presellOnly ? "Pre-order" : "Add to basket") : "Max in basket"}
          </button>

          {inCart > 0 ? (
            <p className="text-center text-xs text-muted">{inCart} in your basket</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
