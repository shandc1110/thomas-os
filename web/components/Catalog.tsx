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
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 pb-28 md:gap-x-6 md:gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={String(product.id)} product={product} />
        ))}
      </div>

      <StickyCart />
    </>
  );
}
