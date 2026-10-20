import type {
  BackendHealthResponse,
  ChatMessageRequestPayload,
  ChatMessageResponsePayload,
  ConversationSession,
  MessageListResponse,
  UserMemoryRecord,
  MemoryForgetResponse,
  MessageFeedbackRecord,
} from '../types/chat';
import type {
  AuthUser,
  TokenResponse,
  AdminStatsResponse,
  AdminDashboardResponse,
  PaginatedUsersResponse,
  UserDetailResponse,
  PaginatedEscalationsResponse,
  EscalationCaseBrief,
  EscalationCaseUpdateRequest,
  PaginatedOutcomesResponse,
  VerifiedOutcomeItem,
  KnowledgeQualityOverviewResponse,
  ProgrammeAnalyticsResponse,
} from '../types/auth';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
).replace(/\/+$/, '');

const TOKEN_STORAGE_KEY = 'careercompass_auth_token';
const USER_STORAGE_KEY = 'careercompass_auth_user';

class ApiClientError extends Error {
  statusCode?: number;
  details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function buildHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...customHeaders };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response, isAuthRoute: boolean = false): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Server error (${res.status})`;
    let details: unknown = null;
    try {
      const errorJson = await res.json();
      if (errorJson.error?.message) {
        errorMsg = errorJson.error.message;
        details = errorJson.error.details;
      } else if (errorJson.detail) {
        errorMsg = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
      }
    } catch {
      // ignore non-json response parsing error
    }

    if (res.status === 401 && !isAuthRoute) {
      // Clear expired credentials and notify listeners
      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    throw new ApiClientError(errorMsg, res.status, details);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getBaseUrl(): string {
    return API_BASE_URL;
  },

  // ---------------------------------------------------------------------------
  // Authentication & Session Storage
  // ---------------------------------------------------------------------------

  getToken(): string | null {
    return getStoredToken();
  },

  getStoredUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setAuth(token: string, user: AuthUser): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignore storage errors
    }
  },

  clearAuth(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  },

  async signup(fullName: string, email: string, password: string): Promise<TokenResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
      }),
    });
    const data = await handleResponse<TokenResponse>(res, true);
    this.setAuth(data.access_token, data.user);
    return data;
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse<TokenResponse>(res, true);
    this.setAuth(data.access_token, data.user);
    return data;
  },

  async getMe(): Promise<AuthUser> {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    const user = await handleResponse<AuthUser>(res);
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
    return user;
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: buildHeaders({ 'Accept': 'application/json' }),
      });
    } catch {
      // ignore logout network errors
    } finally {
      this.clearAuth();
    }
  },

  // ---------------------------------------------------------------------------
  // Admin Endpoints
  // ---------------------------------------------------------------------------

  async getAdminUsers(params?: {
    q?: string;
    role?: string;
    is_active?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedUsersResponse> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.role) searchParams.set('role', params.role);
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    const url = `${API_BASE_URL}/admin/users${query ? `?${query}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    return await handleResponse<PaginatedUsersResponse>(res);
  },

  async getAdminUserDetail(userId: string): Promise<UserDetailResponse> {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: 'GET',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    return await handleResponse<UserDetailResponse>(res);
  },

  async updateUserStatus(userId: string, isActive: boolean): Promise<AuthUser> {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: buildHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }),
      body: JSON.stringify({ is_active: isActive }),
    });
    return await handleResponse<AuthUser>(res);
  },

  async getAdminEscalations(params?: {
    status?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedEscalationsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    const url = `${API_BASE_URL}/admin/escalations${query ? `?${query}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    return await handleResponse<PaginatedEscalationsResponse>(res);
  },

  async getAdminEscalationDetail(caseId: string): Promise<EscalationCaseBrief> {
    const res = await fetch(`${API_BASE_URL}/admin/escalations/${caseId}`, {
      method: 'GET',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    return await handleResponse<EscalationCaseBrief>(res);
  },

  async updateEscalationCase(
    caseId: string,
    payload: EscalationCaseUpdateRequest,
  ): Promise<EscalationCaseBrief> {
    const res = await fetch(`${API_BASE_URL}/admin/escalations/${caseId}`, {
      method: 'PATCH',
      headers: buildHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }),
      body: JSON.stringify(payload),
    });
    return await handleResponse<EscalationCaseBrief>(res);
  },

  async getAdminStats(): Promise<AdminStatsResponse> {
    const res = await fetch(`${API_BASE_URL}/admin/stats`, {
      method: 'GET',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    return await handleResponse<AdminStatsResponse>(res);
  },

  async getAdminDashboard(params?: {
    start_date?: string;
    end_date?: string;
    language?: string;
    location?: string;
  }): Promise<AdminDashboardResponse> {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (params?.language) searchParams.set('language', params.language);
    if (params?.location) searchParams.set('location', params.location);

    const query = searchParams.toString();
    const url = `${API_BASE_URL}/admin/dashboard${query ? `?${query}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    return await handleResponse<AdminDashboardResponse>(res);
  },

  async getAdminOutcomes(params?: {
    trade?: string;
    verification_status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedOutcomesResponse> {
    const searchParams = new URLSearchParams();
    if (params?.trade) searchParams.set('trade', params.trade);
    if (params?.verification_status) searchParams.set('verification_status', params.verification_status);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    const url = `${API_BASE_URL}/admin/outcomes${query ? `?${query}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    return await handleResponse<PaginatedOutcomesResponse>(res);
  },

  async createAdminOutcome(payload: Partial<VerifiedOutcomeItem>): Promise<VerifiedOutcomeItem> {
    const res = await fetch(`${API_BASE_URL}/admin/outcomes`, {
      method: 'POST',
      headers: buildHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }),
      body: JSON.stringify(payload),
    });
    return await handleResponse<VerifiedOutcomeItem>(res);
  },

  async updateAdminOutcome(
    outcomeId: string,
    payload: Partial<VerifiedOutcomeItem>,
  ): Promise<VerifiedOutcomeItem> {
    const res = await fetch(`${API_BASE_URL}/admin/outcomes/${outcomeId}`, {
      method: 'PATCH',
      headers: buildHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }),
      body: JSON.stringify(payload),
    });
    return await handleResponse<VerifiedOutcomeItem>(res);
  },

  async deleteAdminOutcome(outcomeId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/admin/outcomes/${outcomeId}`, {
      method: 'DELETE',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    if (!res.ok) {
      throw new ApiClientError(`Failed to delete outcome record (${res.status})`, res.status);
    }
  },

  async getAdminKnowledgeSources(): Promise<KnowledgeQualityOverviewResponse> {
    const res = await fetch(`${API_BASE_URL}/admin/knowledge/sources`, {
      method: 'GET',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    return await handleResponse<KnowledgeQualityOverviewResponse>(res);
  },

  async deleteAdminKnowledgeSource(sourceId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/admin/knowledge/sources/${encodeURIComponent(sourceId)}`, {
      method: 'DELETE',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    if (!res.ok) {
      throw new ApiClientError(`Failed to delete knowledge source (${res.status})`, res.status);
    }
  },

  async getAdminProgrammeAnalytics(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<ProgrammeAnalyticsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);

    const query = searchParams.toString();
    const url = `${API_BASE_URL}/admin/analytics${query ? `?${query}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    return await handleResponse<ProgrammeAnalyticsResponse>(res);
  },

  getAdminAnalyticsCsvUrl(params?: { start_date?: string; end_date?: string }): string {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    const token = getStoredToken();
    if (token) searchParams.set('token', token);
    const query = searchParams.toString();
    return `${API_BASE_URL}/admin/analytics/export-csv${query ? `?${query}` : ''}`;
  },

  // ---------------------------------------------------------------------------
  // Health & Core Chat
  // ---------------------------------------------------------------------------

  async checkHealth(): Promise<BackendHealthResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      return await handleResponse<BackendHealthResponse>(res);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) throw err;
      throw new ApiClientError(
        'Unable to connect to backend server. Please verify backend is running on port 8000.',
        0,
        err
      );
    }
  },

  async sendMessage(payload: ChatMessageRequestPayload): Promise<ChatMessageResponsePayload> {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/message`, {
        method: 'POST',
        headers: buildHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }),
        body: JSON.stringify(payload),
      });
      return await handleResponse<ChatMessageResponsePayload>(res);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) throw err;
      throw new ApiClientError(
        'Failed to deliver message. Check backend and database connectivity.',
        0,
        err
      );
    }
  },

  async getSessions(): Promise<{ conversations: ConversationSession[] }> {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/conversations`, {
        method: 'GET',
        headers: buildHeaders({ 'Accept': 'application/json' }),
      });
      return await handleResponse<{ conversations: ConversationSession[] }>(res);
    } catch {
      return { conversations: [] };
    }
  },

  async createSession(title?: string): Promise<ConversationSession> {
    const res = await fetch(`${API_BASE_URL}/chat/conversations`, {
      method: 'POST',
      headers: buildHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }),
      body: JSON.stringify({ title: title || 'New Consultation' }),
    });
    return await handleResponse<ConversationSession>(res);
  },

  async getConversationMessages(conversationId: string): Promise<MessageListResponse> {
    const res = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'GET',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    return await handleResponse<MessageListResponse>(res);
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    if (!res.ok) {
      throw new ApiClientError(`Failed to delete conversation (${res.status})`, res.status);
    }
  },

  async renameConversation(conversationId: string, title: string): Promise<ConversationSession> {
    const res = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: buildHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }),
      body: JSON.stringify({ title }),
    });
    return await handleResponse<ConversationSession>(res);
  },

  // ---------------------------------------------------------------------------
  // Memory & Profile Management (Prompt 10)
  // ---------------------------------------------------------------------------

  async listMemories(): Promise<UserMemoryRecord[]> {
    const res = await fetch(`${API_BASE_URL}/memory`, {
      method: 'GET',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    return await handleResponse<UserMemoryRecord[]>(res);
  },

  async createMemory(payload: { key: string; value: string; category?: string }): Promise<UserMemoryRecord> {
    const res = await fetch(`${API_BASE_URL}/memory`, {
      method: 'POST',
      headers: buildHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }),
      body: JSON.stringify(payload),
    });
    return await handleResponse<UserMemoryRecord>(res);
  },

  async updateMemory(memoryId: string, payload: { value: string; category?: string }): Promise<UserMemoryRecord> {
    const res = await fetch(`${API_BASE_URL}/memory/${memoryId}`, {
      method: 'PUT',
      headers: buildHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }),
      body: JSON.stringify(payload),
    });
    return await handleResponse<UserMemoryRecord>(res);
  },

  async deleteMemory(memoryId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/memory/${memoryId}`, {
      method: 'DELETE',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    if (!res.ok) {
      throw new ApiClientError(`Failed to delete memory fact (${res.status})`, res.status);
    }
  },

  async forgetAllMemories(): Promise<MemoryForgetResponse> {
    const res = await fetch(`${API_BASE_URL}/memory`, {
      method: 'DELETE',
      headers: buildHeaders({ 'Accept': 'application/json' }),
    });
    return await handleResponse<MemoryForgetResponse>(res);
  },

  // ---------------------------------------------------------------------------
  // Message Feedback (Prompt 11)
  // ---------------------------------------------------------------------------

  async submitMessageFeedback(
    messageId: string,
    rating: 'helpful' | 'unhelpful',
    comment?: string,
    category?: string,
  ): Promise<MessageFeedbackRecord> {
    const res = await fetch(`${API_BASE_URL}/chat/messages/${messageId}/feedback`, {
      method: 'POST',
      headers: buildHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }),
      body: JSON.stringify({ rating, comment, category }),
    });
    return await handleResponse<MessageFeedbackRecord>(res);
  },

  async getMessageFeedback(messageId: string): Promise<MessageFeedbackRecord | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/messages/${messageId}/feedback`, {
        method: 'GET',
        headers: buildHeaders({ 'Accept': 'application/json' }),
      });
      if (res.status === 404) return null;
      return await handleResponse<MessageFeedbackRecord>(res);
    } catch {
      return null;
    }
  },
};

export { ApiClientError };
