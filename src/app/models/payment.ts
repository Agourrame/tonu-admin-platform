import { PaymentMethod, PaymentStatus } from './enums';

export interface Payment {
  id: string;
  reservation_id: string;
  amount_total: number;
  agency_commission: number;
  net_agency: number;
  platform_revenue: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paid_at: string | null;
}

export interface PaymentInsert {
  id?: string;
  reservation_id: string;
  amount_total: number;
  agency_commission: number;
  net_agency: number;
  platform_revenue: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paid_at?: string | null;
}

export type PaymentUpdate = Partial<PaymentInsert>;
