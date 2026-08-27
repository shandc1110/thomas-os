import { ProductAvailability } from "@/components/products/ProductAvailability";
import { ProductGallery } from "@/components/products/ProductGallery";
import { ProductInformation } from "@/components/products/ProductInformation";
import { ProductPurchase } from "@/components/products/ProductPurchase";
import type { Product } from "@/lib/types";

type ProductPageContentProps = {
  product: Product;
};

export function ProductPageContent({ product }: ProductPageContentProps) {
  const images = [
    ...(product.image_url ? [product.image_url] : []),
    ...product.gallery_images.filter((url) => url && url !== product.image_url),
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
      <ProductGallery name={product.name} images={images} />
      <div className="flex flex-col gap-6">
        <ProductInformation product={product} />
        <ProductAvailability product={product} />
        <ProductPurchase product={product} />
      </div>
    </div>
  );
}
