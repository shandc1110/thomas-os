import type { Metadata } from "next";
import { RecoveryRedirect } from "@/components/thomas/RecoveryRedirect";
import { ShopFooter } from "@/components/shop/ShopFooter";
import { ShopHeader } from "@/components/shop/ShopHeader";
import {
  ChloeEditSection,
  HomeHero,
  OurBrandsSection,
  OurStoryMinimal,
  WhyWeChooseMinimal,
} from "@/components/shop/HomeSections";
import { ChloeEditTransition } from "@/components/shop/ChloeEditTransition";
import { cbcV4Assets, cbcV4Brand } from "@/lib/brand/chosen-by-chloe";
import { getActiveBrands } from "@/lib/brands";
import { fetchCatalogProducts } from "@/lib/brands/catalog";
import { productBelongsToBrand } from "@/lib/brands/match";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";

const tenant = getActiveTenant();

export const metadata: Metadata = {
  title: cbcV4Brand.displayName,
  description: tenant.storefront.description,
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/`
      : undefined,
  },
  openGraph: {
    title: cbcV4Brand.displayName,
    description: tenant.storefront.description,
    images: [{ url: cbcV4Assets.logoPrimaryHorizontal, alt: cbcV4Brand.logoAlt }],
  },
};

/**
 * Chosen by Chloe Storefront Shell V1 — LOCKED.
 * Spec: docs/chosen-by-chloe-storefront-spec.md
 * Do not redesign; populate Chloe Edit from catalogue in a later sprint only.
 */
export default async function Home() {
  const brands = getActiveBrands();
  const products = await fetchCatalogProducts();
  const brandsWithCounts = brands.map((brand) => ({
    brand,
    productCount: products.filter((p) => productBelongsToBrand(p.brand, brand)).length,
  }));

  return (
    <div className="relative min-h-full w-full">
      <RecoveryRedirect />
      <ShopHeader compact />
      <HomeHero />
      <ChloeEditTransition>
        <ChloeEditSection products={[]} />
      </ChloeEditTransition>
      <OurBrandsSection brands={brandsWithCounts} />
      <WhyWeChooseMinimal />
      <OurStoryMinimal />
      <ShopFooter />
    </div>
  );
}
