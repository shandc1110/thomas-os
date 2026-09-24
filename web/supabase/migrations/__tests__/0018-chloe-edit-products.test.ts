import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("0018 chloe_edit_products migration", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../../supabase/migrations/0018_chloe_edit_products.sql"),
    "utf8",
  );

  it("creates dedicated curation table (not products.chloe_edit)", () => {
    expect(sql).toMatch(/create table if not exists public\.chloe_edit_products/i);
    expect(sql).not.toMatch(/alter table public\.products[\s\S]*chloe_edit/i);
  });

  it("includes org + product uniqueness and position index", () => {
    expect(sql).toMatch(/unique \(organization_id, product_id\)/);
    expect(sql).toMatch(/position integer not null/);
    expect(sql).toMatch(/editorial_note text/);
    expect(sql).toMatch(/chloe_edit_products_org_position_idx/);
  });

  it("references products and organizations", () => {
    expect(sql).toMatch(/references public\.organizations/);
    expect(sql).toMatch(/references public\.products/);
  });
});
