"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/lib/types";
import Catalog from "@/components/Catalog";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setProducts((data as Product[]) ?? []);
      }
      setLoading(false);
    }

    load();
  }, []);

  return (
    <main className="mx-auto min-h-full w-full max-w-2xl px-4">
      <header className="pt-10 pb-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-clay">
          Order Portal
        </p>
        <h1 className="mt-2 font-serif text-4xl text-espresso sm:text-5xl">
          Chosen by Chloe
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
          Handpicked pieces, ready to order. Add your favourites to the basket and
          check out.
        </p>
      </header>

      {error ? (
        <div className="rounded-3xl bg-white p-6 text-center ring-1 ring-sand/60">
          <p className="font-serif text-lg text-espresso">
            We couldn&apos;t load the collection
          </p>
          <p className="mt-2 text-sm text-muted">{error}</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-4 pb-12 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[3/4] animate-pulse rounded-3xl bg-white/70 ring-1 ring-sand/50"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-sand/60">
          <p className="font-serif text-xl text-espresso">Nothing here just yet</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
            There are no active products available right now. Please check back soon.
          </p>
        </div>
      ) : (
        <Catalog products={products} />
      )}
    </main>
  );
}
