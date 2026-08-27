/**
 * Normalize Tonies Blink24 section headers into shop-facing categories.
 */
const RAW_TO_DISPLAY: Record<string, string> = {
  "stories and songs": "Stories & Songs",
  disney: "Disney",
  "julia donaldson": "Julia Donaldson",
  "clever pocket tonies - book tonies": "Book Tonies",
  "clever pocket tonies": "Pocket Tonies",
  "creative-tonies": "Creative Tonies",
  "creative tonies": "Creative Tonies",
  "tonieplay games, stories & controller": "Tonieplay",
  "carry cases": "Accessories",
  "toniebox 2 sleeves": "Accessories",
  backpacks: "Accessories",
  other: "Other",
  "august new realeases -19th august launch": "New Releases",
  "august new releases -19th august launch": "New Releases",
  "favourite children's songs": "Music",
  music: "Music",
  "favourite classics and tales": "Classics & Tales",
  headphones: "Headphones",
  "bluetooth headphones": "Headphones",
  "my first tonies": "My First Tonies",
  "starter sets - toniebox 2": "Toniebox 2",
  "cuddle tonies": "Cuddle Tonies",
  steiff: "Steiff",
};

/** Preferred chip order on the Tonies shop. */
export const TONIES_CATEGORY_ORDER = [
  "Toniebox 2",
  "Tonieplay",
  "Stories & Songs",
  "Disney",
  "Julia Donaldson",
  "My First Tonies",
  "Cuddle Tonies",
  "Creative Tonies",
  "Book Tonies",
  "Pocket Tonies",
  "Music",
  "Classics & Tales",
  "New Releases",
  "Headphones",
  "Accessories",
  "Steiff",
  "Other",
] as const;

export function normalizeToniesCategory(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "Other";
  const key = trimmed.toLowerCase().replace(/\s+/g, " ");
  return RAW_TO_DISPLAY[key] ?? titleCaseCategory(trimmed);
}

function titleCaseCategory(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export function sortToniesCategories(categories: string[]): string[] {
  const rank = new Map(TONIES_CATEGORY_ORDER.map((c, i) => [c, i]));
  return [...categories].sort((a, b) => {
    const ra = rank.get(a as (typeof TONIES_CATEGORY_ORDER)[number]) ?? 1000;
    const rb = rank.get(b as (typeof TONIES_CATEGORY_ORDER)[number]) ?? 1000;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}
