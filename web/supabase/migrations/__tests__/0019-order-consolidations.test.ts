import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("0019 order consolidations migration", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../../supabase/migrations/0019_order_consolidations.sql"),
    "utf8",
  );

  it("creates consolidations and membership tables without mutating orders", () => {
    expect(sql).toMatch(/create table if not exists public\.order_consolidations/i);
    expect(sql).toMatch(/create table if not exists public\.order_consolidation_orders/i);
    expect(sql).toMatch(/create table if not exists public\.order_invoices/i);
    expect(sql).not.toMatch(/alter table public\.orders/i);
  });

  it("includes match key, delivery review flag, and status lifecycle", () => {
    expect(sql).toMatch(/match_key text not null/);
    expect(sql).toMatch(/delivery_review_required boolean not null default false/);
    expect(sql).toMatch(/'draft', 'ready', 'invoiced', 'fulfilled', 'cancelled'/);
  });

  it("enforces one membership per order and one invoice per consolidation", () => {
    expect(sql).toMatch(/order_consolidation_orders_order_unique_uidx/);
    expect(sql).toMatch(/unique \(consolidation_id\)/);
    expect(sql).toMatch(/unique \(organization_id, invoice_number\)/);
  });
});
