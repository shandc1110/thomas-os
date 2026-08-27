import type { AssortmentStatus } from "@/lib/types";
import { ASSORTMENT_STATUSES } from "@/lib/inventory/assortment";

const OPTION_LABELS: Record<AssortmentStatus, string> = {
  active: "Active",
  paused: "Paused",
  retired: "Retired",
};

export function AssortmentStatusSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: AssortmentStatus | null;
  onChange: (value: AssortmentStatus) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value;
        if (next === "active" || next === "paused" || next === "retired") {
          onChange(next);
        }
      }}
      className={
        className ??
        "rounded-2xl border border-sand bg-white px-3 py-2 text-sm outline-none focus:border-clay"
      }
    >
      <option value="" disabled>
        Not reviewed
      </option>
      {ASSORTMENT_STATUSES.map((status) => (
        <option key={status} value={status}>
          {OPTION_LABELS[status]}
        </option>
      ))}
    </select>
  );
}
