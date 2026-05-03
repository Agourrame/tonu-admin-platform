export interface Notification {
  id: string;
  user_id: string | null;
  agency_id: string | null;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationInsert {
  id?: string;
  user_id?: string | null;
  agency_id?: string | null;
  type: string;
  title: string;
  body?: string | null;
  is_read?: boolean;
  created_at?: string;
}

export type NotificationUpdate = Partial<NotificationInsert>;
