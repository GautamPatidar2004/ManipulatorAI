export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface AdminStatsResponse {
  users: {
    total: number;
    admins: number;
    standard_users: number;
  };
  conversations: {
    total: number;
    messages: number;
  };
  knowledge_base: {
    chunks_indexed: number;
  };
  feedback: {
    total_reviews: number;
  };
}

export interface AdminUserListResponse {
  users: AuthUser[];
  total: number;
}

export interface DashboardKPICards {
  total_registered_users: number;
  active_users: number;
  total_conversations: number;
  pending_escalations: number | null;
  pending_escalations_note: string;
  pending_escalations_available: boolean;
  collected_feedback_count: number;
}

export interface ConversationTrendPoint {
  date: string;
  count: number;
}

export interface ConcernCategoryMetric {
  category: string;
  label: string;
  count: number;
  data_available: boolean;
  source_description: string;
}

export interface EngagementMetric {
  persona: string;
  count: number | null;
  data_available: boolean;
  note: string;
}

export interface FeedbackRatingBreakdown {
  helpful: number;
  unhelpful: number;
  helpful_percentage: number | null;
}

export interface FilterAvailability {
  date_range_available: boolean;
  language_filter_available: boolean;
  language_note: string;
  location_filter_available: boolean;
  location_note: string;
  available_languages: string[];
  available_locations: string[];
}

export interface AdminDashboardResponse {
  kpis: DashboardKPICards;
  conversation_trends: ConversationTrendPoint[];
  engagement_by_persona: EngagementMetric[];
  concern_categories: ConcernCategoryMetric[];
  feedback_breakdown: FeedbackRatingBreakdown;
  filters: FilterAvailability;
  data_sources: string[];
  missing_metrics: string[];
}

export interface UserSummaryResponse {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  conversation_count: number;
  feedback_count: number;
  last_active_at: string | null;
}

export interface PaginatedUsersResponse {
  items: UserSummaryResponse[];
  users: UserSummaryResponse[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface UserConversationBrief {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface UserFeedbackBrief {
  id: string;
  message_id: string;
  conversation_id: string;
  rating: string;
  category: string | null;
  created_at: string;
}

export interface UserDetailResponse {
  user: AuthUser;
  conversations: UserConversationBrief[];
  feedback: UserFeedbackBrief[];
  active_memories_count: number;
  escalation_cases_count: number;
}

export interface EscalationCaseBrief {
  id: string;
  conversation_id: string;
  conversation_title: string | null;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  trigger_type: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'assigned' | 'in_progress' | 'resolved';
  user_notes: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedEscalationsResponse {
  items: EscalationCaseBrief[];
  total: number;
  pending_count: number;
  assigned_count: number;
  in_progress_count: number;
  resolved_count: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface EscalationCaseUpdateRequest {
  status?: 'pending' | 'assigned' | 'in_progress' | 'resolved';
  priority?: 'high' | 'medium' | 'low';
  assigned_to?: string | null;
  resolution_notes?: string | null;
}

export interface VerifiedOutcomeItem {
  id: string;
  trade: string;
  training_provider: string;
  location: string;
  nsqf_level: string;
  placement_rate: number;
  post_training_earnings_range: string;
  reporting_period: string;
  sample_size: number;
  progression_pathways: string | null;
  source_url: string;
  verification_status: 'verified' | 'unverified' | 'pending_review';
  last_verified_date: string;
  verified_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedOutcomesResponse {
  items: VerifiedOutcomeItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  verified_count: number;
  unverified_count: number;
  pending_review_count: number;
}

export interface KnowledgeSourceItem {
  source_id: string;
  source_title: string;
  source_url: string | null;
  chunk_count: number;
  embedding_model: string;
  embedding_dim: number;
  created_at: string;
  updated_at: string;
  helpful_feedback_count: number;
  unhelpful_feedback_count: number;
}

export interface KnowledgeQualityOverviewResponse {
  total_sources: number;
  total_chunks: number;
  embedding_model: string;
  sources: KnowledgeSourceItem[];
}

export interface ProgrammeConcernShift {
  category: string;
  initial_signals: number;
  resolved_or_assisted_signals: number;
  shift_percentage: number;
  data_sufficient: boolean;
  note: string;
}

export interface ProgrammeAnalyticsResponse {
  total_consultations: number;
  concern_distribution: Array<{
    category: string;
    label: string;
    signals: number;
    share_percentage: number;
  }>;
  escalation_resolution_rate: number;
  escalation_summary: {
    pending: number;
    assigned: number;
    in_progress: number;
    resolved: number;
    total: number;
  };
  concern_shifts: ProgrammeConcernShift[];
  data_sources: string[];
  filters_applied: Record<string, any>;
}


