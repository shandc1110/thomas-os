import "server-only";
import bwipjs from "bwip-js";
import QRCode from "qrcode";

export type BarcodeFormat = "ean" | "qr" | "code128";

/** Generate a valid EAN-13 barcode from SKU (pads and computes check digit). */
export function generateEan13(sku: string): string {
  const digits = sku.replace(/\D/g, "").padStart(12, "0").slice(-12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(digits[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return digits + String(check);
}

export async function renderBarcodePng(
  value: string,
  format: BarcodeFormat,
): Promise<Buffer> {
  if (format === "qr") {
    const png = await QRCode.toBuffer(value, { width: 200, margin: 1 });
    return Buffer.from(png);
  }

  const bcid = format === "ean" ? "ean13" : "code128";
  const text = format === "ean" ? generateEan13(value) : value;

  const png = await bwipjs.toBuffer({
    bcid,
    text,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: "center",
  });

  return Buffer.from(png);
}

/** Ensure product has a barcode; generate EAN-13 from SKU if missing. */
export function ensureBarcode(sku: string, existing: string | null): string {
  return existing ?? generateEan13(sku);
}
