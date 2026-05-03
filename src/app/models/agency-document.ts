import { AgencyDocumentStatus } from './enums';

export interface AgencyDocument {
  id: string;
  agency_id: string;
  doc_type: string;
  file_url: string;
  status: AgencyDocumentStatus;
  verified_at: string | null;
}

export interface AgencyDocumentInsert {
  id?: string;
  agency_id: string;
  doc_type: string;
  file_url: string;
  status: AgencyDocumentStatus;
  verified_at?: string | null;
}

export type AgencyDocumentUpdate = Partial<AgencyDocumentInsert>;
