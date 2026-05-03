export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface MessageInsert {
  id?: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at?: string;
}

export type MessageUpdate = Partial<MessageInsert>;
