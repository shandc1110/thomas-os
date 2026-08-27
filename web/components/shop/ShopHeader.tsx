"use client";

import Link from "next/link";
import { getClientTenant } from "@/lib/thomas";
import { BrandNav } from "@/components/brands/BrandNav";

type ShopHeaderProps = {
  /** Optional subtitle under the site name */
  subtitle?: string;
  showBrandNav?: boolean;
};

/** Shared storefront chrome — Chosen by Chloe identity + brand navigation. */
export function ShopHeader({ subtitle, showBrandNav = true }: ShopHeaderProps) {
  const tenant = getClientTenant();

  return (
    <header className="relative pt-8 pb-6 text-center">
      <Link
        href="/admin/login"
        className="absolute right-0 top-0 z-10 inline-flex min-h-9 items-center rounded-full bg-linen px-4 text-xs font-semibold text-espresso ring-1 ring-sand transition hover:bg-sand/50"
      >
        Admin Login
      </Link>

      <Link href="/" className="mx-auto mb-5 inline-flex items-center justify-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tenant.brand.logoUrl}
          alt={tenant.brand.name}
          className="h-14 w-14 rounded-full object-cover ring-1 ring-sand"
        />
      </Link>

      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-clay">
        {tenant.brand.name}
      </p>
      {subtitle ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{subtitle}</p>
      ) : (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{tenant.brand.tagline}</p>
      )}

      {showBrandNav && <BrandNav className="mt-6" />}
    </header>
  );
}
