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
      className={`flex flex-wrap items-center justify-center gap-2 ${className}`}
    >
      <Link
        href="/"
        className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
          pathname === "/"
            ? "bg-cocoa text-cream"
            : "bg-linen text-espresso ring-1 ring-sand hover:bg-sand/50"
        }`}
      >
        All brands
      </Link>
      {brands.map((brand) => {
        const href = `/brands/${brand.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={brand.slug}
            href={href}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
              active
                ? "bg-cocoa text-cream"
                : "bg-linen text-espresso ring-1 ring-sand hover:bg-sand/50"
            }`}
          >
            {brand.name}
          </Link>
        );
      })}
    </nav>
  );
}
