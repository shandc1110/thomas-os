import "server-only";
import { renderBarcodePng } from "@/lib/barcode/generate";

export type LabelType = "product" | "shelf" | "location";

export async function renderWarehouseLabel(
  type: LabelType,
  value: string,
  format: "ean" | "code128" | "qr" = "code128",
): Promise<Buffer> {
  const labelText =
    type === "location" ? `LOC:${value}` : type === "shelf" ? `SHELF:${value}` : value;

  return renderBarcodePng(labelText, format);
}
