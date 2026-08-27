import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandCatalog } from "@/components/brands/BrandCatalog";
import { BrandHero } from "@/components/brands/BrandHero";
import { ShopFooter } from "@/components/shop/ShopFooter";
import { ShopHeader } from "@/components/shop/ShopHeader";
import {
  getActiveBrands,
  getAllBrandSlugs,
  getBrandBySlug,
} from "@/lib/brands";
import { fetchBrandProducts } from "@/lib/brands/catalog";
import { cbcV4Brand } from "@/lib/brand/chosen-by-chloe";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function generateStaticParams() {
  return getAllBrandSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand || !brand.active) {
    return { title: `Brand not found | ${cbcV4Brand.displayName}` };
  }

  const canonical = `${siteOrigin()}/brands/${brand.slug}`;
  return {
    title: brand.metaTitle,
    description: brand.metaDescription,
    alternates: { canonical },
    openGraph: {
      title: brand.metaTitle,
      description: brand.metaDescription,
      url: canonical,
      type: "website",
    },
  };
}

export default async function BrandPage({ params }: PageProps) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);

  if (!brand || !brand.active) {
    notFound();
  }

  const products = await fetchBrandProducts(brand);
  const otherBrands = getActiveBrands().filter((b) => b.slug !== brand.slug);

  return (
    <div className="relative min-h-full w-full">
      <ShopHeader compact />
      <main className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-8">
        <BrandHero brand={brand} productCount={products.length} />
        <BrandCatalog
          products={products}
          enableBrowse={brand.slug === "tonies" || brand.slug === "micro-scooters"}
        />
        {otherBrands.length > 0 && (
          <p className="mt-10 pb-6 text-center text-sm text-muted">
            Looking for something else?{" "}
            {otherBrands.map((b, i) => (
              <span key={b.slug}>
                {i > 0 && (i === otherBrands.length - 1 ? " or " : ", ")}
                <Link
                  href={`/brands/${b.slug}`}
                  className="font-medium text-charcoal underline-offset-2 hover:underline"
                >
                  {b.name}
                </Link>
              </span>
            ))}
          </p>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}
