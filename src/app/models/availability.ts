export interface Availability {
  id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  is_blocked: boolean;
  reason: string | null;
}

export interface AvailabilityInsert {
  id?: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  is_blocked?: boolean;
  reason?: string | null;
}

export type AvailabilityUpdate = Partial<AvailabilityInsert>;
