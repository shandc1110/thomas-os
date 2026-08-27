export function formatPrice(
  value: number | null | undefined,
  currency: string | null | undefined = "CNY",
): string {
  return formatOrderPrice(value, currency);
}

export function formatOrderPrice(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  const value = typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
  const code = currency === "GBP" ? "GBP" : "CNY";
  const locale = currency === "GBP" ? "en-GB" : "zh-CN";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
  }).format(value);
}

export function formatPaymentStatus(status: string | null | undefined): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Awaiting payment";
    case "refunded":
      return "Refunded";
    default:
      return "Unpaid";
  }
}

export function formatFulfilmentStatus(status: string | null | undefined): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "fulfilled":
      return "Fulfilled";
    case "awaiting_stock":
      return "Pre-order";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}

export function formatWarehouseStatus(status: string | null | undefined): string {
  if (!status) return "Pending";
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
