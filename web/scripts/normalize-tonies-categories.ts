/**
 * Backfill Tonies products with normalized shop categories.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";
import { normalizeToniesCategory } from "../lib/brands/tonies-categories";

loadEnv();

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase
    .from("products")
    .select("id, sku, category")
    .ilike("brand", "%tonies%");
  if (error) throw error;

  let changed = 0;
  for (const p of data ?? []) {
    const next = normalizeToniesCategory(p.category as string | null);
    if (next === p.category) continue;
    const { error: upErr } = await supabase
      .from("products")
      .update({ category: next, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    if (upErr) {
      console.error(p.sku, upErr.message);
      continue;
    }
    changed++;
  }

  const counts = new Map<string, number>();
  const { data: after } = await supabase
    .from("products")
    .select("category")
    .ilike("brand", "%tonies%")
    .eq("active", true);
  for (const p of after ?? []) {
    const c = String(p.category ?? "Other");
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }

  console.log(`Normalized ${changed} of ${data?.length ?? 0} Tonies products.\n`);
  for (const [c, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${String(n).padStart(4)}  ${c}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
