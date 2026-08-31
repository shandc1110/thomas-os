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
      className="group flex flex-col overflow-hidden border border-sand/80 bg-white transition hover:border-sage"
    >
      <div className="flex aspect-[16/10] items-center justify-center bg-ivory p-8">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt=""
            className={
              brand.logoCardClass ??
              "max-h-14 w-full max-w-[180px] object-contain transition duration-300 group-hover:scale-[1.02]"
            }
          />
        ) : (
          <span className="font-serif text-2xl text-charcoal">{brand.name}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h2 className="font-serif text-2xl text-charcoal">{brand.name}</h2>
        <p className="text-sm text-sage">{brand.tagline}</p>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted">{brand.description}</p>
        <span className="mt-auto pt-3 text-xs font-semibold uppercase tracking-[0.16em] text-charcoal">
          {typeof productCount === "number"
            ? `${productCount} ${productCount === 1 ? "product" : "products"}`
            : "Shop collection"}
        </span>
      </div>
    </Link>
  );
}
