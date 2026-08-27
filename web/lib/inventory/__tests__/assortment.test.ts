import { describe, expect, it, vi } from "vitest";
import {
  assortmentStatusLabel,
  bulkUpdateAssortmentStatus,
  getAssortmentCounts,
  isValidAssortmentStatus,
  updateProductAssortmentStatus,
} from "@/lib/inventory/assortment";

describe("assortmentStatusLabel", () => {
  it("displays NULL as Not reviewed", () => {
    expect(assortmentStatusLabel(null)).toBe("Not reviewed");
    expect(assortmentStatusLabel(undefined)).toBe("Not reviewed");
  });

  it("displays active, paused, and retired correctly", () => {
    expect(assortmentStatusLabel("active")).toBe("Active");
    expect(assortmentStatusLabel("paused")).toBe("Paused");
    expect(assortmentStatusLabel("retired")).toBe("Retired");
  });
});

describe("isValidAssortmentStatus", () => {
  it("accepts allowed values", () => {
    expect(isValidAssortmentStatus("active")).toBe(true);
    expect(isValidAssortmentStatus("paused")).toBe(true);
    expect(isValidAssortmentStatus("retired")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isValidAssortmentStatus(null)).toBe(false);
    expect(isValidAssortmentStatus("")).toBe(false);
    expect(isValidAssortmentStatus("draft")).toBe(false);
    expect(isValidAssortmentStatus("ACTIVE")).toBe(false);
    expect(isValidAssortmentStatus(1)).toBe(false);
  });
});

function createUpdateMock(selectData: Record<string, unknown>[]) {
  let capturedUpdate: Record<string, unknown> | null = null;
  const response = { data: selectData, error: null };

  const chain: {
    update: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
  } = {
    update: vi.fn((payload: Record<string, unknown>) => {
      capturedUpdate = payload;
      return chain;
    }),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    select: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: selectData[0] ?? null,
        error: null,
      })),
      then: (resolve: (value: typeof response) => void) => Promise.resolve(response).then(resolve),
    })),
  };

  return {
    from: vi.fn(() => chain),
    capturedUpdate: () => capturedUpdate,
  };
}

describe("updateProductAssortmentStatus", () => {
  it("updates only assortment_status and updated_at", async () => {
    const supabase = createUpdateMock([
      {
        id: "1",
        sku: "SKU-1",
        name: "Test",
        brand: "Brand",
        category: "Cat",
        price: 10,
        currency: "GBP",
        image_url: null,
        stock: 5,
        presell_enabled: false,
        presell_quantity: 0,
        active: true,
        status: "active",
        assortment_status: "active",
      },
    ]);

    const { product, error } = await updateProductAssortmentStatus(
      supabase as never,
      "1",
      "paused",
      "org-1",
    );

    expect(error).toBeNull();
    expect(product?.assortment_status).toBe("active");
    const payload = supabase.capturedUpdate();
    expect(payload).toEqual({
      assortment_status: "paused",
      updated_at: expect.any(String),
    });
    expect(Object.keys(payload ?? {})).toEqual(["assortment_status", "updated_at"]);
  });

  it("rejects invalid status without updating", async () => {
    const supabase = createUpdateMock([]);
    const { product, error } = await updateProductAssortmentStatus(
      supabase as never,
      "1",
      "draft" as never,
      "org-1",
    );
    expect(product).toBeNull();
    expect(error).toBe("Invalid assortment status.");
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe("bulkUpdateAssortmentStatus", () => {
  it("bulk update only sets assortment_status", async () => {
    const supabase = createUpdateMock([{ id: "1" }, { id: "2" }]);

    const { updated, failed, error } = await bulkUpdateAssortmentStatus(
      supabase as never,
      ["1", "2"],
      "retired",
      "org-1",
    );

    expect(error).toBeNull();
    expect(updated).toBe(2);
    expect(failed).toEqual([]);
    const payload = supabase.capturedUpdate();
    expect(payload).toEqual({
      assortment_status: "retired",
      updated_at: expect.any(String),
    });
    expect(Object.keys(payload ?? {})).toEqual(["assortment_status", "updated_at"]);
  });

  it("rejects invalid bulk status", async () => {
    const supabase = createUpdateMock([]);
    const result = await bulkUpdateAssortmentStatus(
      supabase as never,
      ["1"],
      "invalid" as never,
      "org-1",
    );
    expect(result.error).toBe("Invalid assortment status.");
    expect(result.updated).toBe(0);
  });
});

describe("getAssortmentCounts", () => {
  it("counts NULL as not reviewed and preserves other fields untouched", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [
              { assortment_status: null },
              { assortment_status: "active" },
              { assortment_status: "paused" },
              { assortment_status: "retired" },
            ],
            error: null,
          })),
        })),
      })),
    };

    const { counts, error } = await getAssortmentCounts(supabase as never, "org-1");

    expect(error).toBeNull();
    expect(counts).toEqual({
      all: 4,
      not_reviewed: 1,
      active: 1,
      paused: 1,
      retired: 1,
    });
  });
});
