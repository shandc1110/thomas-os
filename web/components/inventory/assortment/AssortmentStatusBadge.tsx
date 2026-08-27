import type { AssortmentStatus } from "@/lib/types";
import { assortmentStatusLabel } from "@/lib/inventory/assortment";

const BADGE_STYLES: Record<string, string> = {
  not_reviewed: "bg-sand/40 text-espresso ring-sand/60",
  active: "bg-green-50 text-green-800 ring-green-200",
  paused: "bg-amber-50 text-amber-900 ring-amber-200",
  retired: "bg-linen text-muted ring-sand/60",
};

function styleKey(status: AssortmentStatus | null | undefined): string {
  if (status == null) return "not_reviewed";
  return status;
}

export function AssortmentStatusBadge({
  status,
}: {
  status: AssortmentStatus | null | undefined;
}) {
  const key = styleKey(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${BADGE_STYLES[key]}`}
    >
      {assortmentStatusLabel(status)}
    </span>
  );
}
