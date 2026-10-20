import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminPage } from '../components/Admin/AdminPage';
import { api } from '../api/client';
import * as AuthContextModule from '../context/AuthContext';
import type {
  AdminDashboardResponse,
  PaginatedOutcomesResponse,
  KnowledgeQualityOverviewResponse,
  ProgrammeAnalyticsResponse,
} from '../types/auth';

const mockAdminUser = {
  id: 'admin-uuid-1',
  email: 'director@careercompass.ai',
  full_name: 'Director Admin',
  role: 'admin' as const,
  is_active: true,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

const mockDashboardData: AdminDashboardResponse = {
  kpis: {
    total_registered_users: 50,
    active_users: 22,
    total_conversations: 30,
    pending_escalations: 3,
    pending_escalations_note: '3 cases awaiting counsellor assignment',
    pending_escalations_available: true,
    collected_feedback_count: 15,
  },
  conversation_trends: [
    { date: '2026-10-15', count: 5 },
    { date: '2026-10-16', count: 8 },
  ],
  engagement_by_persona: [],
  concern_categories: [
    {
      category: 'income',
      label: 'Income & Financial Limits',
      count: 14,
      data_available: true,
      source_description: 'Signals from student and parent dialogues',
    },
    {
      category: 'job_security',
      label: 'Job Security & Demand',
      count: 9,
      data_available: true,
      source_description: 'Signals from student and parent dialogues',
    },
  ],
  feedback_breakdown: {
    helpful: 12,
    unhelpful: 3,
    helpful_percentage: 80,
  },
  filters: {
    available_languages: [],
    available_locations: [],
    date_range_available: true,
    language_filter_available: false,
    location_filter_available: false,
    language_note: 'No column',
    location_note: 'No column',
  },
  data_sources: ['Neon PostgreSQL'],
  missing_metrics: [],
};

const mockOutcomesData: PaginatedOutcomesResponse = {
  items: [
    {
      id: 'out-1',
      trade: 'Industrial Electrician',
      training_provider: 'National Skill Training Institute (NSTI)',
      location: 'Maharashtra',
      nsqf_level: 'Level 5',
      placement_rate: 88,
      post_training_earnings_range: '₹22,000 - ₹34,000/mo',
      reporting_period: '2025-2026',
      sample_size: 240,
      progression_pathways: 'Junior Technician -> Maintenance Lead',
      source_url: 'https://msde.gov.in/reports/outcomes-2026',
      verification_status: 'verified',
      last_verified_date: '2026-10-15T00:00:00Z',
      verified_by: 'admin-uuid-1',
      notes: 'State council verified',
      created_at: '2026-10-15T00:00:00Z',
      updated_at: '2026-10-15T00:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
  total_pages: 1,
  verified_count: 1,
  unverified_count: 0,
  pending_review_count: 0,
};

const mockKnowledgeData: KnowledgeQualityOverviewResponse = {
  total_sources: 4,
  total_chunks: 120,
  embedding_model: 'text-embedding-3-small',
  sources: [
    {
      source_id: 'nsqf_electrician_framework',
      source_title: 'NSQF National Occupational Standard: Electrician',
      source_url: 'https://nsqf.gov.in/standards/electrician',
      chunk_count: 35,
      embedding_model: 'text-embedding-3-small',
      embedding_dim: 1536,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
      helpful_feedback_count: 18,
      unhelpful_feedback_count: 1,
    },
  ],
};

const mockAnalyticsData: ProgrammeAnalyticsResponse = {
  total_consultations: 45,
  concern_distribution: [
    { category: 'income', label: 'Income & Financial Limits', signals: 20, share_percentage: 44.4 },
    { category: 'job_security', label: 'Job Security & Demand', signals: 15, share_percentage: 33.3 },
  ],
  escalation_resolution_rate: 78.5,
  escalation_summary: {
    pending: 3,
    assigned: 4,
    in_progress: 2,
    resolved: 11,
    total: 20,
  },
  concern_shifts: [
    {
      category: 'income',
      initial_signals: 20,
      resolved_or_assisted_signals: 16,
      shift_percentage: 80.0,
      data_sufficient: true,
      note: 'Robust sample size from student turns',
    },
  ],
  data_sources: ['Neon dialogue memory', 'verified_outcomes table'],
  filters_applied: {},
};

describe('Dedicated Full-Page Admin Experience (AdminPage)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockAdminUser,
      token: 'mock-admin-token',
      isAuthenticated: true,
      isAdmin: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
    });

    vi.spyOn(api, 'getAdminDashboard').mockResolvedValue(mockDashboardData);
    vi.spyOn(api, 'getAdminUsers').mockResolvedValue({
      items: [],
      users: [],
      total: 50,
      page: 1,
      limit: 10,
      total_pages: 5,
    } as any);
    vi.spyOn(api, 'getAdminEscalations').mockResolvedValue({
      items: [],
      total: 3,
      pending_count: 3,
      assigned_count: 0,
      in_progress_count: 0,
      resolved_count: 0,
      page: 1,
      limit: 15,
      total_pages: 1,
    });
    vi.spyOn(api, 'getAdminOutcomes').mockResolvedValue(mockOutcomesData);
    vi.spyOn(api, 'getAdminKnowledgeSources').mockResolvedValue(mockKnowledgeData);
    vi.spyOn(api, 'getAdminProgrammeAnalytics').mockResolvedValue(mockAnalyticsData);
    vi.spyOn(api, 'getAdminAnalyticsCsvUrl').mockReturnValue('http://localhost:8000/api/v1/admin/analytics/export-csv');
  });

  it('renders persistent left sidebar with all 8 dedicated sections', async () => {
    render(<AdminPage onBackToChat={vi.fn()} />);

    expect(screen.getByText('CareerCompass AI')).toBeDefined();
    expect(screen.getByText('Admin Panel')).toBeDefined();

    // Verify 8 sidebar sections exist
    expect(screen.getByRole('button', { name: /^Overview/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Users/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Family Concerns & Sentiment/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Counsellor Escalations/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Verified Trade Outcomes/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Knowledge Base/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Programme Analytics/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Settings/i })).toBeDefined();
  });

  it('provides prominent Back to Chat button navigating back to consultation workspace', async () => {
    const handleBackToChat = vi.fn();
    render(<AdminPage onBackToChat={handleBackToChat} />);

    const backButton = screen.getByRole('button', { name: /Back to Chat/i });
    expect(backButton).toBeDefined();

    fireEvent.click(backButton);
    expect(handleBackToChat).toHaveBeenCalledTimes(1);
  });

  it('navigates to Verified Trade Outcomes and displays benchmark metrics and provenance', async () => {
    render(<AdminPage onBackToChat={vi.fn()} />);

    const outcomesNav = screen.getByRole('button', { name: /^Verified Trade Outcomes/i });
    fireEvent.click(outcomesNav);

    await waitFor(() => {
      expect(screen.getByText('Verified Trade Outcomes Management')).toBeDefined();
      expect(screen.getByText('Industrial Electrician')).toBeDefined();
      expect(screen.getByText('National Skill Training Institute (NSTI)')).toBeDefined();
      expect(screen.getByText('88%')).toBeDefined();
      expect(screen.getByText('₹22,000 - ₹34,000/mo')).toBeDefined();
      expect(screen.getByText('Provenance')).toBeDefined();
    });
  });

  it('navigates to Knowledge Base and displays chunk count and embedding model topology', async () => {
    render(<AdminPage onBackToChat={vi.fn()} />);

    const knowledgeNav = screen.getByRole('button', { name: /^Knowledge Base/i });
    fireEvent.click(knowledgeNav);

    await waitFor(() => {
      expect(screen.getByText('Knowledge Base & Retrieval Quality')).toBeDefined();
      expect(screen.getByText('120')).toBeDefined();
      expect(screen.getByText('NSQF National Occupational Standard: Electrician')).toBeDefined();
      expect(screen.getAllByText(/text-embedding-3-small/i).length).toBeGreaterThan(0);
    });
  });

  it('navigates to Programme Analytics and displays concern shift progression and CSV export', async () => {
    render(<AdminPage onBackToChat={vi.fn()} />);

    const analyticsNav = screen.getByRole('button', { name: /^Programme Analytics/i });
    fireEvent.click(analyticsNav);

    await waitFor(() => {
      expect(screen.getByText('Programme Analytics & Outcome Shifts')).toBeDefined();
      expect(screen.getByText('78.5%')).toBeDefined();
      expect(screen.getByText('Export Anonymized CSV')).toBeDefined();
      expect(screen.getByText('+80%')).toBeDefined();
    });
  });

  it('navigates to Settings and displays Neon PostgreSQL connection and RBAC enforcement', async () => {
    render(<AdminPage onBackToChat={vi.fn()} />);

    const settingsNav = screen.getByRole('button', { name: /^Settings/i });
    fireEvent.click(settingsNav);

    await waitFor(() => {
      expect(screen.getByText('Admin Governance & System Configuration')).toBeDefined();
      expect(screen.getByText('Connected')).toBeDefined();
      expect(screen.getByText('Neon Lakebase Postgres (Serverless)')).toBeDefined();
      expect(screen.getByText(/0007_add_verified_outcomes/i)).toBeDefined();
      expect(screen.getAllByText('Director Admin').length).toBeGreaterThan(0);
    });
  });
});
