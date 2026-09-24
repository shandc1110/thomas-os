import type { Metadata } from "next";
import Link from "next/link";
import { ShopFooter } from "@/components/shop/ShopFooter";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { StorefrontProductCard } from "@/components/shop/StorefrontProductCard";
import { cbcV4Brand } from "@/lib/brand/chosen-by-chloe";
import { getChloeEditFeed } from "@/lib/storefront/chloe-edit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Chloe Edit",
  description: cbcV4Brand.editSupport,
};

/**
 * Full Chloe's Edit — same Brand V4 storefront canvas and StorefrontProduct cards.
 * Data = explicit curation only.
 */
export default async function ChloeEditPage() {
  let feed: Awaited<ReturnType<typeof getChloeEditFeed>> = [];
  let loadError: string | null = null;

  try {
    feed = await getChloeEditFeed();
  } catch {
    loadError = "We couldn’t load The Edit right now. Please try again shortly.";
  }

  return (
    <div className="relative min-h-screen w-full bg-storefront">
      <ShopHeader compact />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:px-10">
        <header className="max-w-2xl space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sage">
            The Edit
          </p>
          <h1 className="font-serif text-3xl leading-tight text-charcoal sm:text-4xl md:text-[2.75rem]">
            The Chloe Edit
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            {cbcV4Brand.editSupport}
          </p>
        </header>

        <div className="mt-12 sm:mt-16">
          {loadError ? (
            <p className="text-sm text-muted">{loadError}</p>
          ) : feed.length === 0 ? (
            <div className="max-w-md space-y-2">
              <p className="font-serif text-xl text-charcoal">Nothing in the edit just yet</p>
              <p className="text-sm text-muted">
                Curated pieces appear here once Chloe chooses them.
              </p>
              <Link
                href="/shop"
                className="inline-block pt-2 text-sm font-semibold text-charcoal underline-offset-2 hover:underline"
              >
                Browse the shop
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-12 lg:grid-cols-4">
              {feed.map((item) => (
                <div key={item.product.productId} className="flex h-full flex-col">
                  <StorefrontProductCard product={item.product} />
                  {item.editorialNote ? (
                    <p className="mt-3 text-xs leading-relaxed text-muted">
                      {item.editorialNote}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <ShopFooter />
    </div>
  );
}
