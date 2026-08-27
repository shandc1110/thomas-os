import type { Metadata } from "next";
import Link from "next/link";
import { BrandCard } from "@/components/brands/BrandCard";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { RecoveryRedirect } from "@/components/thomas/RecoveryRedirect";
import { brandSlugFromProductBrand, getActiveBrands } from "@/lib/brands";
import { fetchCatalogProducts } from "@/lib/brands/catalog";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";

const tenant = getActiveTenant();

export const metadata: Metadata = {
  title: tenant.storefront.title,
  description: tenant.storefront.description,
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/`
      : undefined,
  },
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const brands = getActiveBrands();
  let counts = new Map<string, number>();

  try {
    const products = await fetchCatalogProducts();
    counts = products.reduce((map, product) => {
      const slug = brandSlugFromProductBrand(product.brand);
      if (!slug) return map;
      map.set(slug, (map.get(slug) ?? 0) + 1);
      return map;
    }, new Map<string, number>());
  } catch {
    // Hub still renders; counts optional
  }

  return (
    <main className="relative mx-auto min-h-full w-full max-w-3xl px-4 pb-16">
      <RecoveryRedirect />
      <ShopHeader
        subtitle="Handpicked brands, ready to order. Choose a collection below."
      />

      <h1 className="sr-only">{tenant.brand.name} brands</h1>

      <div className="grid gap-5 sm:grid-cols-2">
        {brands.map((brand) => (
          <BrandCard
            key={brand.slug}
            brand={brand}
            productCount={counts.get(brand.slug)}
          />
        ))}
      </div>

      {brands.length === 0 && (
        <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-sand/60">
          <p className="font-serif text-xl text-espresso">No brands listed yet</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
            Brand collections will appear here soon.
          </p>
        </div>
      )}

      <p className="mt-10 text-center text-xs text-muted">
        Prefer the full catalogue without a brand filter?{" "}
        <Link href="/brands/mideer" className="text-cocoa underline-offset-2 hover:underline">
          Start with Mideer
        </Link>
        {" · "}
        <Link href="/brands/tonies" className="text-cocoa underline-offset-2 hover:underline">
          or Tonies
        </Link>
      </p>
    </main>
  );
}
