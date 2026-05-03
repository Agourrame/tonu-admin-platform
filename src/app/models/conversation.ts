export interface Conversation {
  id: string;
  user_id: string;
  agency_id: string;
  vehicle_id: string | null;
  reservation_id: string | null;
  last_message_at: string | null;
  user_last_read_at: string | null;
  agency_last_read_at: string | null;
  created_at: string;
}

export interface ConversationInsert {
  id?: string;
  user_id: string;
  agency_id: string;
  vehicle_id?: string | null;
  reservation_id?: string | null;
  last_message_at?: string | null;
  user_last_read_at?: string | null;
  agency_last_read_at?: string | null;
  created_at?: string;
}

export type ConversationUpdate = Partial<ConversationInsert>;
