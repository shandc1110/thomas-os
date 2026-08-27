import type { BrandConfig } from "@/lib/brands";

type BrandHeroProps = {
  brand: BrandConfig;
  productCount: number;
};

export function BrandHero({ brand, productCount }: BrandHeroProps) {
  return (
    <section
      className="mb-8 overflow-hidden rounded-3xl ring-1 ring-sand/60"
      style={{
        background: `linear-gradient(160deg, ${brand.heroAccent}28 0%, #faf6f2 48%, #ffffff 100%)`,
      }}
    >
      <div className="px-6 py-10 text-center sm:px-10 sm:py-12">
        {brand.logoUrl ? (
          <div className="mx-auto mb-6 flex max-w-[220px] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="h-12 w-full object-contain sm:h-14"
            />
          </div>
        ) : (
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white font-serif text-3xl text-espresso shadow-sm ring-1 ring-sand">
            {brand.name.charAt(0)}
          </div>
        )}
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clay">
          Brand collection
        </p>
        <h1 className="mt-2 font-serif text-4xl text-espresso sm:text-5xl">{brand.name}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm font-medium tracking-wide text-clay">
          {brand.tagline}
        </p>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
          {brand.description}
        </p>
        <p className="mt-5 text-xs uppercase tracking-widest text-muted">
          {productCount} {productCount === 1 ? "product" : "products"}
          {brand.defaultCurrency === "GBP" ? " · priced in GBP" : " · priced in CNY"}
        </p>
      </div>
    </section>
  );
}
