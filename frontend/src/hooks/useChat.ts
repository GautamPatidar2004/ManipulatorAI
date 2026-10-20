import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiClientError } from '../api/client';
import type {
  ChatMessage,
  ConversationSession,
} from '../types/chat';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean>(false);
  const [checkingHealth, setCheckingHealth] = useState<boolean>(true);

  const lastFailedMessageRef = useRef<string | null>(null);

  // Check backend health on demand
  const checkHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const health = await api.checkHealth();
      setIsBackendHealthy(health.status === 'ok' || health.status === 'degraded');
      setIsDbConnected(health.database ? health.database.connected : true);
      setAiAvailable(health.ai_service_available);
    } catch {
      setIsBackendHealthy(false);
      setIsDbConnected(false);
      setAiAvailable(false);
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  // Fetch session history on demand
  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.getSessions();
      if (res?.conversations) {
        setSessions(res.conversations);
      }
    } catch {
      // Backend unavailable or network error
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    api.checkHealth()
      .then((health) => {
        if (!cancelled) {
          setIsBackendHealthy(health.status === 'ok' || health.status === 'degraded');
          setIsDbConnected(health.database ? health.database.connected : true);
          setAiAvailable(health.ai_service_available);
          setCheckingHealth(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsBackendHealthy(false);
          setIsDbConnected(false);
          setAiAvailable(false);
          setCheckingHealth(false);
        }
      });

    api.getSessions()
      .then((res) => {
        if (!cancelled && res?.conversations) {
          setSessions(res.conversations);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // Derive current conversation title
  const currentTitle =
    sessions.find((s) => s.id === activeSessionId)?.title ||
    (messages.length > 0
      ? messages[0].content.slice(0, 30) + (messages[0].content.length > 30 ? '...' : '')
      : 'New Consultation');

  const isSendingRef = useRef(false);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || isSendingRef.current) return;

      isSendingRef.current = true;
      setError(null);
      lastFailedMessageRef.current = null;

      // 1. Optimistically append user message
      const userMsgId = `msg_user_${Date.now()}`;
      const effectiveSessionId = activeSessionId || `conv_${Date.now().toString(36)}`;
      const userMessage: ChatMessage = {
        id: userMsgId,
        sessionId: effectiveSessionId,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === userMsgId)) return prev;
        return [...prev, userMessage];
      });
      setIsLoading(true);

      try {
        const response = await api.sendMessage({
          session_id: activeSessionId || undefined,
          message: trimmed,
        });

        // 2. Append assistant response, deduplicating strictly by ID
        const assistantMessage: ChatMessage = {
          id: response.id,
          sessionId: response.session_id,
          role: 'assistant',
          content: response.content,
          timestamp: response.timestamp,
          status: response.status,
          structured: response.structured,
          notice: response.notice,
        };

        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== assistantMessage.id);
          return [...filtered, assistantMessage];
        });

        if (!activeSessionId) {
          setActiveSessionId(response.session_id);
        }

        // Refresh sessions list from database
        await fetchSessions();
      } catch (err: unknown) {
        lastFailedMessageRef.current = trimmed;
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to reach backend server. Please verify the service is running.');
        }
      } finally {
        setIsLoading(false);
        isSendingRef.current = false;
      }
    },
    [activeSessionId, fetchSessions, isLoading]
  );

  const startNewChat = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setError(null);
  }, []);

  const selectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setError(null);
    setIsLoading(true);

    try {
      // Fetch persisted messages from PostgreSQL
      const res = await api.getConversationMessages(sessionId);
      if (res?.messages) {
        const seenIds = new Set<string>();
        const formattedMessages: ChatMessage[] = [];
        for (const m of res.messages) {
          if (!seenIds.has(m.id)) {
            seenIds.add(m.id);
            formattedMessages.push({
              id: m.id,
              sessionId: m.conversation_id,
              role: m.role,
              content: m.content,
              timestamp: m.created_at,
              status: m.status,
              notice: m.notice,
              structured: m.structured,
            });
          }
        }
        setMessages(formattedMessages);
      }
    } catch {
      // If fetching messages failed, keep empty or current messages
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await api.deleteConversation(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      }
    }
  }, [activeSessionId]);

  const retryLastMessage = useCallback(() => {
    if (lastFailedMessageRef.current) {
      sendMessage(lastFailedMessageRef.current);
    }
  }, [sendMessage]);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    sessions,
    activeSessionId,
    currentTitle,
    isLoading,
    error,
    isBackendHealthy,
    isDbConnected,
    aiAvailable,
    checkingHealth,
    sendMessage,
    startNewChat,
    selectSession,
    deleteSession,
    retryLastMessage,
    dismissError,
    refreshHealth: checkHealth,
  };
}
