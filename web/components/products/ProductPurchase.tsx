"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/format";
import {
  getSellableStock,
  isPresellOnly,
} from "@/lib/presell";
import type { Product } from "@/lib/types";
import { ProductVariantSelect } from "@/components/products/ProductVariantSelect";

type ProductPurchaseProps = {
  product: Product;
  variants?: Product[];
};

export function ProductPurchase({ product, variants = [] }: ProductPurchaseProps) {
  const sellableVariants = variants.length > 0 ? variants : [product];
  const [selected, setSelected] = useState<Product>(sellableVariants[0]);
  const [quantity, setQuantity] = useState(1);
  const { addItem, getQuantity } = useCart();

  useEffect(() => {
    setSelected(sellableVariants[0]);
    setQuantity(1);
  }, [product.id]);

  const sellable = getSellableStock(selected);
  const presellOnly = isPresellOnly(selected);
  const soldOut = sellable <= 0;
  const inCart = getQuantity(selected.id);
  const remaining = Math.max(sellable - inCart, 0);
  const maxSelectable = Math.max(remaining, 1);
  const clampedSelected = Math.min(quantity, maxSelectable);
  const canAdd = !soldOut && remaining > 0;
  const showVariantPicker = sellableVariants.length > 1;

  function decrement() {
    setQuantity((value) => Math.max(1, value - 1));
  }

  function increment() {
    setQuantity((value) => Math.min(maxSelectable, value + 1));
  }

  function handleAdd() {
    if (!canAdd) return;
    addItem(selected, clampedSelected);
    setQuantity(1);
  }

  return (
    <div className="space-y-4 border-t border-sand/80 pt-6">
      {showVariantPicker ? (
        <ProductVariantSelect
          variants={sellableVariants}
          selectedId={selected.id}
          onChange={(variant) => {
            setSelected(variant);
            setQuantity(1);
          }}
        />
      ) : null}

      <p className="text-xl font-semibold text-charcoal">
        {formatPrice(selected.price, selected.currency)}
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
              aria-label={`Decrease quantity of ${selected.name}`}
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
              aria-label={`Increase quantity of ${selected.name}`}
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
