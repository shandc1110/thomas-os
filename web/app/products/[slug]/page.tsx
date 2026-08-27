import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProductPageContent } from "@/components/products/ProductPageContent";
import { ShopFooter } from "@/components/shop/ShopFooter";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { cbcV4Brand } from "@/lib/brand/chosen-by-chloe";
import { fetchProductBySlug } from "@/lib/products/lookup";
import { buildProductSlug, productUrl } from "@/lib/products/slug";

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    return { title: `Product not found | ${cbcV4Brand.displayName}` };
  }

  const canonical = `${siteOrigin()}${productUrl(product)}`;
  const description =
    product.description?.trim() ||
    [product.brand, product.name].filter(Boolean).join(" — ");

  return {
    title: `${product.name} | ${cbcV4Brand.displayName}`,
    description,
    alternates: { canonical },
    openGraph: {
      title: product.name,
      description,
      url: canonical,
      type: "website",
      images: product.image_url ? [{ url: product.image_url, alt: product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const canonicalSlug = buildProductSlug(product);
  if (slug !== canonicalSlug) {
    redirect(productUrl(product));
  }

  return (
    <div className="relative min-h-full w-full">
      <ShopHeader compact />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
        <ProductPageContent product={product} />
      </main>
      <ShopFooter />
    </div>
  );
}
