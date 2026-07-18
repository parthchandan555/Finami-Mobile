// Shared attention-queue primitives — ported verbatim from the web repo
// (next-app/src/components/dashboard/home/types.ts). Framework-agnostic:
// the TriageItem shape and ranking rules are reused as-is on mobile; only
// the rendering layer is rebuilt natively. The web file's TIER_META held
// CSS-variable color strings (var(--destructive) etc.) which have no
// meaning in React Native — tier→color mapping lives in the native
// TriageRow instead, keyed off the theme module. The TYPES below are
// identical to web.

export type TriageTier = "T1" | "T2" | "T3" | "T4";

export interface TriageItem {
  /** Stable, globally-unique row id (e.g. `ca-1-<uuid>`) */
  id: string;
  tier: TriageTier;
  /** Material Symbols Outlined ligature name (mapped to a native icon in TriageRow) */
  icon: string;
  /** "GSTR-3B · Mehta Traders" — entity + obligation, sentence case */
  title: string;
  /** "Due in 4 days (20 Jul)" — the rule's reason in plain language */
  whyLine: string;
  /** "4d" / "OVERDUE 3d" / "TODAY" — omitted when the item has no date */
  chipLabel?: string;
  /** Page slug resolved by the caller at press time */
  href: string;
  /** Ascending = higher priority within the tier (spec's "sort key") */
  sortValue: number;
  /** ISO timestamp — tie-break #1 (oldest waiting first) */
  createdAt: string;
}

/** One bubble on the Zone 2 Horizon strip */
export interface HorizonDay {
  /** YYYY-MM-DD, local calendar date */
  date: string;
  /** "20 Jul" */
  label: string;
  /** "Mon" */
  dow: string;
  count: number;
}

export const TIER_ORDER: TriageTier[] = ["T1", "T2", "T3", "T4"];
