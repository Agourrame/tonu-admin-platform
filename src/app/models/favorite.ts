export interface Favorite {
  id: string;
  user_id: string;
  vehicle_id: string;
  created_at: string;
}

export interface FavoriteInsert {
  id?: string;
  user_id: string;
  vehicle_id: string;
  created_at?: string;
}

export type FavoriteUpdate = Partial<FavoriteInsert>;
