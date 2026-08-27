import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = resolve(
  __dirname,
  "../0014_assortment_status.sql",
);

describe("0014_assortment_status migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("adds nullable assortment_status column", () => {
    expect(sql).toMatch(/add column if not exists assortment_status text/i);
    expect(sql).not.toMatch(/assortment_status\s+text\s+not null/i);
    expect(sql).not.toMatch(/default\s+'active'/i);
    expect(sql).not.toMatch(/default\s+'paused'/i);
    expect(sql).not.toMatch(/default\s+'retired'/i);
  });

  it("does not backfill or update existing rows", () => {
    expect(sql.toLowerCase()).not.toMatch(/\bupdate\s+public\.products\b/);
  });

  it("defines CHECK constraint for allowed values and NULL", () => {
    expect(sql).toContain("products_assortment_status_check");
    expect(sql).toMatch(/assortment_status is null/i);
    expect(sql).toContain("'active'");
    expect(sql).toContain("'paused'");
    expect(sql).toContain("'retired'");
  });

  it("creates partial index on non-null assortment_status", () => {
    expect(sql).toContain("products_assortment_status_idx");
    expect(sql).toMatch(/where assortment_status is not null/i);
  });
});

describe("AssortmentStatus type contract", () => {
  it("accepts null and allowed string literals at compile time", () => {
    const values: Array<import("@/lib/types").AssortmentStatus | null> = [
      null,
      "active",
      "paused",
      "retired",
    ];
    expect(values).toHaveLength(4);
  });
});
