import { VehicleFuel, VehicleTransmission, VehicleStatus } from './enums';

export interface Vehicle {
  id: string;
  agency_id: string;
  brand: string;
  model: string;
  year: number;
  fuel: VehicleFuel;
  transmission: VehicleTransmission;
  seats: number;
  category: string;
  engine_cc: number | null;
  horsepower: number | null;
  fuel_consumption: number | null;
  current_km: number | null;
  km_limit_per_day: number | null;
  unlimited_km: boolean;
  extra_km_price: number | null;
  insurance_type: string | null;
  insurance_expiry: string | null;
  insurance_company: string | null;
  deposit_amount: number | null;
  price_per_day: number;
  price_per_week: number | null;
  /** Booking constraint set by the agency — renters can't book fewer
   *  days than this. Defaults to 1 (no minimum). Stored on the vehicle
   *  so different cars in the same fleet can have different policies
   *  (e.g. premium SUVs require 3-day minimum, economy 1-day). */
  min_rental_days: number;
  plate_number: string;
  status: VehicleStatus;
  created_at: string;
}

export interface VehicleInsert {
  id?: string;
  agency_id: string;
  brand: string;
  model: string;
  year: number;
  fuel: VehicleFuel;
  transmission: VehicleTransmission;
  seats: number;
  category: string;
  engine_cc?: number | null;
  horsepower?: number | null;
  fuel_consumption?: number | null;
  current_km?: number | null;
  km_limit_per_day?: number | null;
  unlimited_km?: boolean;
  extra_km_price?: number | null;
  insurance_type?: string | null;
  insurance_expiry?: string | null;
  insurance_company?: string | null;
  deposit_amount?: number | null;
  price_per_day: number;
  price_per_week?: number | null;
  min_rental_days?: number;
  plate_number: string;
  status: VehicleStatus;
  created_at?: string;
}

export type VehicleUpdate = Partial<VehicleInsert>;
