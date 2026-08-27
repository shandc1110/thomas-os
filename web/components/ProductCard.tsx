"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import {
  formatExpectedArrival,
  getOnHandStock,
  getPresellStock,
  getSellableStock,
  isPresellOnly,
} from "@/lib/presell";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/context/CartContext";

type ProductCardProps = {
  product: Product;
};

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem, getQuantity } = useCart();
  const [selected, setSelected] = useState(1);

  const onHand = getOnHandStock(product);
  const presellStock = getPresellStock(product);
  const sellable = getSellableStock(product);
  const presellOnly = isPresellOnly(product);
  const soldOut = sellable <= 0;
  const arrivalLabel = formatExpectedArrival(product.expected_arrival_month);

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
    <div className="group flex flex-col">
      <div className="relative aspect-square w-full overflow-hidden bg-white">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.02] ${
              soldOut ? "opacity-50" : ""
            }`}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-sand/40">
            <span className="text-xs uppercase tracking-widest text-muted">No image</span>
          </div>
        )}

        {soldOut && (
          <div className="absolute inset-x-0 bottom-0 bg-charcoal/80 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ivory">
            Sold out
          </div>
        )}

        {presellOnly && arrivalLabel && !soldOut && (
          <p className="absolute left-0 top-0 bg-ivory/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal">
            Pre-order · {arrivalLabel}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 pt-3">
        <div className="space-y-1">
          {product.brand ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage">
              {product.brand}
            </p>
          ) : null}
          <h3 className="font-serif text-lg leading-snug text-charcoal">{product.name}</h3>
          {presellOnly && arrivalLabel && (
            <p className="text-xs text-muted">Ships {arrivalLabel}</p>
          )}
          {!presellOnly && !soldOut && presellStock > 0 && arrivalLabel && (
            <p className="text-xs text-muted">
              +{presellStock} incoming ({arrivalLabel})
            </p>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-base font-semibold text-charcoal">
            {formatPrice(product.price, product.currency)}
          </span>
          {!soldOut && onHand > 0 && onHand <= 3 && (
            <span className="text-xs text-muted">Only {onHand} left</span>
          )}
        </div>

        {soldOut ? (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed border border-sand py-2.5 text-sm font-medium text-muted"
          >
            Sold out
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border border-sand bg-white p-1">
              <button
                type="button"
                onClick={decrement}
                disabled={clampedSelected <= 1}
                aria-label={`Decrease quantity of ${product.name}`}
                className="flex h-9 w-9 items-center justify-center text-lg text-charcoal transition hover:bg-ivory disabled:opacity-40"
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
                className="flex h-9 w-9 items-center justify-center bg-charcoal text-lg text-ivory transition hover:bg-charcoal/90 disabled:opacity-40"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="w-full bg-charcoal py-2.5 text-sm font-semibold tracking-wide text-ivory transition hover:bg-charcoal/90 disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted"
            >
              {canAdd ? (presellOnly ? "Pre-order" : "Add to basket") : "Max in basket"}
            </button>

            {inCart > 0 && (
              <p className="text-center text-xs text-muted">{inCart} in your basket</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
