import { cbcV4Assets, cbcV4Brand } from "@/lib/brand/chosen-by-chloe";

type BrandLogoProps = {
  /** Defaults to primary horizontal master */
  variant?: "primary-horizontal" | "primary-stacked" | "cc-signature";
  className?: string;
  priority?: boolean;
};

const SRC: Record<NonNullable<BrandLogoProps["variant"]>, string> = {
  "primary-horizontal": cbcV4Assets.logoPrimaryHorizontal,
  "primary-stacked": cbcV4Assets.logoPrimaryStacked,
  "cc-signature": cbcV4Assets.ccSignature,
};

/**
 * Renders approved V4 raster assets only — never HTML wordmarks.
 */
export function BrandLogo({
  variant = "primary-horizontal",
  className,
  priority = false,
}: BrandLogoProps) {
  const alt = variant === "cc-signature" ? cbcV4Brand.ccAlt : cbcV4Brand.logoAlt;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC[variant]}
      alt={alt}
      className={className}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
