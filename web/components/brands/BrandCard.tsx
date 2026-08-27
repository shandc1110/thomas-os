import Link from "next/link";
import type { BrandConfig } from "@/lib/brands";

type BrandCardProps = {
  brand: BrandConfig;
  productCount?: number;
};

export function BrandCard({ brand, productCount }: BrandCardProps) {
  return (
    <Link
      href={`/brands/${brand.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-sand/70 transition-shadow hover:shadow-md"
    >
      <div
        className="flex aspect-[16/10] items-center justify-center p-8"
        style={{
          background: `linear-gradient(145deg, ${brand.heroAccent}22, #faf6f2 55%, #ffffff)`,
        }}
      >
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt=""
            className="max-h-16 w-full max-w-[200px] object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90 font-serif text-2xl text-espresso shadow-sm ring-1 ring-sand">
            {brand.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5 pt-4">
        <h2 className="font-serif text-2xl text-espresso group-hover:text-cocoa">
          {brand.name}
        </h2>
        <p className="text-sm font-medium text-clay">{brand.tagline}</p>
        <p className="line-clamp-3 text-sm text-muted">{brand.description}</p>
        <span className="mt-auto pt-3 text-xs font-semibold uppercase tracking-wide text-cocoa">
          {typeof productCount === "number"
            ? `Shop ${productCount} ${productCount === 1 ? "product" : "products"} →`
            : "Shop collection →"}
        </span>
      </div>
    </Link>
  );
}
