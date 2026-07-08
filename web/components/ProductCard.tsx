"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/context/CartContext";

type ProductCardProps = {
  product: Product;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem, getQuantity } = useCart();
  const [selected, setSelected] = useState(1);

  const stock = product.stock ?? 0;
  const soldOut = stock <= 0;
  const lowStock = !soldOut && stock <= 3;

  const inCart = getQuantity(product.id);
  const remaining = Math.max(stock - inCart, 0);
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
    <div className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-sand/60 transition-shadow duration-300 hover:shadow-md">
      <div className="relative aspect-square w-full overflow-hidden bg-linen">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              soldOut ? "opacity-60 grayscale" : ""
            }`}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-sand">
            <span className="font-serif text-4xl text-cocoa/70">
              {initials(product.name)}
            </span>
          </div>
        )}

        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-espresso/25 backdrop-blur-[1px]">
            <span className="rounded-full bg-espresso/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-cream">
              Sold out
            </span>
          </div>
        )}

        {lowStock && (
          <span className="absolute left-3 top-3 rounded-full bg-cocoa/90 px-3 py-1 text-[11px] font-medium text-cream shadow-sm">
            Only {stock} left
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-1 flex-col gap-1">
          <h3 className="font-serif text-lg leading-snug text-espresso">
            {product.name}
          </h3>
          {product.description && (
            <p className="line-clamp-2 text-sm text-muted">{product.description}</p>
          )}
        </div>

        <div className="flex items-end justify-between">
          <span className="text-lg font-semibold text-ink">
            {formatPrice(product.price)}
          </span>
          {!soldOut && (
            <span className="text-xs text-muted">{stock} in stock</span>
          )}
        </div>

        {soldOut ? (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-full bg-sand py-2.5 text-sm font-semibold uppercase tracking-wide text-muted"
          >
            Sold out
          </button>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between rounded-full bg-linen p-1">
              <button
                type="button"
                onClick={decrement}
                disabled={clampedSelected <= 1}
                aria-label={`Decrease quantity of ${product.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-semibold text-cocoa shadow-sm transition-colors hover:bg-cream disabled:opacity-40 disabled:hover:bg-white"
              >
                &minus;
              </button>
              <span className="min-w-8 text-center text-base font-semibold text-espresso">
                {clampedSelected}
              </span>
              <button
                type="button"
                onClick={increment}
                disabled={clampedSelected >= maxSelectable}
                aria-label={`Increase quantity of ${product.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-cocoa text-lg font-semibold text-cream shadow-sm transition-colors hover:bg-espresso disabled:opacity-40 disabled:hover:bg-cocoa"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="w-full rounded-full bg-cocoa py-2.5 text-sm font-semibold uppercase tracking-wide text-cream shadow-sm transition-colors hover:bg-espresso disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted"
            >
              {canAdd ? "Add to cart" : "Max in cart"}
            </button>

            {inCart > 0 && (
              <p className="text-center text-xs text-clay">{inCart} in your cart</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
