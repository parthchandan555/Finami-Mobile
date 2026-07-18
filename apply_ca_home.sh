#!/bin/bash
# apply_ca_home.sh — CA Home v1 (chat 4). Generated programmatically, byte-verified.
# Run from the Finami-Mobile repo root.
set -e
if [ ! -f package.json ] || ! grep -q "finami" package.json 2>/dev/null; then
  if [ ! -d src/app ]; then echo "ERROR: run this from the Finami-Mobile repo root."; exit 1; fi
fi
echo "Applying CA Home v1..."
mkdir -p src/lib/ca-home/rules src/features/ca-home

cat > src/lib/ca-home/types.ts << 'CA_HOME_EOF_6356eb6d'
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
CA_HOME_EOF_6356eb6d

cat > src/lib/ca-home/ranking.ts << 'CA_HOME_EOF_d9c927e6'
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
CA_HOME_EOF_d9c927e6

cat > src/lib/ca-home/rules/ca.ts << 'CA_HOME_EOF_60fbfb02'
// CA Home triage rules — ported verbatim from the web repo
// (next-app/src/components/dashboard/home/rules/ca.ts).
//
// Pure functions only — no Supabase calls, no Date.now()/wall-clock reads.
// Callers pass `today` explicitly so results are deterministic and reusable.
//
// SINGLE PORT CHANGE vs web: web imports `formatINR` (RUPEES-taking, no
// division) from `@/lib/tax-calculator`. Here it is inlined below with the
// SAME contract — it takes RUPEES. The CA-7 call site still passes
// `inv.total / 100` (professional_invoices.total is PAISE, verified live:
// subtotal 25000_00 + 9% cgst + 9% sgst = total 29500_00 = ₹29,500). The
// /100 stays exactly where web has it. Do not move the division into the
// formatter — that would fork the unit contract, the platform's #1 bug class.
//
// Live-DB corrections carried over from web (still valid, re-verified chat 4):
//   - Reads itr_filings / gst_filings (not the dead ca_* seed tables).
//   - itr_filings open filter: status NOT IN ('filed','processed','verified').
//   - gst_filings open filter: status <> 'filed' (ONLY terminal state).
//   - connections.status UPPERCASE ('PENDING'/'ACTIVE'/...).
//   - documents.status = 'UPLOADED' (re-verified: 240 UPLOADED + 1 REQUESTED
//     live; explicit filter keeps the REQUESTED row out).

import type { TriageItem, HorizonDay } from "../types";

