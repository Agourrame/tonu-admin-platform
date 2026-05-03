export interface VehicleFeature {
  id: string;
  vehicle_id: string;
  feature_name: string;
  feature_category: string | null;
  is_included: boolean;
  extra_price: number | null;
}

export interface VehicleFeatureInsert {
  id?: string;
  vehicle_id: string;
  feature_name: string;
  feature_category?: string | null;
  is_included?: boolean;
  extra_price?: number | null;
}

export type VehicleFeatureUpdate = Partial<VehicleFeatureInsert>;
