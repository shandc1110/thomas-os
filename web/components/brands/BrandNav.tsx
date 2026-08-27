"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveBrands } from "@/lib/brands/registry";

type BrandNavProps = {
  className?: string;
};

export function BrandNav({ className = "" }: BrandNavProps) {
  const pathname = usePathname();
  const brands = getActiveBrands();

  return (
    <nav
      aria-label="Brands"
      className={`flex flex-wrap items-center gap-1 sm:gap-2 ${className}`}
    >
      <Link
        href="/"
        className={`px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
          pathname === "/"
            ? "text-charcoal underline decoration-sage decoration-2 underline-offset-4"
            : "text-muted hover:text-charcoal"
        }`}
      >
        Home
      </Link>
      {brands.map((brand) => {
        const href = `/brands/${brand.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={brand.slug}
            href={href}
            className={`px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
              active
                ? "text-charcoal underline decoration-sage decoration-2 underline-offset-4"
                : "text-muted hover:text-charcoal"
            }`}
          >
            {brand.name}
          </Link>
        );
      })}
    </nav>
  );
}
