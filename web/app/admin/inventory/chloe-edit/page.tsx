"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  ChloeEditAdminRow,
  ChloeEditCandidateRow,
} from "@/lib/storefront/chloe-edit-admin";

export default function ChloeEditAdminPage() {
  const [rows, setRows] = useState<ChloeEditAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [candidates, setCandidates] = useState<ChloeEditCandidateRow[]>([]);
  const [searching, setSearching] = useState(false);

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [positionDrafts, setPositionDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/inventory/chloe-edit");
    const result = await res.json();
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Could not load Chloe's Edit.");
      return;
    }
    const next = (result.products ?? []) as ChloeEditAdminRow[];
    setRows(next);
    const notes: Record<string, string> = {};
    const positions: Record<string, string> = {};
    for (const row of next) {
      notes[row.productId] = row.editorialNote ?? "";
      positions[row.productId] = String(row.position);
    }
    setNoteDrafts(notes);
    setPositionDrafts(positions);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = searchInput.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/inventory/chloe-edit?search=${encodeURIComponent(q)}`,
        );
        const result = await res.json();
        if (!result.success) {
          setCandidates([]);
          setError(result.error ?? "Search failed.");
          return;
        }
        setCandidates(result.candidates ?? []);
      } catch {
        setCandidates([]);
        setError("Search failed. Please try again.");
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  async function postAction(body: Record<string, unknown>) {
    const res = await fetch("/api/inventory/chloe-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function handleAdd(productId: string) {
    setBusyId(productId);
    setMessage(null);
    const result = await postAction({ action: "add", product_id: productId });
    setBusyId(null);
    if (!result.success) {
      setError(result.error ?? "Could not add product.");
      return;
    }
    setMessage("Added to Chloe's Edit.");
    setSearchInput("");
    setCandidates([]);
    await load();
  }

  async function handleRemove(productId: string) {
    setBusyId(productId);
    setMessage(null);
    const result = await postAction({ action: "remove", product_id: productId });
    setBusyId(null);
    if (!result.success) {
      setError(result.error ?? "Could not remove product.");
      return;
    }
    setMessage("Removed from Chloe's Edit.");
    await load();
  }

  async function handleSave(productId: string) {
    setBusyId(productId);
    setMessage(null);
    const position = Number(positionDrafts[productId]);
    const result = await postAction({
      action: "update",
      product_id: productId,
      position: Number.isFinite(position) ? Math.trunc(position) : undefined,
      editorial_note: noteDrafts[productId] ?? "",
    });
    setBusyId(null);
    if (!result.success) {
      setError(result.error ?? "Could not update.");
      return;
    }
    setMessage("Saved.");
    await load();
  }

  async function move(productId: string, direction: -1 | 1) {
    const index = rows.findIndex((r) => r.productId === productId);
    const swap = index + direction;
    if (index < 0 || swap < 0 || swap >= rows.length) return;
    const ordered = rows.map((r) => r.productId);
    const tmp = ordered[index]!;
    ordered[index] = ordered[swap]!;
    ordered[swap] = tmp;
    setBusyId(productId);
    const result = await postAction({
      action: "reorder",
      ordered_product_ids: ordered,
    });
    setBusyId(null);
    if (!result.success) {
      setError(result.error ?? "Could not reorder.");
      return;
    }
    setRows(result.products ?? []);
    setMessage("Order updated.");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Storefront
          </p>
          <h1 className="mt-1 font-serif text-3xl text-charcoal">Chloe&apos;s Edit</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Explicit editorial curation only. Adding a product here does not change
            assortment, price, inventory, or channel mappings.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/edit" className="text-charcoal underline-offset-2 hover:underline" target="_blank">
            Preview Edit
          </Link>
          <Link
            href="/admin/inventory/storefront-readiness"
            className="text-muted underline-offset-2 hover:underline"
          >
            Storefront readiness
          </Link>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-charcoal px-4 py-3 text-sm text-ivory">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-4 text-sm text-sage">{message}</p>
      ) : null}

      <section className="mt-8 rounded-2xl border border-sand bg-white p-4 sm:p-5">
        <h2 className="font-serif text-xl text-charcoal">Add a product</h2>
        <p className="mt-1 text-xs text-muted">Search by name, SKU, or brand. No auto-curation.</p>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search products…"
          className="mt-3 w-full border border-sand bg-transparent px-3 py-2.5 text-sm outline-none focus:border-sage"
        />
        {searching ? <p className="mt-2 text-xs text-muted">Searching…</p> : null}
        {candidates.length > 0 ? (
          <ul className="mt-3 divide-y divide-sand/70">
            {candidates.map((c) => (
              <li key={c.productId} className="flex items-center gap-3 py-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden bg-ivory">
                  {c.primaryImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.primaryImage} alt="" className="h-full w-full object-contain" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-charcoal">{c.name}</p>
                  <p className="text-xs text-muted">
                    {c.sku ?? "—"} · {c.brand ?? "—"} · {c.assortmentStatus ?? "unreviewed"} ·{" "}
                    {c.shopifyPriceLabel}
                  </p>
                </div>
                {c.alreadyCurated ? (
                  <span className="text-xs text-muted">Already in Edit</span>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === c.productId}
                    onClick={() => void handleAdd(c.productId)}
                    className="bg-charcoal px-3 py-1.5 text-xs font-semibold text-ivory disabled:opacity-40"
                  >
                    Add
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-xl text-charcoal">
          Curated ({rows.length})
        </h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nothing curated yet. Search above to add the first product.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {rows.map((row, index) => (
              <li
                key={row.productId}
                className="rounded-2xl border border-sand bg-white p-4"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden bg-ivory">
                    {row.primaryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.primaryImage}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className="font-medium text-charcoal">{row.name}</p>
                      <p className="text-xs text-muted">
                        {row.sku ?? "—"} · {row.brand ?? "—"} · assortment{" "}
                        {row.assortmentStatus ?? "unreviewed"} · {row.shopifyPriceLabel}
                        {!row.shopifyPriceConfigured ? " (not purchasable on UK site)" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <label className="text-xs text-muted">
                        Position
                        <input
                          type="number"
                          value={positionDrafts[row.productId] ?? ""}
                          onChange={(e) =>
                            setPositionDrafts((prev) => ({
                              ...prev,
                              [row.productId]: e.target.value,
                            }))
                          }
                          className="ml-2 w-20 border border-sand px-2 py-1 text-sm text-charcoal"
                        />
                      </label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={index === 0 || busyId === row.productId}
                          onClick={() => void move(row.productId, -1)}
                          className="border border-sand px-2 py-1 text-xs disabled:opacity-40"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          disabled={index === rows.length - 1 || busyId === row.productId}
                          onClick={() => void move(row.productId, 1)}
                          className="border border-sand px-2 py-1 text-xs disabled:opacity-40"
                        >
                          Down
                        </button>
                      </div>
                    </div>
                    <label className="block text-xs text-muted">
                      Editorial note (optional)
                      <textarea
                        value={noteDrafts[row.productId] ?? ""}
                        onChange={(e) =>
                          setNoteDrafts((prev) => ({
                            ...prev,
                            [row.productId]: e.target.value,
                          }))
                        }
                        rows={2}
                        className="mt-1 w-full border border-sand px-3 py-2 text-sm text-charcoal"
                        placeholder="Leave blank — never auto-generated"
                      />
                    </label>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link
                      href={row.pdpPath}
                      target="_blank"
                      className="text-center text-xs font-semibold text-charcoal underline-offset-2 hover:underline"
                    >
                      Open PDP
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === row.productId}
                      onClick={() => void handleSave(row.productId)}
                      className="bg-charcoal px-3 py-1.5 text-xs font-semibold text-ivory disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.productId}
                      onClick={() => void handleRemove(row.productId)}
                      className="border border-sand px-3 py-1.5 text-xs text-muted disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
