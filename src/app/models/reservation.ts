import { PaymentMethod, ReservationStatus } from './enums';

export interface Reservation {
  id: string;
  user_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  pickup_location: string | null;
  dropoff_location: string | null;
  wants_delivery: boolean;
  delivery_address: string | null;
  delivery_fee: number;
  daily_rate: number;
  payment_method: PaymentMethod | null;
  status: ReservationStatus;
  created_at: string;
}

export interface ReservationInsert {
  id?: string;
  user_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  wants_delivery?: boolean;
  delivery_address?: string | null;
  delivery_fee?: number;
  daily_rate: number;
  payment_method?: PaymentMethod | null;
  status: ReservationStatus;
  created_at?: string;
}

export type ReservationUpdate = Partial<ReservationInsert>;
