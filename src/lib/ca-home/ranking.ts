// Deterministic ranking model — ported verbatim from the web repo
// (next-app/src/components/dashboard/home/ranking.ts). Pure function:
// no AI, no randomness, no wall-clock reads. Same input always produces
// the same output. Copied as-is — do not re-derive.

import { TIER_ORDER, type TriageItem } from "./types";

export interface RankedTriage {
  rows: TriageItem[];
  /** Total matching items across all tiers, before the row cap */
  total: number;
  /** Items beyond the row cap — spec: "never silently truncate" */
  overflow: number;
}

/**
 * @param trueTotal Override for `total`/`overflow` when `items` was built from a
 *   capped candidate fetch and the caller separately knows the real database
 *   count. Without it, `total` is just `items.length`, which under-reports
 *   whenever the caller's fetch was capped. Callers with capped queries must
 *   supply this to keep the overflow count honest.
 */
export function rankTriageItems(items: TriageItem[], maxRows = 8, trueTotal?: number): RankedTriage {
  const sorted = [...items].sort((a, b) => {
    const tierDiff = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
    if (tierDiff !== 0) return tierDiff;
    if (a.sortValue !== b.sortValue) return a.sortValue - b.sortValue;
    const createdDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (createdDiff !== 0) return createdDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const rows = sorted.slice(0, maxRows);
  const total = trueTotal ?? sorted.length;

  return {
    rows,
    total,
    overflow: Math.max(0, total - rows.length),
  };
}
