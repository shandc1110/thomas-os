import type { BrandConfig } from "@/lib/brands";

type BrandHeroProps = {
  brand: BrandConfig;
  productCount: number;
};

export function BrandHero({ brand, productCount }: BrandHeroProps) {
  return (
    <section className="mb-10 border-b border-sand/80 pb-10">
      <div className="mx-auto max-w-2xl px-1 text-center">
        {brand.logoUrl ? (
          <div className="mx-auto mb-6 flex max-w-[200px] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="h-12 w-full object-contain sm:h-14"
            />
          </div>
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sage">
          Brand collection
        </p>
        <h1 className="mt-3 font-serif text-4xl text-charcoal sm:text-5xl">{brand.name}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-sage">{brand.tagline}</p>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
          {brand.description}
        </p>
        <p className="mt-5 text-xs uppercase tracking-[0.18em] text-muted">
          {productCount} {productCount === 1 ? "product" : "products"}
          {brand.defaultCurrency === "GBP" ? " · GBP" : " · CNY"}
        </p>
      </div>
    </section>
  );
}
