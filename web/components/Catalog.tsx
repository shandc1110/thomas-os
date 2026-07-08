"use client";

import type { Product } from "@/lib/types";
import ProductCard from "./ProductCard";
import StickyCart from "./StickyCart";

type CatalogProps = {
  products: Product[];
};

export default function Catalog({ products }: CatalogProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 pb-28 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={String(product.id)} product={product} />
        ))}
      </div>

      <StickyCart />
    </>
  );
}
