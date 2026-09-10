"use client";

import { useMemo, useState } from "react";
import { StorefrontProductCard } from "@/components/shop/StorefrontProductCard";
import type { StorefrontAvailabilityStatus, StorefrontProduct } from "@/lib/storefront";

type ShopCatalogProps = {
  products: StorefrontProduct[];
};

type BrandFilter = "all" | string;
type AvailabilityFilter = "all" | StorefrontAvailabilityStatus;

function uniqueBrands(products: StorefrontProduct[]): string[] {
  const set = new Set<string>();
  for (const p of products) {
    const b = p.brand?.trim();
    if (b) set.add(b);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function uniqueAvailability(products: StorefrontProduct[]): StorefrontAvailabilityStatus[] {
  const order: StorefrontAvailabilityStatus[] = [
    "in_stock",
    "preorder",
    "sold_out",
    "unavailable",
  ];
  const present = new Set(products.map((p) => p.availabilityStatus));
  return order.filter((s) => present.has(s));
}

function availabilityFilterLabel(status: StorefrontAvailabilityStatus): string {
  switch (status) {
    case "in_stock":
      return "In stock";
    case "preorder":
      return "Pre-order";
    case "sold_out":
      return "Out of stock";
    case "unavailable":
      return "Unavailable";
    default:
      return status;
  }
}

/**
 * Client discovery controls for /shop — only filters backed by StorefrontProduct data.
 * No fake search. No invented taxonomy.
 */
export function ShopCatalog({ products }: ShopCatalogProps) {
  const brands = useMemo(() => uniqueBrands(products), [products]);
  const availabilityOptions = useMemo(() => uniqueAvailability(products), [products]);

  const [brand, setBrand] = useState<BrandFilter>("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (brand !== "all" && (p.brand?.trim() ?? "") !== brand) return false;
      if (availability !== "all" && p.availabilityStatus !== availability) return false;
      return true;
    });
  }, [products, brand, availability]);

  const showBrandFilter = brands.length > 1;
  const showAvailabilityFilter = availabilityOptions.length > 1;
  const showControls = showBrandFilter || showAvailabilityFilter;

  return (
    <div className="space-y-8 sm:space-y-10">
      {showControls ? (
        <div className="space-y-4 py-1">
          {showBrandFilter ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Brand
              </p>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={brand === "all"}
                  label="All"
                  onClick={() => setBrand("all")}
                />
                {brands.map((b) => (
                  <FilterChip
                    key={b}
                    active={brand === b}
                    label={b}
                    onClick={() => setBrand(b)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {showAvailabilityFilter ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Availability
              </p>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={availability === "all"}
                  label="All"
                  onClick={() => setAvailability("all")}
                />
                {availabilityOptions.map((status) => (
                  <FilterChip
                    key={status}
                    active={availability === status}
                    label={availabilityFilterLabel(status)}
                    onClick={() => setAvailability(status)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs uppercase tracking-[0.14em] text-muted">
        {filtered.length} {filtered.length === 1 ? "product" : "products"}
        {brand !== "all" || availability !== "all" ? (
          <span className="normal-case tracking-normal text-muted">
            {" "}
            · filtered from {products.length}
          </span>
        ) : null}
      </p>

      {filtered.length === 0 ? (
        <div className="px-2 py-16 text-center">
          <p className="font-serif text-xl text-charcoal">No products match</p>
          <p className="mt-2 text-sm text-muted">
            Try clearing a filter to see more of the edit.
          </p>
          <button
            type="button"
            onClick={() => {
              setBrand("all");
              setAvailability("all");
            }}
            className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-charcoal underline hover:text-sage"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:gap-x-8 md:gap-y-14 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <StorefrontProductCard key={product.productId} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
        active
          ? "bg-charcoal text-ivory"
          : "text-muted hover:text-charcoal"
      }`}
    >
      {label}
    </button>
  );
}
