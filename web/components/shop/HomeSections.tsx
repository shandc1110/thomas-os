import { BrandCard } from "@/components/brands/BrandCard";
import { BrandLogo } from "@/components/shop/BrandLogo";
import { ChloeEditGrid } from "@/components/shop/ChloeEditGrid";
import { cbcV4Brand } from "@/lib/brand/chosen-by-chloe";
import type { BrandConfig } from "@/lib/brands";
import type { Product } from "@/lib/types";

/**
 * Approved Sprint 02C/03 hero — DO NOT redesign.
 * Asymmetrical brand composition: confident logo + quiet statement.
 * Sprint 03B: border removed + slight bottom easing only (transition into Edit).
 */
export function HomeHero() {
  return (
    <section className="bg-ivory">
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-14 sm:px-8 sm:pb-12 sm:pt-16 md:pb-14 md:pt-20 lg:px-10 lg:pb-16 lg:pt-24">
        {/* Large wordmark — left-weighted, not dead-centre */}
        <div className="w-[min(92vw,640px)] sm:w-[min(80vw,700px)] md:w-[min(72vw,760px)] lg:ml-0 lg:w-[min(68vw,820px)]">
          <BrandLogo
            variant="primary-horizontal"
            priority
            className="h-auto w-full object-contain object-left"
          />
        </div>

        {/* Statement block — offset to the right of the logo’s visual weight */}
        <div className="mt-12 max-w-sm sm:mt-14 sm:max-w-md md:ml-[18%] md:mt-16 lg:ml-[22%]">
          <h1 className="space-y-1">
            <span className="block text-[0.95rem] font-medium leading-relaxed tracking-[0.04em] text-charcoal sm:text-base">
              {cbcV4Brand.heroLine1}
            </span>
            <span className="block text-sm leading-relaxed tracking-[0.06em] text-sage sm:text-[0.95rem]">
              {cbcV4Brand.heroLine2}
            </span>
          </h1>

          <p className="mt-6 text-sm leading-relaxed text-muted">
            {cbcV4Brand.heroSupport}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#chloe-edit"
              className="inline-flex min-h-10 items-center bg-charcoal px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-ivory transition hover:bg-charcoal/90"
            >
              Shop the Edit
            </a>
            <a
              href="#our-story"
              className="inline-flex min-h-10 items-center border border-sand bg-transparent px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal transition hover:border-sage"
            >
              Our Story
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Sprint 03B — The Chloe Edit (visual refinement).
 * Grounded left alignment (shopping begins); quiet title; empty grid until catalogue.
 */
export function ChloeEditSection({ products = [] }: { products?: Product[] }) {
  return (
    <section id="chloe-edit" className="scroll-mt-24 border-b border-sand/50 bg-white">
      <div className="mx-auto max-w-6xl px-5 pb-14 pt-8 sm:px-8 sm:pb-16 sm:pt-10 md:pb-20 md:pt-12 lg:px-10">
        {/* Left-edge container — related to hero, not a copy of the offset statement */}
        <header className="max-w-lg">
          <h2 className="text-[1.05rem] font-medium tracking-[0.08em] text-charcoal sm:text-lg">
            THE CHLOE EDIT
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-muted">
            {cbcV4Brand.editSupport}
          </p>
        </header>

        {products.length > 0 ? (
          <div className="mt-8 sm:mt-9 md:mt-10">
            <ChloeEditGrid products={products} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

type BrandWithCount = {
  brand: BrandConfig;
  productCount: number;
};

/** Active brand collections — links to /brands/[slug]. */
export function OurBrandsSection({ brands }: { brands: BrandWithCount[] }) {
  if (brands.length === 0) return null;

  return (
    <section id="our-brands" className="scroll-mt-24 border-b border-sand/50 bg-ivory">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-16 lg:px-10">
        <header className="max-w-lg md:ml-[18%] lg:ml-[22%]">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sage">
            Our brands
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Curated collections at UK RRP — pre-order incoming stock or shop what&apos;s ready now.
          </p>
        </header>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map(({ brand, productCount }) => (
            <BrandCard key={brand.slug} brand={brand} productCount={productCount} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Minimal brand philosophy — no pillars, no grid. */
export function WhyWeChooseMinimal() {
  return (
    <section id="why-we-choose" className="border-b border-sand/50 bg-ivory">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-16 lg:px-10">
        <div className="max-w-md md:ml-[18%] lg:ml-[22%]">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sage">
            Why we choose
          </h2>
          <p className="mt-4 font-serif text-xl leading-snug text-charcoal sm:text-2xl">
            We don&apos;t stock everything.
            <br />
            We choose what deserves a place.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Minimal story signal — Chinese × British only here, quietly. */
export function OurStoryMinimal() {
  return (
    <section id="our-story" className="bg-ivory">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-16 lg:px-10">
        <div className="max-w-md md:ml-[18%] lg:ml-[22%]">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sage">
            Our story
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            It began with a mother choosing for her own child. Chloe is the
            reason. What we try, love, and keep — we share with other families.
          </p>
          <p className="mt-6 text-xs uppercase tracking-[0.18em] text-charcoal/70">
            Two worlds. One way of choosing.
          </p>
        </div>
      </div>
    </section>
  );
}
