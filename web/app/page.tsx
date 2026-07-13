"use client";

import Link from "next/link";
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
        // Keep sold-out items visible (clearly marked) but sort them last.
        const rows = ((data as Product[]) ?? []).slice().sort((a, b) => {
          const aOut = (a.stock ?? 0) <= 0 ? 1 : 0;
          const bOut = (b.stock ?? 0) <= 0 ? 1 : 0;
          return aOut - bOut;
        });
        setProducts(rows);
      }
      setLoading(false);
    }

    load();
  }, []);

  return (
    <main className="mx-auto min-h-full w-full max-w-3xl px-4">
      <header className="pt-8 pb-8 text-center">
        <div className="mx-auto mb-5 flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://chosenbychloe.com/cdn/shop/files/TopLogo.jpg?v=1764941405&width=160"
            alt="Chosen by Chloe"
            className="h-14 w-14 rounded-full object-cover ring-1 ring-sand"
          />
        </div>
        <h1 className="font-serif text-4xl text-espresso sm:text-5xl">
          Chosen by Chloe
        </h1>
        <p className="mx-auto mt-3 text-sm font-medium tracking-wide text-clay">
          Curated with Care · Exclusive Value · Proven by Choice
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted">
          Handpicked pieces, ready to order. Add your favourites to the basket and
          check out.
        </p>
        <Link
          href="/admin/login"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-linen px-6 text-sm font-semibold text-espresso ring-1 ring-sand transition hover:bg-sand/50"
        >
          Admin Login
        </Link>
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
