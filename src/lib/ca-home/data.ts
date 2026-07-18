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
