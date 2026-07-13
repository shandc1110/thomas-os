export function formatPrice(value: number | null | undefined): string {
  const amount = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(amount);
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

export function formatFulfilmentStatus(status: string | null | undefined): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "fulfilled":
      return "Fulfilled";
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
