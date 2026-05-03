export interface VehicleImage {
  id: string;
  vehicle_id: string;
  image_url: string;
  sort_order: number;
  is_primary: boolean;
}

export interface VehicleImageInsert {
  id?: string;
  vehicle_id: string;
  image_url: string;
  sort_order?: number;
  is_primary?: boolean;
}

export type VehicleImageUpdate = Partial<VehicleImageInsert>;
