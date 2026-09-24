import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  round2,
} from "@/lib/orders/consolidation-core";
import { getConsolidationById } from "@/lib/orders/consolidation";
import { buildInvoiceDocumentData } from "@/lib/orders/invoice-build";
import { generateInvoicePdf } from "@/lib/pdf/invoice";
import {
  ensureInvoicesBucket,
  uploadInvoicePdf,
} from "@/lib/orders/invoice-storage";
import type {
  InvoiceLineSnapshot,
  InvoicePaymentLabel,
  OrderInvoiceRecord,
} from "@/types/consolidation";
import type { PaymentStatus } from "@/types/order";

export { buildInvoiceDocumentData };

type LineRow = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  products: { name: string; sku: string | null } | null;
};

function formatPeriod(d = new Date()): string {
  const y = d.getUTCFullYear().toString().slice(-2);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

async function allocateInvoiceNumber(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string> {
  const period = formatPeriod();
  const prefix = `CBC-INV-${period}-`;
  const { data } = await supabase
    .from("order_invoices")
    .select("invoice_number")
    .eq("organization_id", organizationId)
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(20);

  let max = 0;
  for (const row of data ?? []) {
    const match = String(row.invoice_number).match(
      new RegExp(`^CBC-INV-${period}-(\\d+)$`),
    );
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

function resolvePaymentLabel(
  orders: { payment_status: PaymentStatus | null; payment_method: string | null }[],
): InvoicePaymentLabel {
  if (orders.length === 0) return "DUE";
  if (orders.every((o) => o.payment_status === "paid")) return "PAID";
  return "DUE";
}

/**
 * Generate invoice for a consolidation. Idempotent: if an invoice already exists,
 * regenerate PDF into the same invoice_number / row (no new number).
 */
export async function generateConsolidationInvoice(
  supabase: SupabaseClient,
  organizationId: string,
  consolidationId: string,
): Promise<{ invoice: OrderInvoiceRecord | null; error: string | null }> {
  const { consolidation, error } = await getConsolidationById(
    supabase,
    organizationId,
    consolidationId,
  );
  if (error || !consolidation) {
    return { invoice: null, error: error ?? "Consolidation not found." };
  }
  if (consolidation.status === "cancelled") {
    return { invoice: null, error: "Cancelled consolidations cannot be invoiced." };
  }
  if (!consolidation.orders || consolidation.orders.length === 0) {
    return { invoice: null, error: "Consolidation has no orders." };
  }

  const orderIds = consolidation.orders.map((o) => o.id);
  const { data: itemRows, error: itemsErr } = await supabase
    .from("order_items")
    .select("id, order_id, product_id, quantity, price, products ( name, sku )")
    .in("order_id", orderIds);

  if (itemsErr) return { invoice: null, error: itemsErr.message };

  const orderNumberById = new Map(
    consolidation.orders.map((o) => [o.id, o.order_number]),
  );

  const lines: InvoiceLineSnapshot[] = ((itemRows ?? []) as unknown as LineRow[]).map(
    (row) => {
      const unit = Number(row.price);
      const qty = Number(row.quantity);
      return {
        order_id: row.order_id,
        order_number: orderNumberById.get(row.order_id) ?? null,
        order_item_id: String(row.id),
        product_id: String(row.product_id),
        description: row.products?.name ?? "Item",
        sku: row.products?.sku ?? null,
        quantity: qty,
        unit_price: unit,
        line_total: round2(unit * qty),
      };
    },
  );

  const merchandise_total = round2(lines.reduce((s, l) => s + l.line_total, 0));
  const delivery_total = 0;
  const discount_total = 0;
  const vat_total = 0;
  const grand_total = merchandise_total;

  const payment_status_label = resolvePaymentLabel(consolidation.orders);
  const payment_method =
    consolidation.orders.map((o) => o.payment_method).find(Boolean) ?? null;
  const phone =
    // phone not on summary — leave null; snapshot from first order if we extend later
    null;
  const order_numbers = consolidation.orders.map(
    (o) => o.order_number ?? o.id,
  );

  const invoiceDate = new Date().toISOString().slice(0, 10);
  const payload = {
    customer_name: consolidation.customer_name,
    customer_email: consolidation.customer_email,
    delivery_address: consolidation.delivery_address_snapshot,
    postcode: consolidation.postcode_snapshot,
    phone,
    payment_method,
    lines,
    notes: consolidation.delivery_review_required
      ? "Delivery charges require staff review (no delivery fee on source orders)."
      : null,
  };

  let invoiceId = consolidation.invoice_id;
  let invoice_number = consolidation.invoice?.invoice_number ?? null;

  if (invoiceId && invoice_number) {
    const { error: updErr } = await supabase
      .from("order_invoices")
      .update({
        invoice_date: invoiceDate,
        payment_status_label,
        merchandise_total,
        delivery_total,
        discount_total,
        vat_total,
        grand_total,
        order_numbers,
        payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .eq("organization_id", organizationId);
    if (updErr) return { invoice: null, error: updErr.message };
  } else {
    invoice_number = await allocateInvoiceNumber(supabase, organizationId);
    const { data: created, error: createErr } = await supabase
      .from("order_invoices")
      .insert({
        organization_id: organizationId,
        consolidation_id: consolidationId,
        invoice_number,
        invoice_date: invoiceDate,
        currency: consolidation.currency,
        payment_status_label,
        merchandise_total,
        delivery_total,
        discount_total,
        vat_total,
        grand_total,
        order_numbers,
        payload,
      })
      .select("*")
      .single();

    if (createErr || !created) {
      // Unique on consolidation_id → race; fetch existing
      if (createErr?.code === "23505") {
        const { data: existing } = await supabase
          .from("order_invoices")
          .select("*")
          .eq("consolidation_id", consolidationId)
          .maybeSingle();
        if (existing) {
          invoiceId = existing.id as string;
          invoice_number = existing.invoice_number as string;
        } else {
          return { invoice: null, error: createErr.message };
        }
      } else {
        return { invoice: null, error: createErr?.message ?? "Could not create invoice." };
      }
    } else {
      invoiceId = created.id as string;
      invoice_number = created.invoice_number as string;
    }

    await supabase
      .from("order_consolidations")
      .update({
        invoice_id: invoiceId,
        status: "invoiced",
        merchandise_total,
        grand_total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", consolidationId)
      .eq("organization_id", organizationId);
  }

  const docData = buildInvoiceDocumentData({
    invoiceNumber: invoice_number!,
    invoiceDate,
    currency: consolidation.currency,
    paymentStatusLabel: payment_status_label,
    paymentMethod: payment_method,
    customerName: consolidation.customer_name,
    customerEmail: consolidation.customer_email,
    phone,
    deliveryAddress: consolidation.delivery_address_snapshot,
    postcode: consolidation.postcode_snapshot,
    orderNumbers: order_numbers,
    lines,
    merchandiseTotal: merchandise_total,
    deliveryTotal: delivery_total,
    discountTotal: discount_total,
    vatTotal: vat_total,
    grandTotal: grand_total,
    notes: payload.notes,
  });

  const pdf = await generateInvoicePdf(docData);
  await ensureInvoicesBucket(supabase);
  const storagePath = `${organizationId}/${invoice_number}.pdf`;
  const upload = await uploadInvoicePdf(supabase, storagePath, pdf);
  if (upload.error) {
    return { invoice: null, error: upload.error };
  }

  await supabase
    .from("order_invoices")
    .update({
      pdf_storage_path: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId!);

  if (consolidation.status === "draft" || consolidation.status === "ready") {
    await supabase
      .from("order_consolidations")
      .update({
        status: "invoiced",
        invoice_id: invoiceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", consolidationId);
  }

  const { data: finalRow, error: finalErr } = await supabase
    .from("order_invoices")
    .select("*")
    .eq("id", invoiceId!)
    .single();

  if (finalErr || !finalRow) {
    return { invoice: null, error: finalErr?.message ?? "Invoice saved but reload failed." };
  }

  return {
    invoice: {
      id: finalRow.id as string,
      organization_id: finalRow.organization_id as string,
      consolidation_id: finalRow.consolidation_id as string,
      invoice_number: finalRow.invoice_number as string,
      invoice_date: String(finalRow.invoice_date),
      currency: finalRow.currency as string,
      payment_status_label: finalRow.payment_status_label as InvoicePaymentLabel,
      merchandise_total: Number(finalRow.merchandise_total),
      delivery_total: Number(finalRow.delivery_total),
      discount_total: Number(finalRow.discount_total),
      vat_total: Number(finalRow.vat_total),
      grand_total: Number(finalRow.grand_total),
      order_numbers: (finalRow.order_numbers as string[]) ?? [],
      pdf_storage_path: (finalRow.pdf_storage_path as string | null) ?? null,
      payload: finalRow.payload as OrderInvoiceRecord["payload"],
      created_at: finalRow.created_at as string,
      updated_at: finalRow.updated_at as string,
    },
    error: null,
  };
}

export async function downloadInvoicePdf(
  supabase: SupabaseClient,
  organizationId: string,
  consolidationId: string,
): Promise<{ buffer: Buffer; filename: string; error: string | null }> {
  const { data, error } = await supabase
    .from("order_invoices")
    .select("invoice_number, pdf_storage_path")
    .eq("organization_id", organizationId)
    .eq("consolidation_id", consolidationId)
    .maybeSingle();

  if (error || !data?.pdf_storage_path) {
    return {
      buffer: Buffer.alloc(0),
      filename: "",
      error: error?.message ?? "Invoice PDF not found. Generate the invoice first.",
    };
  }

  const { data: file, error: dlErr } = await supabase.storage
    .from("invoices")
    .download(data.pdf_storage_path as string);

  if (dlErr || !file) {
    return {
      buffer: Buffer.alloc(0),
      filename: "",
      error: dlErr?.message ?? "Could not download invoice PDF.",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    buffer,
    filename: `${data.invoice_number}.pdf`,
    error: null,
  };
}
