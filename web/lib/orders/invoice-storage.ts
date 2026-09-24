import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "invoices";

export async function ensureInvoicesBucket(
  supabase: SupabaseClient,
): Promise<{ error: string | null }> {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return { error: null };

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
  });
  if (error && !error.message.toLowerCase().includes("already")) {
    return { error: error.message };
  }
  return { error: null };
}

export async function uploadInvoicePdf(
  supabase: SupabaseClient,
  objectPath: string,
  pdf: Buffer,
): Promise<{ path: string | null; error: string | null }> {
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, pdf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) return { path: null, error: error.message };
  return { path: objectPath, error: null };
}
