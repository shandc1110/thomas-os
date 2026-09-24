/** Joybuy sometimes returns success/result as boolean or string "true"/"false". */
export function coerceJoybuyFlag(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return null;
}
