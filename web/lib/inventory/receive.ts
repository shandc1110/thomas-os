import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStockMovement } from "./movements";
import type { GoodsReceipt } from "@/types/warehouse";

async function allocateReceiptNumber(supabase: SupabaseClient): Promise<string> {
  const { count } = await supabase
    .from("goods_receipts")
    .select("id", { count: "exact", head: true });
  return `GRN-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

export type ReceiveLineInput = {
  product_id: string | number;
  quantity_expected?: number;
  quantity_received: number;
};

export async function receiveGoods(
  supabase: SupabaseClient,
  input: {
    warehouse_id: string;
    location_id: string;
    po_reference?: string;
    notes?: string;
    received_by?: string;
    lines: ReceiveLineInput[];
  },
): Promise<{ receipt: GoodsReceipt | null; error: string | null }> {
  if (!input.lines.length) return { receipt: null, error: "No lines to receive." };

  const receiptNumber = await allocateReceiptNumber(supabase);

  const { data: receipt, error: receiptError } = await supabase
    .from("goods_receipts")
    .insert({
      receipt_number: receiptNumber,
      po_reference: input.po_reference ?? null,
      warehouse_id: input.warehouse_id,
      location_id: input.location_id,
      notes: input.notes ?? null,
      received_by: input.received_by ?? "system",
      status: "completed",
    })
    .select()
    .single();

  if (receiptError || !receipt) {
    return { receipt: null, error: receiptError?.message ?? "Failed to create receipt." };
  }

  for (const line of input.lines) {
    if (line.quantity_received <= 0) continue;

    await supabase.from("goods_receipt_lines").insert({
      receipt_id: receipt.id,
      product_id: line.product_id,
      quantity_expected: line.quantity_expected ?? line.quantity_received,
      quantity_received: line.quantity_received,
    });

    const { error: movError } = await createStockMovement(supabase, {
      movement_type: "goods_received",
      product_id: line.product_id,
      quantity: line.quantity_received,
      warehouse_id: input.warehouse_id,
      location_id: input.location_id,
      reference_type: "goods_receipt",
      reference_id: receiptNumber,
      reason: `Goods receipt ${receiptNumber}`,
      notes: input.po_reference ? `PO: ${input.po_reference}` : undefined,
      user_name: input.received_by,
      bucket: "available",
    });

    if (movError) {
      console.error(`receiveGoods movement failed for product ${line.product_id}:`, movError);
      return { receipt: null, error: movError };
    }
  }

  console.info(`[inventory] Goods receipt ${receiptNumber} completed with ${input.lines.length} lines`);

  return {
    receipt: {
      id: receipt.id,
      receipt_number: receipt.receipt_number,
      po_reference: receipt.po_reference,
      warehouse_id: receipt.warehouse_id,
      location_id: receipt.location_id,
      status: receipt.status,
      notes: receipt.notes,
      received_by: receipt.received_by,
      created_at: receipt.created_at,
    },
    error: null,
  };
}
