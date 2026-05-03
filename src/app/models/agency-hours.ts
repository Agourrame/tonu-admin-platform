export interface AgencyHours {
  id: string;
  agency_id: string;
  /** 0 = Sunday, 6 = Saturday (DB CHECK: between 0 and 6). */
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface AgencyHoursInsert {
  id?: string;
  agency_id: string;
  day_of_week: number;
  open_time?: string | null;
  close_time?: string | null;
  is_closed?: boolean;
}

export type AgencyHoursUpdate = Partial<AgencyHoursInsert>;
