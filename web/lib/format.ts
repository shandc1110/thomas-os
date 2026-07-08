export function formatPrice(value: number | null | undefined): string {
  const amount = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(amount);
}
