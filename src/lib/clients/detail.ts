import { supabase } from '@/lib/supabase';

/**
 * Client detail data layer — read-only.
 *
 * Ports only the CA-relevant slice of the web ClientProfileView: profile
 * header, connection info, ITR filings, GST filings. Portfolio / goals /
 * insurance / CFP / recommendations are RIA-CFP persona and out of v1 scope.
 *
 * Filings are filtered `professional_id` + `client_id`, matching web. RLS on
 * both filing tables is policy-verified (qual is row-level), so this narrower
 * query shape cannot behave differently from CA Home's batch fetch.
 *
 * No amounts are read. gst_filings carries money inside jsonb columns
 * (tax_liability, itc_data, b2c_summary, b2b_invoices) whose unit is not yet
 * proven against real row arithmetic. Money gets its own verification pass.
 */
export interface ClientProfile {
  clientId: string;
  name: string;
  city: string | null;
  state: string | null;
  designation: string | null;
}

export interface ClientConnection {
  status: string;
  serviceType: string;
  connectedAt: string | null;
}

export interface ItrFilingEntry {
  id: string;
  itrType: string;
  assessmentYear: string;
  status: string;
  dueDate: string | null;
  filedDate: string | null;
  pan: string | null;
  acknowledgementNumber: string | null;
  updatedAt: string | null;
}

export interface GstFilingEntry {
  id: string;
  gstin: string;
  returnType: string;
  period: string;
  status: string;
  dueDate: string | null;
  filedDate: string | null;
  acknowledgementNumber: string | null;
  updatedAt: string | null;
}

export interface DocumentEntry {
  id: string;
  fileName: string;
  fileSize: number | null;
  fileType: string | null;
  category: string | null;
  assessmentYear: string | null;
  createdAt: string | null;
  storagePath: string | null;
}

export interface ClientDetail {
  profile: ClientProfile;
  connection: ClientConnection | null;
  itrFilings: ItrFilingEntry[];
  gstFilings: GstFilingEntry[];
  documents: DocumentEntry[];
}

export async function fetchClientDetail(userId: string, clientId: string): Promise<ClientDetail> {
  const [profileRes, connRes, itrRes, gstRes] = await Promise.all([
    supabase
      .from('public_profiles')
      .select('user_id, name, city, state, designation')
      .eq('user_id', clientId)
      .maybeSingle(),
    supabase
      .from('connections')
      .select('id, status, service_type, connected_at, created_at')
      .eq('professional_id', userId)
      .eq('client_id', clientId)
      .eq('service_type', 'CA')
      .eq('status', 'ACTIVE')
      .maybeSingle(),
    supabase
      .from('itr_filings')
      .select('id, itr_type, assessment_year, status, due_date, filed_date, pan, acknowledgement_number, updated_at')
      .eq('professional_id', userId)
      .eq('client_id', clientId),
    supabase
      .from('gst_filings')
      .select('id, gstin, return_type, period, status, due_date, filed_date, acknowledgement_number, updated_at')
      .eq('professional_id', userId)
      .eq('client_id', clientId),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (itrRes.error) throw itrRes.error;
  if (gstRes.error) throw gstRes.error;

  const p = profileRes.data as {
    user_id: string;
    name: string | null;
    city: string | null;
    state: string | null;
    designation: string | null;
  } | null;

  const conn = connRes.data as {
    id: string;
    status: string;
    service_type: string;
    connected_at: string | null;
    created_at: string | null;
  } | null;

  const itrRows = (itrRes.data ?? []) as {
    id: string;
    itr_type: string;
    assessment_year: string;
    status: string | null;
    due_date: string | null;
    filed_date: string | null;
    pan: string | null;
    acknowledgement_number: string | null;
    updated_at: string | null;
  }[];

  const gstRows = (gstRes.data ?? []) as {
    id: string;
    gstin: string;
    return_type: string;
    period: string;
    status: string | null;
    due_date: string | null;
    filed_date: string | null;
    acknowledgement_number: string | null;
    updated_at: string | null;
  }[];

  const itrFilings: ItrFilingEntry[] = itrRows
    .map((r) => ({
      id: r.id,
      itrType: r.itr_type,
      assessmentYear: r.assessment_year,
      status: r.status ?? 'not_started',
      dueDate: r.due_date,
      filedDate: r.filed_date,
      pan: r.pan,
      acknowledgementNumber: r.acknowledgement_number,
      updatedAt: r.updated_at,
    }))
    .sort((a, b) => b.assessmentYear.localeCompare(a.assessmentYear));

  const gstFilings: GstFilingEntry[] = gstRows
    .map((r) => ({
      id: r.id,
      gstin: r.gstin,
      returnType: r.return_type,
      period: r.period,
      status: r.status ?? 'not_started',
      dueDate: r.due_date,
      filedDate: r.filed_date,
      acknowledgementNumber: r.acknowledgement_number,
      updatedAt: r.updated_at,
    }))
    .sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? ''));

  // Stage 2: documents hang off connection_id, never client_id. RLS keys on
  // uploaded_by and mobile keys on connection_id; they are different columns
  // and only one of them was ever correct. Errors throw rather than yielding
  // an empty list, because an empty list is indistinguishable from success.
  // storage_path is selected so a row can be opened. The bucket is private,
  // so only a signed URL reads an object, and storage RLS checks the caller at
  // signing time.
  let documents: DocumentEntry[] = [];
  if (conn?.id) {
    const docRes = await supabase
      .from('documents')
      .select('id, file_name, file_size, file_type, category, assessment_year, created_at, storage_path')
      .eq('connection_id', conn.id)
      .eq('status', 'UPLOADED')
      .neq('uploaded_by', userId)
      .order('created_at', { ascending: false });
    if (docRes.error) throw docRes.error;
    const docRows = (docRes.data ?? []) as {
      id: string;
      file_name: string | null;
      file_size: number | null;
      file_type: string | null;
      category: string | null;
      assessment_year: string | null;
      created_at: string | null;
      storage_path: string | null;
    }[];
    documents = docRows.map((r) => ({
      id: r.id,
      fileName: r.file_name || 'Untitled document',
      fileSize: r.file_size,
      fileType: r.file_type,
      category: r.category,
      assessmentYear: r.assessment_year,
      createdAt: r.created_at,
      storagePath: r.storage_path,
    }));
  }

  return {
    profile: {
      clientId,
      name: p?.name || 'Unknown client',
      city: p?.city ?? null,
      state: p?.state ?? null,
      designation: p?.designation ?? null,
    },
    connection: conn
      ? {
          status: conn.status,
          serviceType: conn.service_type,
          connectedAt: conn.connected_at ?? conn.created_at ?? null,
        }
      : null,
    itrFilings,
    gstFilings,
    documents,
  };
}
