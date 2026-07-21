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
export function formatPeriod(period: string): string {
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
        clientId: f.client_id,
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
        clientId: f.client_id,
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
        clientId: f.client_id,
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
        clientId: f.client_id,
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
      clientId: doc.client_id,
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
      clientId: inv.client_id,
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
