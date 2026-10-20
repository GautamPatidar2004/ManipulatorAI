export * from './blocks';
import type { AnyStructuredBlock } from './blocks';

export type MessageRole = 'user' | 'assistant' | 'system';

export type ResponseStatus = 'ready' | 'unavailable' | 'error';

export interface StructuredBlock {
  type: string;
  title?: string;
  version?: string;
  blocks?: AnyStructuredBlock[];
  data?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  timestamp: string; // ISO string
  status?: ResponseStatus;
  structured?: StructuredBlock | null;
  notice?: string | null;
}

export interface ConversationSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatMessageRequestPayload {
  session_id?: string;
  conversation_id?: string;
  message: string;
}

export interface ChatMessageResponsePayload {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: string;
  status: ResponseStatus;
  structured?: StructuredBlock | null;
  notice?: string | null;
}

export interface BackendMessageItem {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  status: ResponseStatus;
  notice?: string | null;
  structured?: StructuredBlock | null;
  created_at: string;
}

export interface MessageListResponse {
  conversation_id: string;
  messages: BackendMessageItem[];
  total: number;
}

export interface BackendHealthResponse {
  status: string;
  app_name: string;
  environment: string;
  version: string;
  timestamp: string;
  ai_service_available: boolean;
  database?: {
    connected: boolean;
    error?: string | null;
  };
}

export interface UserMemoryRecord {
  id: string;
  user_id: string;
  key: string;
  value: string;
  category: string;
  source: string;
  confidence: number;
  version: number;
  is_active: boolean;
  source_conversation_id?: string | null;
  source_message_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryForgetResponse {
  forgotten_count: number;
  message: string;
  user_id: string;
}

export interface MessageFeedbackRecord {
  id: string;
  message_id: string;
  conversation_id: string;
  user_id: string;
  rating: 'helpful' | 'unhelpful';
  comment?: string | null;
  category?: string | null;
  created_at: string;
}

