/**
 * Audit + fix Mideer pricing:
 *   target = max(calcConsolePrice(cost, weight), max(order_items.price for product))
 *
 * Usage:
 *   npx tsx scripts/audit-mideer-pricing.ts --dry
 *   npx tsx scripts/audit-mideer-pricing.ts
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";
import { calcConsolePriceFromGrams } from "../lib/pricing";

loadEnv();

const dryRun = process.argv.includes("--dry");

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  cost_price: number | null;
  weight_grams: number | null;
  price: number | null;
  active: boolean | null;
};

type AuditRow = {
  id: string;
  sku: string;
  name: string;
  active: boolean;
  cost: number | null;
  weightGrams: number | null;
  currentPrice: number | null;
  formulaPrice: number | null;
  maxOrderPrice: number | null;
  orderLineCount: number;
  targetPrice: number | null;
  delta: number | null;
  action: "ok" | "raise" | "no_basis" | "missing_cost";
};

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  console.log("Loading Mideer products…");
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id, sku, name, cost_price, weight_grams, price, active")
    .ilike("brand", "%mideer%")
    .order("sku");
  if (pErr) throw pErr;

  const productList = (products ?? []) as ProductRow[];
  const ids = productList.map((p) => p.id);
  console.log(`Products: ${productList.length}`);

  console.log("Loading order_items prices…");
  const maxByProduct = new Map<string, { max: number; count: number }>();

  // Paginate order_items in chunks of product ids
  const chunkSize = 100;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data: items, error: iErr } = await supabase
      .from("order_items")
      .select("product_id, price, quantity")
      .in("product_id", chunk);
    if (iErr) throw iErr;
    for (const row of items ?? []) {
      const pid = String(row.product_id);
      const price = Number(row.price);
      if (!Number.isFinite(price) || price <= 0) continue;
      const cur = maxByProduct.get(pid) ?? { max: 0, count: 0 };
      cur.max = Math.max(cur.max, price);
      cur.count += 1;
      maxByProduct.set(pid, cur);
    }
  }

  const audit: AuditRow[] = [];
  for (const p of productList) {
    const cost = p.cost_price != null ? Number(p.cost_price) : null;
    const weight = p.weight_grams != null ? Number(p.weight_grams) : null;
    const current = p.price != null ? Number(p.price) : null;
    const formula =
      cost != null && cost > 0 ? calcConsolePriceFromGrams(cost, weight) : null;
    const order = maxByProduct.get(String(p.id));
    const maxOrder = order?.max ?? null;

    const candidates = [formula, maxOrder].filter(
      (n): n is number => n != null && Number.isFinite(n) && n > 0,
    );
    const target = candidates.length ? Math.max(...candidates) : null;

    let action: AuditRow["action"] = "no_basis";
    if (target == null) {
      action = cost == null || cost <= 0 ? "missing_cost" : "no_basis";
    } else if (current == null || Math.abs(current - target) > 0.009) {
      // Only raise / set to target — never lower below max(formula, order)
      if (current == null || current < target - 0.009) action = "raise";
      else if (current > target + 0.009) {
        // Current is higher than both — leave it (already highest)
        action = "ok";
      } else action = "ok";
    } else {
      action = "ok";
    }

    // Reinterpret: target is the required floor. If current >= target, ok.
    // If current < target, raise to target.
    if (target != null && current != null && current >= target - 0.009) {
      action = "ok";
    } else if (target != null && (current == null || current < target - 0.009)) {
      action = "raise";
    }

    audit.push({
      id: String(p.id),
      sku: String(p.sku),
      name: String(p.name ?? ""),
      active: p.active !== false,
      cost,
      weightGrams: weight,
      currentPrice: current,
      formulaPrice: formula,
      maxOrderPrice: maxOrder,
      orderLineCount: order?.count ?? 0,
      targetPrice: target,
      delta: target != null && current != null ? Math.round((target - current) * 100) / 100 : null,
      action,
    });
  }

  const raise = audit.filter((a) => a.action === "raise");
  const ok = audit.filter((a) => a.action === "ok");
  const missingCost = audit.filter((a) => a.action === "missing_cost");
  const noBasis = audit.filter((a) => a.action === "no_basis");
  const withOrders = audit.filter((a) => a.orderLineCount > 0);
  const formulaWins = raise.filter(
    (a) =>
      a.formulaPrice != null &&
      (a.maxOrderPrice == null || a.formulaPrice >= a.maxOrderPrice),
  );
  const orderWins = raise.filter(
    (a) =>
      a.maxOrderPrice != null &&
      (a.formulaPrice == null || a.maxOrderPrice > a.formulaPrice),
  );

  console.log("\n========== AUDIT SUMMARY ==========");
  console.log(`Total Mideer products:     ${audit.length}`);
  console.log(`Already correct (OK):      ${ok.length}`);
  console.log(`Need raise to target:      ${raise.length}`);
  console.log(`  driven by formula:       ${formulaWins.length}`);
  console.log(`  driven by order_items:   ${orderWins.length}`);
  console.log(`Missing cost (no formula): ${missingCost.length}`);
  console.log(`No pricing basis:          ${noBasis.length}`);
  console.log(`Have order history:        ${withOrders.length}`);

  if (raise.length) {
    console.log("\nRaises (sku | current → target | formula | maxOrder):");
    for (const a of raise.slice(0, 40)) {
      console.log(
        `  ${a.sku.padEnd(12)} ¥${String(a.currentPrice ?? "—").padStart(7)} → ¥${String(a.targetPrice).padStart(7)}  f=${a.formulaPrice ?? "—"}  o=${a.maxOrderPrice ?? "—"}  ${a.name.slice(0, 40)}`,
      );
    }
    if (raise.length > 40) console.log(`  … +${raise.length - 40} more`);
  }

  const reportPath = "scripts/_mideer-pricing-audit.json";
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dryRun,
        summary: {
          total: audit.length,
          ok: ok.length,
          raise: raise.length,
          formulaWins: formulaWins.length,
          orderWins: orderWins.length,
          missingCost: missingCost.length,
          noBasis: noBasis.length,
          withOrders: withOrders.length,
        },
        raises: raise,
        missingCost,
        sampleOk: ok.slice(0, 20),
        all: audit,
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${reportPath}`);

  if (dryRun) {
    console.log("\nDRY RUN — no DB updates.");
    return;
  }

  console.log(`\nApplying ${raise.length} price updates…`);
  let updated = 0;
  let failed = 0;
  for (const a of raise) {
    if (a.targetPrice == null) continue;
    const { error } = await supabase
      .from("products")
      .update({
        price: a.targetPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", a.id);
    if (error) {
      console.error(`FAIL ${a.sku}:`, error.message);
      failed++;
    } else {
      updated++;
    }
  }
  console.log(`Updated ${updated}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
