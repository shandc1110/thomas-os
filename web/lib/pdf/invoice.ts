import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { InvoiceDocumentData } from "@/types/consolidation";
import { cbcV4Assets } from "@/lib/brand/chosen-by-chloe";
import { InvoiceDocument } from "@/components/pdf/InvoiceDocument";

async function loadPrimaryLogoDataUri(): Promise<string> {
  const relative = cbcV4Assets.logoPrimaryHorizontal.replace(/^\//, "");
  const filePath = path.join(process.cwd(), "public", relative);
  try {
    const buffer = await fs.readFile(filePath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return cbcV4Assets.logoPrimaryHorizontal;
  }
}

/** Generate a branded A4 invoice PDF from consolidation/order snapshot data. */
export async function generateInvoicePdf(data: InvoiceDocumentData): Promise<Buffer> {
  const logoSrc = await loadPrimaryLogoDataUri();
  const element = React.createElement(InvoiceDocument, { data, logoSrc });
  const buffer = await renderToBuffer(
    element as React.ReactElement<DocumentProps>,
  );
  return Buffer.from(buffer);
}
