/**
 * Render a sample Jane Smith consolidated invoice PDF for visual QA.
 *   npx tsx scripts/_sample-consolidation-invoice.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { InvoiceDocument } from "../components/pdf/InvoiceDocument";
import { cbcV4Assets } from "../lib/brand/chosen-by-chloe";
import { buildInvoiceDocumentData } from "../lib/orders/invoice-build";

async function main() {
  const data = buildInvoiceDocumentData({
    invoiceNumber: "CBC-INV-2609-SAMPLE",
    invoiceDate: "2026-09-24",
    currency: "GBP",
    paymentStatusLabel: "PAID",
    paymentMethod: "Bank transfer",
    customerName: "Jane Smith",
    customerEmail: "jane@example.com",
    phone: null,
    deliveryAddress: "10 Example Street\nLondon",
    postcode: "SW1A 1AA",
    orderNumbers: ["CBC-A", "CBC-B", "CBC-C"],
    lines: [
      {
        order_id: "a",
        order_number: "CBC-A",
        order_item_id: "i1",
        product_id: "p1",
        description: "Sample Product A",
        sku: "SKU-A",
        quantity: 1,
        unit_price: 29.99,
        line_total: 29.99,
      },
      {
        order_id: "b",
        order_number: "CBC-B",
        order_item_id: "i2",
        product_id: "p2",
        description: "Sample Product B with a longer name for wrapping checks",
        sku: "SKU-B-LONG",
        quantity: 1,
        unit_price: 49.99,
        line_total: 49.99,
      },
      {
        order_id: "c",
        order_number: "CBC-C",
        order_item_id: "i3",
        product_id: "p3",
        description: "Sample Product C",
        sku: "SKU-C",
        quantity: 1,
        unit_price: 20,
        line_total: 20,
      },
    ],
    merchandiseTotal: 99.98,
    deliveryTotal: 0,
    discountTotal: 0,
    vatTotal: 0,
    grandTotal: 99.98,
    notes: "Delivery charges require staff review (no delivery fee on source orders).",
  });

  const relative = cbcV4Assets.logoPrimaryHorizontal.replace(/^\//, "");
  const logoPath = path.join(process.cwd(), "public", relative);
  const logoSrc = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;

  const element = React.createElement(InvoiceDocument, { data, logoSrc });
  const buffer = Buffer.from(
    await renderToBuffer(element as React.ReactElement<DocumentProps>),
  );

  const outDir = path.join(process.cwd(), "tmp", "sprint12-invoice-qa");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "jane-smith-sample-invoice.pdf");
  writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