/** en-IN rupee formatter. Takes RUPEES (matches web's tax-calculator formatINR contract). */
function formatINR(rupees: number): string {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(rupees))}`;
}

export interface CaItrFilingRow {
  id: string;
  client_id: string;
  itr_type: string;
  assessment_year: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

export interface CaGstFilingRow {
  id: string;
  client_id: string;
  return_type: string;
  period: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

export interface CaUploadedDocumentRow {
  id: string;
  file_name: string;
  client_id: string;
  created_at: string;
}

export interface CaPendingConnectionRow {
  id: string;
  client_id: string;
  created_at: string;
}

export interface CaInvoiceRow {
  id: string;
  invoice_number: string;
  client_id: string;
  /** PAISE. Divide by 100 before display (see file header). */
  total: number;
  status: string;
  due_date: string | null;
  created_at: string;
}

export interface CaTriageInput {
  itrFilings: CaItrFilingRow[];
  gstFilings: CaGstFilingRow[];
  /** documents (status = 'UPLOADED') already resolved to client_id via connection_id */
  uploadedDocuments: CaUploadedDocumentRow[];
  pendingConnections: CaPendingConnectionRow[];
  /** professional_invoices already narrowed to status IN ('overdue','sent') */
  candidateInvoices: CaInvoiceRow[];
  /** client_id -> display name (profiles.name via public_profiles) */
  clientNames: Map<string, string>;
}

const ITR_TERMINAL = new Set(["filed", "processed", "verified"]);
const GST_TERMINAL = new Set(["filed"]);
const DAY_MS = 24 * 60 * 60 * 1000;

function clientName(clientNames: Map<string, string>, clientId: string): string {
  return clientNames.get(clientId) ?? "Unknown client";
}

/** Parses a YYYY-MM-DD (or ISO) date string as a *local* midnight Date — avoids UTC day-shift. */
function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** a - b, in whole days */
function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** GST period stored as MMYYYY ("042025") → "Apr 2025"; anything else passed through untouched. */
function formatPeriod(period: string): string {
  if (!/^\d{6}$/.test(period)) return period;
  const m = Number(period.slice(0, 2));
  if (m < 1 || m > 12) return period;
  return `${MONTHS[m - 1]} ${period.slice(2)}`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** "4d" / "OVERDUE 3d" / "TODAY" — diff = due date minus today, in days */
function dayChipLabel(diff: number): string {
  if (diff < 0) {
    const n = Math.abs(diff);
    return n === 1 ? "OVERDUE 1d" : `OVERDUE ${n}d`;
  }
  if (diff === 0) return "TODAY";
  return `${diff}d`;
}

/** elapsed = today minus event date, in whole days (always >= 0) */
function elapsedChipLabel(elapsed: number): string {
  return elapsed === 0 ? "TODAY" : `${elapsed}d`;
}

function elapsedLabel(createdAt: string, today: Date): string {
  const ms = today.getTime() - new Date(createdAt).getTime();
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function computeCaTriage(data: CaTriageInput, today: Date): TriageItem[] {
  const items: TriageItem[] = [];
  const todayMid = toMidnight(today);

  // CA-1 (T1 overdue) + CA-3 (T2 due soon, next 7 days) — ITR
  for (const f of data.itrFilings) {
    if (ITR_TERMINAL.has(f.status) || !f.due_date) continue;
    const due = parseDateOnly(f.due_date);
    const diff = daysBetween(due, todayMid);
    const name = clientName(data.clientNames, f.client_id);
    if (diff < 0) {
      items.push({
        id: `ca-1-${f.id}`,
        tier: "T1",
        icon: "description",
        title: `${f.itr_type} · ${name}`,
        whyLine: `AY ${f.assessment_year} · overdue ${Math.abs(diff)} days`,
        chipLabel: dayChipLabel(diff),
        href: "itr-generation",
        sortValue: due.getTime(),
        createdAt: f.created_at,
      });
    } else if (diff <= 7) {
      items.push({
        id: `ca-3-${f.id}`,
        tier: "T2",
        icon: "description",
        title: `${f.itr_type} · ${name}`,
        whyLine: `AY ${f.assessment_year} · due ${formatShortDate(due)}`,
        chipLabel: dayChipLabel(diff),
        href: "itr-generation",
        sortValue: due.getTime(),
        createdAt: f.created_at,
      });
    }
  }

  // CA-2 (T1 overdue) + CA-4 (T2 due soon, next 7 days) — GST
  for (const f of data.gstFilings) {
    if (GST_TERMINAL.has(f.status) || !f.due_date) continue;
    const due = parseDateOnly(f.due_date);
    const diff = daysBetween(due, todayMid);
    const name = clientName(data.clientNames, f.client_id);
    if (diff < 0) {
      items.push({
        id: `ca-2-${f.id}`,
        tier: "T1",
        icon: "receipt_long",
        title: `${f.return_type} · ${name}`,
        whyLine: `${formatPeriod(f.period)} · overdue ${Math.abs(diff)} days`,
        chipLabel: dayChipLabel(diff),
        href: "gst-module",
        sortValue: due.getTime(),
        createdAt: f.created_at,
      });
    } else if (diff <= 7) {
      items.push({
        id: `ca-4-${f.id}`,
        tier: "T2",
        icon: "receipt_long",
        title: `${f.return_type} · ${name}`,
        whyLine: `${formatPeriod(f.period)} · due ${formatShortDate(due)}`,
        chipLabel: dayChipLabel(diff),
        href: "gst-module",
        sortValue: due.getTime(),
        createdAt: f.created_at,
      });
    }
  }

  // CA-5 (T3): documents.status = 'UPLOADED' on active CA connections.
  for (const doc of data.uploadedDocuments) {
    const name = clientName(data.clientNames, doc.client_id);
    const createdMid = toMidnight(new Date(doc.created_at));
    const elapsed = daysBetween(todayMid, createdMid);
    items.push({
      id: `ca-5-${doc.id}`,
      tier: "T3",
      icon: "upload_file",
      title: `Document · ${name}`,
      whyLine: `${name} uploaded ${doc.file_name} ${elapsedLabel(doc.created_at, today)}`,
      chipLabel: elapsedChipLabel(elapsed),
      href: "documents",
      sortValue: new Date(doc.created_at).getTime(),
      createdAt: doc.created_at,
    });
  }

  // CA-6 (T3): connections.status = 'PENDING', service_type = 'CA'
  // NOTE (mobile): the client name never resolves for a PENDING connection
  // (public_profiles only reveals names on ACTIVE connections), so the native
  // TriageRow renders this row as "New connection request" without a name.
  // The pure item is emitted identically to web; only the native label differs.
  for (const conn of data.pendingConnections) {
    const createdMid = toMidnight(new Date(conn.created_at));
    const elapsed = daysBetween(todayMid, createdMid);
    items.push({
      id: `ca-6-${conn.id}`,
      tier: "T3",
      icon: "person_add",
      title: `Connection request`,
      whyLine: `New connection request ${elapsedLabel(conn.created_at, today)}`,
      chipLabel: elapsedChipLabel(elapsed),
      href: "clients",
      sortValue: new Date(conn.created_at).getTime(),
      createdAt: conn.created_at,
    });
  }

  // CA-7 (T3): professional_invoices — 'overdue', or 'sent' past due_date
  for (const inv of data.candidateInvoices) {
    if (!inv.due_date) continue;
    const due = parseDateOnly(inv.due_date);
    const diff = daysBetween(due, todayMid);
    const isOverdue = inv.status === "overdue" || (inv.status === "sent" && diff < 0);
    if (!isOverdue) continue;
    const name = clientName(data.clientNames, inv.client_id);
    items.push({
      id: `ca-7-${inv.id}`,
      tier: "T3",
      icon: "payments",
      title: `Invoice ${inv.invoice_number} · ${name}`,
      whyLine: `Invoice ${inv.invoice_number} · ${formatINR(inv.total / 100)} unpaid ${Math.max(0, -diff)} days past due`,
      chipLabel: dayChipLabel(diff),
      href: "invoicing",
      sortValue: due.getTime(),
      createdAt: inv.created_at,
    });
  }

  return items;
}

export function computeCaHorizon(
  data: Pick<CaTriageInput, "itrFilings" | "gstFilings">,
  today: Date,
): HorizonDay[] {
  const todayMid = toMidnight(today);
  const counts = new Map<string, number>();
  const bump = (dateStr: string) => counts.set(dateStr, (counts.get(dateStr) ?? 0) + 1);

  for (const f of data.itrFilings) {
    if (ITR_TERMINAL.has(f.status) || !f.due_date) continue;
    bump(f.due_date.slice(0, 10));
  }
  for (const f of data.gstFilings) {
    if (GST_TERMINAL.has(f.status) || !f.due_date) continue;
    bump(f.due_date.slice(0, 10));
  }

  const days: HorizonDay[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(todayMid);
    d.setDate(d.getDate() + i);
    const key = toISODateLocal(d);
    days.push({
      date: key,
      label: formatShortDate(d),
      dow: d.toLocaleDateString("en-IN", { weekday: "short" }),
      count: counts.get(key) ?? 0,
    });
  }
  return days;
}

export interface CaNextDeadline {
  label: string;
  client: string;
  date: string;
}

export function computeCaNextDeadline(
  data: Pick<CaTriageInput, "itrFilings" | "gstFilings" | "clientNames">,
  today: Date,
): CaNextDeadline | null {
  const todayMid = toMidnight(today);
  let best: { due: Date; label: string; client: string } | null = null;

  for (const f of data.itrFilings) {
    if (ITR_TERMINAL.has(f.status) || !f.due_date) continue;
    const due = parseDateOnly(f.due_date);
    if (due < todayMid) continue;
    if (!best || due < best.due) {
      best = { due, label: `ITR ${f.itr_type}`, client: clientName(data.clientNames, f.client_id) };
    }
  }
  for (const f of data.gstFilings) {
    if (GST_TERMINAL.has(f.status) || !f.due_date) continue;
    const due = parseDateOnly(f.due_date);
    if (due < todayMid) continue;
    if (!best || due < best.due) {
      best = { due, label: `${f.return_type} · ${f.period}`, client: clientName(data.clientNames, f.client_id) };
    }
  }

  if (!best) return null;
  return { label: best.label, client: best.client, date: formatShortDate(best.due) };
}
CA_HOME_EOF_60fbfb02

cat > src/lib/ca-home/data.ts << 'CA_HOME_EOF_40b31081'
// CA Home data layer — the React Native equivalent of HomeCA.tsx's fetch.
// Every filter here is copied from the verified web implementation and
// re-verified against the live database (chat 4):
//   - professional_invoices.total is PAISE (proven: 2500000+225000+225000
//     = 2950000 = ₹29,500). The /100 lives in rules/ca.ts, not here.
//   - documents needs THREE filters: status='UPLOADED', connection_id IN
//     (active CA connections), AND uploaded_by <> userId ("waiting on me",
//     not my own uploads). Dropping the last one shows a CA their own files.
//   - documents has no client_id — it resolves via connection_id -> the
//     active-connection map. This forces a two-stage fetch.
//   - connections.status is UPPERCASE.
//   - public_profiles only reveals a name when an ACTIVE connection exists,
//     so PENDING-connection clients never resolve (CA-6 renders nameless).
// READ-ONLY. v1 makes no writes from mobile.

import { supabase } from "@/lib/supabase";
import type {
  CaItrFilingRow,
  CaGstFilingRow,
  CaInvoiceRow,
  CaPendingConnectionRow,
  CaUploadedDocumentRow,
} from "./rules/ca";

export interface CaHomeData {
  itrFilings: CaItrFilingRow[];
  gstFilings: CaGstFilingRow[];
  uploadedDocuments: CaUploadedDocumentRow[];
  pendingConnections: CaPendingConnectionRow[];
  candidateInvoices: CaInvoiceRow[];
  clientNames: Map<string, string>;
  /** Honest queue size incl. items beyond the capped fetches (never truncate silently) */
  triageTotalPadding: number;
  pulse: {
    activeClients: number;
    pendingRequests: number;
    docsPending: number;
    avgRating: number;
    ratingCount: number;
  };
  inProgress: { itr: number; gst: number };
}

const DOC_FETCH_CAP = 20;
const PENDING_CONN_CAP = 20;
const INVOICE_CAP = 100;

export async function fetchCaHomeData(userId: string): Promise<CaHomeData> {
  const [itrRes, gstRes, activeConnRes, pendingConnRes, invoiceRes, ratingsRes] =
    await Promise.all([
      supabase
        .from("itr_filings")
        .select("id, client_id, itr_type, assessment_year, status, due_date, created_at")
        .eq("professional_id", userId),
      supabase
        .from("gst_filings")
        .select("id, client_id, return_type, period, status, due_date, created_at")
        .eq("professional_id", userId),
      supabase
        .from("connections")
        .select("id, client_id", { count: "exact" })
        .eq("professional_id", userId)
        .eq("service_type", "CA")
        .eq("status", "ACTIVE"),
      supabase
        .from("connections")
        .select("id, client_id, created_at", { count: "exact" })
        .eq("professional_id", userId)
        .eq("service_type", "CA")
        .eq("status", "PENDING")
        .order("created_at", { ascending: true })
        .limit(PENDING_CONN_CAP),
      supabase
        .from("professional_invoices")
        .select("id, invoice_number, client_id, total, status, due_date, created_at")
        .eq("professional_id", userId)
        .in("status", ["overdue", "sent"])
        .limit(INVOICE_CAP),
      supabase
        .from("ratings")
        .select("overall_rating")
        .eq("professional_id", userId)
        .eq("service_type", "CA")
        .eq("is_hidden", false),
    ]);

  const itrFilings: CaItrFilingRow[] = itrRes.data ?? [];
  const gstFilings: CaGstFilingRow[] = gstRes.data ?? [];
  const pendingConnections: CaPendingConnectionRow[] = pendingConnRes.data ?? [];
  const candidateInvoices: CaInvoiceRow[] = invoiceRes.data ?? [];

  const activeConnections: { id: string; client_id: string }[] = activeConnRes.data ?? [];
  const activeConnIds = activeConnections.map((c) => c.id);
  const connIdToClientId = new Map(activeConnections.map((c) => [c.id, c.client_id]));

  // Stage 2: documents depend on the resolved active-connection ids.
  let uploadedDocs: { id: string; file_name: string; connection_id: string; created_at: string }[] = [];
  let docsPendingCount = 0;
  if (activeConnIds.length > 0) {
    const docsRes = await supabase
      .from("documents")
      .select("id, file_name, connection_id, created_at", { count: "exact" })
      .in("connection_id", activeConnIds)
      .eq("status", "UPLOADED")
      .neq("uploaded_by", userId)
      .order("created_at", { ascending: true })
      .limit(DOC_FETCH_CAP);
    uploadedDocs = docsRes.data ?? [];
    docsPendingCount = docsRes.count ?? uploadedDocs.length;
  }

  // Name map: every client_id referenced by any surfaced row.
  const clientIds = new Set<string>();
  itrFilings.forEach((r) => clientIds.add(r.client_id));
  gstFilings.forEach((r) => clientIds.add(r.client_id));
  candidateInvoices.forEach((r) => clientIds.add(r.client_id));
  uploadedDocs.forEach((d) => {
    const cid = connIdToClientId.get(d.connection_id);
    if (cid) clientIds.add(cid);
  });

  let clientNames = new Map<string, string>();
  if (clientIds.size > 0) {
    const { data: profiles } = await supabase
      .from("public_profiles")
      .select("user_id, name")
      .in("user_id", Array.from(clientIds));
    const rows: { user_id: string; name: string | null }[] = profiles ?? [];
    clientNames = new Map(rows.map((p) => [p.user_id, p.name || "Unknown client"]));
  }

  const uploadedDocuments: CaUploadedDocumentRow[] = uploadedDocs.map((d) => ({
    id: d.id,
    file_name: d.file_name,
    client_id: connIdToClientId.get(d.connection_id) ?? "",
    created_at: d.created_at,
  }));

  const ratings: { overall_rating: number }[] = ratingsRes.data ?? [];
  const ratingCount = ratings.length;
  const avgRating =
    ratingCount > 0
      ? Math.round((ratings.reduce((s, r) => s + Number(r.overall_rating), 0) / ratingCount) * 10) / 10
      : 0;

  const pendingConnTotal = pendingConnRes.count ?? pendingConnections.length;

  // Capped fetches would under-report the queue size; restore the honest
  // remainder so the "N more need attention" badge never lies.
  const triageTotalPadding =
    Math.max(0, docsPendingCount - uploadedDocuments.length) +
    Math.max(0, pendingConnTotal - pendingConnections.length);

  return {
    itrFilings,
    gstFilings,
    uploadedDocuments,
    pendingConnections,
    candidateInvoices,
    clientNames,
    triageTotalPadding,
    pulse: {
      activeClients: activeConnRes.count ?? activeConnections.length,
      pendingRequests: pendingConnTotal,
      docsPending: docsPendingCount,
      avgRating,
      ratingCount,
    },
    inProgress: {
      itr: itrFilings.filter((f) => f.status === "in_progress").length,
      gst: gstFilings.filter((f) => f.status === "in_progress").length,
    },
  };
}
CA_HOME_EOF_40b31081

cat > src/features/ca-home/ZoneSection.tsx << 'CA_HOME_EOF_73cdd3ac'
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Zone wrapper — title row + content. Mobile equivalent of the web ZoneSection. */
export function ZoneSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.zone}>
      <View style={styles.header}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {badge ? <ThemedText type="smallBold">{badge}</ThemedText> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { gap: Spacing.two, alignSelf: 'stretch' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
CA_HOME_EOF_73cdd3ac

cat > src/features/ca-home/PulseChip.tsx << 'CA_HOME_EOF_b4623541'
import React from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

/** One "Pulse" stat chip. De-emphasis via size/weight only — never grey. */
export function PulseChip({ label, value }: { label: string; value: string | number }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={[styles.chip, { backgroundColor: c.backgroundElement }]}>
      <ThemedText type="title" style={styles.value}>
        {String(value)}
      </ThemedText>
      <ThemedText type="small">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 96,
    flexGrow: 1,
    gap: Spacing.half,
  },
  value: { fontSize: 24, lineHeight: 30 },
});
CA_HOME_EOF_b4623541

cat > src/features/ca-home/TriageRow.tsx << 'CA_HOME_EOF_a6337a4e'
import React from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import type { TriageItem, TriageTier } from '@/lib/ca-home/types';

/**
 * One attention-queue row. The web version renders a Material Symbols icon;
 * icons are not yet audited for RN (project instructions §6), so tier is
 * carried by a colored edge bar from the locked palette instead:
 *   T1 = destructive, T2 = warning, T3 = accent, T4 = no edge.
 * Chip label ("OVERDUE 3d" / "TODAY" / "4d") sits right, tinted to match.
 */
function tierColors(tier: TriageTier, c: (typeof Colors)['light']) {
  switch (tier) {
    case 'T1':
      return { edge: c.destructive, chipBg: c.destructiveTint, chipFg: c.destructive };
    case 'T2':
      return { edge: c.warning, chipBg: c.warningTint, chipFg: c.warning };
    case 'T3':
      return { edge: c.accent, chipBg: c.accentTint, chipFg: c.accent };
    default:
      return { edge: 'transparent', chipBg: c.backgroundSelected, chipFg: c.text };
  }
}

export function TriageRow({ item, onPress }: { item: TriageItem; onPress: (href: string) => void }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = tierColors(item.tier, c);

  return (
    <Pressable
      onPress={() => onPress(item.href)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? c.backgroundSelected : c.backgroundElement },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.whyLine}`}
    >
      <View style={[styles.edge, { backgroundColor: t.edge }]} />
      <View style={styles.body}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {item.title}
        </ThemedText>
        <ThemedText type="small" numberOfLines={2}>
          {item.whyLine}
        </ThemedText>
      </View>
      {item.chipLabel ? (
        <View style={[styles.chip, { backgroundColor: t.chipBg }]}>
          <ThemedText type="small" style={[styles.chipText, { color: t.chipFg }]}>
            {item.chipLabel}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    overflow: 'hidden',
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  edge: { width: 4, alignSelf: 'stretch' },
  body: { flex: 1, paddingVertical: Spacing.two, gap: 2 },
  chip: {
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chipText: { fontFamily: FontFamily.bold, fontSize: 11 },
});
CA_HOME_EOF_a6337a4e

cat > src/features/ca-home/AttentionQueue.tsx << 'CA_HOME_EOF_c0733a9a'
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { rankTriageItems } from '@/lib/ca-home/ranking';
import type { TriageItem } from '@/lib/ca-home/types';

import { TriageRow } from './TriageRow';
import { ZoneSection } from './ZoneSection';

/**
 * Zone 1 — always renders first, even when empty. The row cap never
 * silently truncates: overflow is computed from the honest total.
 */
export function AttentionQueue({
  items,
  trueTotal,
  onNavigate,
  emptyState,
  maxRows = 8,
}: {
  items: TriageItem[];
  trueTotal?: number;
  onNavigate: (href: string) => void;
  emptyState: React.ReactNode;
  maxRows?: number;
}) {
  const { rows, total, overflow } = rankTriageItems(items, maxRows, trueTotal);

  return (
    <ZoneSection title="Needs attention" badge={total > 0 ? String(total) : undefined}>
      {rows.length === 0 ? (
        emptyState
      ) : (
        <View style={styles.list}>
          {rows.map((item) => (
            <TriageRow key={item.id} item={item} onPress={onNavigate} />
          ))}
          {overflow > 0 ? (
            <Pressable onPress={() => onNavigate('compliance-calendar')} style={styles.overflow}>
              <ThemedText type="smallBold">{overflow} more need attention</ThemedText>
            </Pressable>
          ) : null}
        </View>
      )}
    </ZoneSection>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  overflow: { paddingVertical: Spacing.two },
});
CA_HOME_EOF_c0733a9a

cat > src/features/ca-home/HorizonStrip.tsx << 'CA_HOME_EOF_9700e1a9'
import React from 'react';
import { ScrollView, StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import type { HorizonDay } from '@/lib/ca-home/types';

import { ZoneSection } from './ZoneSection';

/** Zone 2 — next 14 days as a compact horizontal date rail. */
export function HorizonStrip({ days }: { days: HorizonDay[] }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <ZoneSection title="Next 14 days">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {days.map((d) => {
          const active = d.count > 0;
          return (
            <View
              key={d.date}
              style={[
                styles.bubble,
                { backgroundColor: active ? c.accentTint : c.backgroundElement },
              ]}
            >
              <ThemedText type="small" style={styles.dow}>
                {d.dow.toUpperCase()}
              </ThemedText>
              <ThemedText type="smallBold">{d.label}</ThemedText>
              {active ? (
                <ThemedText type="small" style={[styles.count, { color: c.accent }]}>
                  {d.count}
                </ThemedText>
              ) : (
                <View style={styles.countSpacer} />
              )}
            </View>
          );
        })}
      </ScrollView>
    </ZoneSection>
  );
}

const styles = StyleSheet.create({
  rail: { gap: Spacing.two, paddingVertical: Spacing.half },
  bubble: {
    minWidth: 58,
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  dow: { fontFamily: FontFamily.bold, fontSize: 10, letterSpacing: 0.5 },
  count: { fontFamily: FontFamily.bold, fontSize: 12 },
  countSpacer: { height: 16 },
});
CA_HOME_EOF_9700e1a9

cat > src/app/index.tsx << 'CA_HOME_EOF_9a8f3939'
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchCaHomeData, type CaHomeData } from '@/lib/ca-home/data';
import {
  computeCaHorizon,
  computeCaNextDeadline,
  computeCaTriage,
  type CaNextDeadline,
} from '@/lib/ca-home/rules/ca';
import type { HorizonDay, TriageItem } from '@/lib/ca-home/types';

import { AttentionQueue } from '@/features/ca-home/AttentionQueue';
import { HorizonStrip } from '@/features/ca-home/HorizonStrip';
import { PulseChip } from '@/features/ca-home/PulseChip';
import { ZoneSection } from '@/features/ca-home/ZoneSection';

/**
 * CA Home v1 — read-only. Ports the web triage rules verbatim (pure
 * functions with `today` injected) and replicates the verified web data
 * layer. No writes. Navigation targets are the web page slugs the rules
 * emit; mobile screens for those do not exist yet, so presses are inert
 * for now (deliberate — client list / filing detail are the next slice).
 */
export default function CaHomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { session, signOut } = useAuth();
  const userId = session?.user?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CaHomeData | null>(null);
  const [items, setItems] = useState<TriageItem[]>([]);
  const [horizon, setHorizon] = useState<HorizonDay[]>([]);
  const [nextDeadline, setNextDeadline] = useState<CaNextDeadline | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const d = await fetchCaHomeData(userId);
      const today = new Date();
      setData(d);
      setItems(computeCaTriage(d, today));
      setHorizon(computeCaHorizon(d, today));
      setNextDeadline(computeCaNextDeadline(d, today));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your home screen.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const trueTotal = data ? items.length + data.triageTotalPadding : undefined;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.text} />}
        >
          <View style={styles.headerRow}>
            <ThemedText type="title">Home</ThemedText>
            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={({ pressed }) => [
                styles.signOut,
                { backgroundColor: pressed ? c.backgroundSelected : c.backgroundElement },
              ]}
            >
              <ThemedText type="smallBold">Sign out</ThemedText>
            </Pressable>
          </View>

          {loading ? (
            <ThemedText type="small">Loading your work…</ThemedText>
          ) : error ? (
            <View style={[styles.errorBox, { backgroundColor: c.destructiveTint }]}>
              <ThemedText type="smallBold" style={{ color: c.destructive }}>
                {error}
              </ThemedText>
              <Pressable onPress={onRefresh}>
                <ThemedText type="smallBold">Tap to retry</ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              <AttentionQueue
                items={items}
                trueTotal={trueTotal}
                onNavigate={() => {}}
                emptyState={
                  <View style={styles.empty}>
                    <ThemedText type="smallBold">All clear.</ThemedText>
                    <ThemedText type="small">
                      No filings due in the next 7 days and nothing is waiting on you.
                    </ThemedText>
                    {nextDeadline ? (
                      <ThemedText type="small">
                        Next deadline: {nextDeadline.label} for {nextDeadline.client}, {nextDeadline.date}
                      </ThemedText>
                    ) : null}
                  </View>
                }
              />

              <HorizonStrip days={horizon} />

              {data && (data.inProgress.itr > 0 || data.inProgress.gst > 0) ? (
                <ZoneSection title="Work in motion">
                  <View style={styles.wipRow}>
                    {data.inProgress.itr > 0 ? (
                      <View style={[styles.wipCard, { backgroundColor: c.backgroundElement }]}>
                        <ThemedText type="smallBold">
                          {data.inProgress.itr} ITR filing{data.inProgress.itr === 1 ? '' : 's'} in progress
                        </ThemedText>
                      </View>
                    ) : null}
                    {data.inProgress.gst > 0 ? (
                      <View style={[styles.wipCard, { backgroundColor: c.backgroundElement }]}>
                        <ThemedText type="smallBold">
                          {data.inProgress.gst} GST return{data.inProgress.gst === 1 ? '' : 's'} in progress
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </ZoneSection>
              ) : null}

              {data ? (
                <ZoneSection title="Pulse">
                  <View style={styles.pulseRow}>
                    <PulseChip label="Active clients" value={data.pulse.activeClients} />
                    <PulseChip label="Pending requests" value={data.pulse.pendingRequests} />
                    <PulseChip label="Docs pending" value={data.pulse.docsPending} />
                    <PulseChip
                      label="Avg rating"
                      value={data.pulse.ratingCount > 0 ? data.pulse.avgRating.toFixed(1) : '—'}
                    />
                  </View>
                </ZoneSection>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, alignSelf: 'stretch' },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
  },
  signOut: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  empty: { gap: Spacing.one },
  errorBox: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.two },
  wipRow: { gap: Spacing.two },
  wipCard: { borderRadius: Spacing.two, padding: Spacing.three },
  pulseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
CA_HOME_EOF_9a8f3939

cat > src/app/_layout.tsx << 'CA_HOME_EOF_61643be1'
import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/context/auth';
import LoginScreen from '@/screens/login';

SplashScreen.preventAutoHideAsync();

function Gate() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <LoginScreen />;
  return <AppTabs />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}
CA_HOME_EOF_61643be1

echo "Done. 11 files written."
