export interface PlatformConfig {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export interface PlatformConfigInsert {
  key: string;
  value: string;
  description?: string | null;
  updated_at?: string;
}

export type PlatformConfigUpdate = Partial<PlatformConfigInsert>;
