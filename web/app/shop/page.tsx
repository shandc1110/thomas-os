import type { Metadata } from "next";
import { ShopCatalog } from "@/components/shop/ShopCatalog";
import { ShopFooter } from "@/components/shop/ShopFooter";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { cbcV4Brand } from "@/lib/brand/chosen-by-chloe";
import { getStorefrontProducts, type StorefrontProduct } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop",
  description: cbcV4Brand.tagline,
};

/**
 * Continuous warm storefront canvas (#F3EBDD).
 * Hierarchy from spacing/typography — not colour blocks or white panels.
 */
export default async function ShopPage() {
  let products: StorefrontProduct[] = [];
  let loadError: string | null = null;

  try {
    products = await getStorefrontProducts();
  } catch {
    loadError = "We couldn’t load the shop right now. Please try again shortly.";
  }

  return (
    <div className="relative min-h-screen w-full bg-storefront">
      <ShopHeader compact />

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:px-10">
        <header className="max-w-2xl space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sage">Shop</p>
          <h1 className="font-serif text-3xl leading-tight text-charcoal sm:text-4xl md:text-[2.75rem]">
            Chosen for little lives
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            {cbcV4Brand.tagline}
          </p>
        </header>

        <div className="mt-12 sm:mt-16">
          {loadError ? (
            <div className="px-2 py-16 text-center">
              <p className="font-serif text-xl text-charcoal">Shop temporarily unavailable</p>
              <p className="mt-2 text-sm text-muted">{loadError}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="px-2 py-16 text-center">
              <p className="font-serif text-xl text-charcoal">Nothing in the edit just yet</p>
              <p className="mt-2 text-sm text-muted">
                Products appear here once they are marked active in the selling assortment.
              </p>
            </div>
          ) : (
            <ShopCatalog products={products} />
          )}
        </div>
      </main>

      <ShopFooter />
    </div>
  );
}
