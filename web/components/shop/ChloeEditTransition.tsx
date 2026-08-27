import type { ReactNode } from "react";

/**
 * Soft handoff from Warm Ivory hero into The Chloe Edit (white).
 * No gradients, rules, or decoration — rhythm via surface + spacing only.
 */
export function ChloeEditTransition({ children }: { children: ReactNode }) {
  return <div className="bg-white">{children}</div>;
}
