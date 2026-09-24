/**
 * Customer-facing product imagery — complete source image must remain visible.
 * Prefer object-contain. Do not use object-cover for product photos.
 */

export const PRODUCT_IMAGE_CONTAIN_CLASS =
  "h-full w-full object-contain object-center" as const;

type ProductImageProps = {
  src: string;
  alt: string;
  /** Outer frame — keep a stable footprint; must not force cropping via object-cover. */
  frameClassName?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
};

/**
 * Stable frame + contained product photo (no crop, no distortion).
 */
export function ProductImage({
  src,
  alt,
  frameClassName = "relative aspect-[4/5] w-full overflow-hidden bg-transparent",
  imgClassName = "",
  loading = "lazy",
}: ProductImageProps) {
  return (
    <div className={frameClassName}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`${PRODUCT_IMAGE_CONTAIN_CLASS} ${imgClassName}`.trim()}
        loading={loading}
      />
    </div>
  );
}
