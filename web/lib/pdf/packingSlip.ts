import "server-only";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { PackingSlipData } from "@/types/order";
import { BRAND } from "@/lib/brand";
import { PackingSlipDocument } from "@/components/pdf/PackingSlip";

async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

async function fetchLogoAsDataUri(): Promise<string> {
  const dataUri = await fetchAsDataUri(BRAND.logoUrl);
  return dataUri ?? BRAND.logoUrl;
}

export type PackingSlipItemImages = Record<number, string[]>;

/** Generate a branded A4 packing slip PDF for the given order data. */
export async function generatePackingSlipPdf(data: PackingSlipData): Promise<Buffer> {
  const logoSrc = await fetchLogoAsDataUri();

  const itemImages: PackingSlipItemImages = {};
  await Promise.all(
    data.items.map(async (item, index) => {
      const resolved: string[] = [];
      for (const url of item.imageUrls.slice(0, 3)) {
        const dataUri = await fetchAsDataUri(url);
        if (dataUri) resolved.push(dataUri);
      }
      if (resolved.length > 0) itemImages[index] = resolved;
    }),
  );

  const element = React.createElement(PackingSlipDocument, {
    data,
    logoSrc,
    itemImages,
  });
  const buffer = await renderToBuffer(
    element as React.ReactElement<DocumentProps>,
  );
  return Buffer.from(buffer);
}
