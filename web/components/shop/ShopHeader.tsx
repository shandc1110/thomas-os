"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/context/CartContext";
import { BrandLogo } from "@/components/shop/BrandLogo";
import { ShopNav } from "@/components/shop/ShopNav";
import { cbcV4Brand } from "@/lib/brand/chosen-by-chloe";

type ShopHeaderProps = {
  /** Compact sizing for catalogue pages */
  compact?: boolean;
};

/**
 * Storefront chrome — V4 primary wordmark + story navigation (never CC as nav logo).
 */
export function ShopHeader({ compact = false }: ShopHeaderProps) {
  const { totalItems, hydrated } = useCart();
  const basketCount = hydrated ? totalItems : 0;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className="relative z-30 border-b border-sand/80 bg-ivory/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:py-5">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-8">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center text-charcoal lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-shop-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">Menu</span>
            <span aria-hidden className="flex w-5 flex-col gap-1.5">
              <span
                className={`h-px w-full bg-charcoal transition ${menuOpen ? "translate-y-[3.5px] rotate-45" : ""}`}
              />
              <span className={`h-px w-full bg-charcoal transition ${menuOpen ? "opacity-0" : ""}`} />
              <span
                className={`h-px w-full bg-charcoal transition ${menuOpen ? "-translate-y-[3.5px] -rotate-45" : ""}`}
              />
            </span>
          </button>

          <Link
            href="/"
            className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
            onClick={() => setMenuOpen(false)}
          >
            <BrandLogo
              variant="primary-horizontal"
              priority
              className={
                compact
                  ? "h-9 w-auto max-w-[150px] object-contain object-left sm:h-10 sm:max-w-[190px]"
                  : "h-10 w-auto max-w-[170px] object-contain object-left sm:h-12 sm:max-w-[230px]"
              }
            />
            <span className="sr-only">{cbcV4Brand.displayName}</span>
          </Link>

          <div className="hidden min-w-0 flex-1 lg:block">
            <ShopNav className="justify-start" />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/admin/login"
            className="hidden min-h-10 items-center px-3 text-xs font-medium tracking-wide text-muted transition hover:text-charcoal sm:inline-flex"
          >
            Account
          </Link>
          <Link
            href="/checkout"
            className="inline-flex min-h-10 items-center gap-2 bg-charcoal px-4 text-xs font-semibold uppercase tracking-wider text-ivory transition hover:bg-charcoal/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
            aria-label={
              basketCount > 0
                ? `Basket, ${basketCount} ${basketCount === 1 ? "item" : "items"}`
                : "Basket"
            }
          >
            Basket
            {basketCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center bg-ivory/20 px-1.5 text-[10px] font-bold text-ivory">
                {basketCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-shop-menu"
          className="border-t border-sand bg-ivory px-4 py-6 lg:hidden"
        >
          <ShopNav stacked onNavigate={() => setMenuOpen(false)} />
          <Link
            href="/admin/login"
            onClick={() => setMenuOpen(false)}
            className="mt-4 inline-flex py-3 text-sm font-medium text-muted"
          >
            Account
          </Link>
        </div>
      )}
    </header>
  );
}
