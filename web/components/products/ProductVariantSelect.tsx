"use client";

import type { Product } from "@/lib/types";
import { variantOptionLabel } from "@/lib/products/variants";

type ProductVariantSelectProps = {
  variants: Product[];
  selectedId: Product["id"];
  onChange: (variant: Product) => void;
  disabled?: boolean;
};

export function ProductVariantSelect({
  variants,
  selectedId,
  onChange,
  disabled,
}: ProductVariantSelectProps) {
  if (variants.length <= 1) return null;

  const option1Label = inferOptionLabel(variants, "option1");
  const option2Label = inferOptionLabel(variants, "option2");

  const selected = variants.find((v) => String(v.id) === String(selectedId)) ?? variants[0];
  const option1Values = uniqueOptionValues(variants, "option1");
  const option2Values = uniqueOptionValues(variants, "option2");

  function pick(option1: string | null, option2: string | null) {
    const match = variants.find((v) => {
      const o1 = normalizeOption(v.variant_option1);
      const o2 = normalizeOption(v.variant_option2);
      const want1 = normalizeOption(option1);
      const want2 = normalizeOption(option2);
      if (want1 && o1 !== want1) return false;
      if (want2 && o2 !== want2) return false;
      return true;
    });
    if (match) onChange(match);
  }

  if (option1Values.length > 1 && option2Values.length > 1) {
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-charcoal">{option1Label}</span>
          <select
            disabled={disabled}
            value={normalizeOption(selected.variant_option1) ?? ""}
            onChange={(e) =>
              pick(e.target.value || null, normalizeOption(selected.variant_option2))
            }
            className="mt-1.5 w-full border border-sand bg-white px-3 py-2.5 text-sm outline-none focus:border-sage"
          >
            {option1Values.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-charcoal">{option2Label}</span>
          <select
            disabled={disabled}
            value={normalizeOption(selected.variant_option2) ?? ""}
            onChange={(e) =>
              pick(normalizeOption(selected.variant_option1), e.target.value || null)
            }
            className="mt-1.5 w-full border border-sand bg-white px-3 py-2.5 text-sm outline-none focus:border-sage"
          >
            {option2Values.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return (
    <label className="block text-sm">
      <span className="font-medium text-charcoal">Choose option</span>
      <select
        disabled={disabled}
        value={String(selected.id)}
        onChange={(e) => {
          const next = variants.find((v) => String(v.id) === e.target.value);
          if (next) onChange(next);
        }}
        className="mt-1.5 w-full border border-sand bg-white px-3 py-2.5 text-sm outline-none focus:border-sage"
      >
        {variants.map((variant) => (
          <option key={String(variant.id)} value={String(variant.id)}>
            {variantOptionLabel(variant) || variant.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function normalizeOption(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v || v === "Default Title") return null;
  return v;
}

function uniqueOptionValues(variants: Product[], field: "option1" | "option2"): string[] {
  const key = field === "option1" ? "variant_option1" : "variant_option2";
  const values = new Set<string>();
  for (const v of variants) {
    const norm = normalizeOption(v[key]);
    if (norm) values.add(norm);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function inferOptionLabel(variants: Product[], field: "option1" | "option2"): string {
  const key = field === "option1" ? "variant_option1" : "variant_option2";
  const values = uniqueOptionValues(variants, field);
  if (values.length === 0) return field === "option1" ? "Size" : "Colour";
  const sample = values[0].toLowerCase();
  if (/\b(uk|eu|us)\s*\d|^\d+(-\d+)?$/.test(sample) || sample.includes("size")) return "Size";
  if (/\b(red|blue|green|navy|pink|stone|yellow|khaki|black|white)\b/.test(sample)) return "Colour";
  return field === "option1" ? "Option" : "Colour";
}
