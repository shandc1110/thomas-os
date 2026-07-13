import "server-only";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { PackingSlipData } from "@/types/order";
import { BRAND } from "@/lib/brand";
import { PackingSlipDocument } from "@/components/pdf/PackingSlip";

async function fetchLogoAsDataUri(): Promise<string> {
  const response = await fetch(BRAND.logoUrl);
  if (!response.ok) {
    console.warn("Could not fetch logo for packing slip, using URL directly.");
    return BRAND.logoUrl;
  }
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  return `data:${contentType};base64,${base64}`;
}

/** Generate a branded A4 packing slip PDF for the given order data. */
export async function generatePackingSlipPdf(data: PackingSlipData): Promise<Buffer> {
  const logoSrc = await fetchLogoAsDataUri();
  const element = React.createElement(PackingSlipDocument, { data, logoSrc });
  const buffer = await renderToBuffer(
    element as React.ReactElement<DocumentProps>,
  );
  return Buffer.from(buffer);
}
