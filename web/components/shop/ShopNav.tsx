"use client";

import Link from "next/link";
import { cbcV4Brand } from "@/lib/brand/chosen-by-chloe";

type ShopNavProps = {
  className?: string;
  /** Stack links vertically (mobile drawer) */
  stacked?: boolean;
  onNavigate?: () => void;
};

/**
 * Primary storefront navigation — story & merchandising, not brand names.
 */
export function ShopNav({ className = "", stacked = false, onNavigate }: ShopNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={
        stacked
          ? `flex flex-col gap-1 ${className}`
          : `flex flex-wrap items-center gap-1 sm:gap-2 ${className}`
      }
    >
      {cbcV4Brand.nav.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          className={
            stacked
              ? "px-1 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-charcoal transition hover:text-sage"
              : "px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted transition hover:text-charcoal"
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
