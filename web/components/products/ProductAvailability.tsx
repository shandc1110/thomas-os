import {
  formatExpectedArrival,
  getOnHandStock,
  getPresellStock,
  getSellableStock,
  isPresellOnly,
} from "@/lib/presell";
import type { Product } from "@/lib/types";

type ProductAvailabilityProps = {
  product: Product;
};

export function ProductAvailability({ product }: ProductAvailabilityProps) {
  const onHand = getOnHandStock(product);
  const presellStock = getPresellStock(product);
  const sellable = getSellableStock(product);
  const presellOnly = isPresellOnly(product);
  const soldOut = sellable <= 0;
  const arrivalLabel = formatExpectedArrival(product.expected_arrival_month);

  if (soldOut) {
    return (
      <p className="text-sm text-muted">Currently unavailable.</p>
    );
  }

  return (
    <div className="space-y-1 text-sm text-muted">
      {presellOnly && arrivalLabel ? (
        <p>Pre-order · ships {arrivalLabel}</p>
      ) : null}
      {!presellOnly && onHand > 0 && onHand <= 3 ? (
        <p>Only {onHand} left in stock</p>
      ) : null}
      {!presellOnly && presellStock > 0 && arrivalLabel ? (
        <p>+{presellStock} incoming ({arrivalLabel})</p>
      ) : null}
    </div>
  );
}
