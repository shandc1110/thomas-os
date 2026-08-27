import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { PackingSlipData } from "@/types/order";
import { cbcV4Assets } from "@/lib/brand/chosen-by-chloe";
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

/** Load V4 primary wordmark from /public for PDF embedding (no network). */
async function loadPrimaryLogoDataUri(): Promise<string> {
  const relative = cbcV4Assets.logoPrimaryHorizontal.replace(/^\//, "");
  const filePath = path.join(process.cwd(), "public", relative);
  try {
    const buffer = await fs.readFile(filePath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    // Fallback: try absolute URL if public file is unavailable in the runtime.
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (origin) {
      const remote = await fetchAsDataUri(`${origin}${cbcV4Assets.logoPrimaryHorizontal}`);
      if (remote) return remote;
    }
    return cbcV4Assets.logoPrimaryHorizontal;
  }
}

export type PackingSlipItemImages = Record<number, string[]>;

/** Generate a branded A4 packing slip PDF for the given order data. */
export async function generatePackingSlipPdf(data: PackingSlipData): Promise<Buffer> {
  const logoSrc = await loadPrimaryLogoDataUri();

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
