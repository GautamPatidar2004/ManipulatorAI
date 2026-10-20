import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminPortalModal } from '../components/Admin/AdminPortalModal';
import { api } from '../api/client';
import type { AdminDashboardResponse, PaginatedUsersResponse } from '../types/auth';

const mockDashboardData: AdminDashboardResponse = {
  kpis: {
    total_registered_users: 42,
    active_users: 18,
    total_conversations: 25,
    pending_escalations: null,
    pending_escalations_note: 'Data not available: Counsellor handoff service is unconfigured in this deployment environment; no pending dispatch queue exists.',
    pending_escalations_available: false,
    collected_feedback_count: 14,
  },
  conversation_trends: [
    { date: '2026-10-10', count: 3 },
    { date: '2026-10-11', count: 5 },
    { date: '2026-10-12', count: 8 },
  ],
  engagement_by_persona: [
    {
      persona: 'Learner',
      count: null,
      data_available: false,
      note: 'Data not available (Parent/Learner persona not separated in schema; both hold user role)',
    },
    {
      persona: 'Parent',
      count: null,
      data_available: false,
      note: 'Data not available (Parent/Learner persona not separated in schema; both hold user role)',
    },
  ],
  concern_categories: [
    {
      category: 'income',
      label: 'Income & Financial Limits',
      count: 12,
      data_available: true,
      source_description: 'Aggregated from user budget constraints',
    },
    {
      category: 'job_security',
      label: 'Job Security & Career Stability',
      count: 19,
      data_available: true,
      source_description: 'Aggregated from market viability queries',
    },
    {
      category: 'social_status',
      label: 'Social Status & Family Expectations',
      count: 7,
      data_available: true,
      source_description: 'Aggregated from family alignment queries',
    },
    {
      category: 'safety',
      label: 'Safety & Relocation Constraints',
      count: 9,
      data_available: true,
      source_description: 'Aggregated from relocation preferences',
    },
    {
      category: 'education',
      label: 'Education & Stream Selection',
      count: 22,
      data_available: true,
      source_description: 'Aggregated from education level facts',
    },
  ],
  feedback_breakdown: {
    helpful: 12,
    unhelpful: 2,
    helpful_percentage: 85.7,
  },
  filters: {
    date_range_available: true,
    language_filter_available: false,
    language_note: 'Language is not stored as a dedicated column in conversations or users table.',
    location_filter_available: false,
    location_note: 'Location is not stored as a dedicated column in conversations or users table.',
    available_languages: [],
    available_locations: [],
  },
  data_sources: [
    'Neon PostgreSQL: users (registered accounts & status)',
    'Neon PostgreSQL: conversations (session count, timestamps & ownership)',
  ],
  missing_metrics: [
    'Parent vs Learner engagement breakdown: Schema does not track parent vs student user types.',
    'Pending counsellor escalations: External human counsellor handoff is unconfigured.',
  ],
};

const mockUserData: PaginatedUsersResponse = {
  items: [
    {
      id: 'usr-1',
      email: 'admin@careercompass.ai',
      full_name: 'Super Admin',
      role: 'admin',
      is_active: true,
      created_at: '2026-10-01T10:00:00Z',
      conversation_count: 5,
      feedback_count: 2,
      last_active_at: '2026-10-15T12:00:00Z',
    },
    {
      id: 'usr-2',
      email: 'student@example.com',
      full_name: 'Priya Patel',
      role: 'user',
      is_active: true,
      created_at: '2026-10-05T12:00:00Z',
      conversation_count: 3,
      feedback_count: 1,
      last_active_at: '2026-10-16T12:00:00Z',
    },
  ],
  users: [
    {
      id: 'usr-1',
      email: 'admin@careercompass.ai',
      full_name: 'Super Admin',
      role: 'admin',
      is_active: true,
      created_at: '2026-10-01T10:00:00Z',
      conversation_count: 5,
      feedback_count: 2,
      last_active_at: '2026-10-15T12:00:00Z',
    },
    {
      id: 'usr-2',
      email: 'student@example.com',
      full_name: 'Priya Patel',
      role: 'user',
      is_active: true,
      created_at: '2026-10-05T12:00:00Z',
      conversation_count: 3,
      feedback_count: 1,
      last_active_at: '2026-10-16T12:00:00Z',
    },
  ],
  total: 2,
  page: 1,
  limit: 10,
  total_pages: 1,
};

describe('Admin Overview Dashboard Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'getAdminDashboard').mockResolvedValue(mockDashboardData);
    vi.spyOn(api, 'getAdminUsers').mockResolvedValue(mockUserData);
  });

  it('renders all 5 KPI cards with live metrics and transparent data availability', async () => {
    render(<AdminPortalModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/CareerCompass Admin Operations/i)).toBeDefined();
    });

    // 1. Total Users
    expect(screen.getByText('Total Users')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();

    // 2. Active Users
    expect(screen.getByText('Active Users')).toBeDefined();
    expect(screen.getByText('18')).toBeDefined();

    // 3. Consultations
    expect(screen.getByText('Consultations')).toBeDefined();
    expect(screen.getByText('25')).toBeDefined();

    // 4. Pending Escalations (honestly declaring Data not available)
    expect(screen.getByText('Pending Escalations')).toBeDefined();
    expect(screen.getAllByText(/Data not available/i).length).toBeGreaterThanOrEqual(1);

    // 5. Feedback Reviews
    expect(screen.getByText('Feedback Reviews')).toBeDefined();
    expect(screen.getByText('14')).toBeDefined();
    expect(screen.getAllByText(/85.7% Helpful/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders conversation volume trends and 5 concern categories', async () => {
    render(<AdminPortalModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Conversation Trends Over Time/i)).toBeDefined();
    });

    // 5 Concern Categories
    expect(screen.getByText('Income & Financial Limits')).toBeDefined();
    expect(screen.getByText('Job Security & Career Stability')).toBeDefined();
    expect(screen.getByText('Social Status & Family Expectations')).toBeDefined();
    expect(screen.getByText('Safety & Relocation Constraints')).toBeDefined();
    expect(screen.getByText('Education & Stream Selection')).toBeDefined();

    // Parent vs Learner Engagement declared as unavailable
    expect(screen.getByText('Parent vs Learner Engagement')).toBeDefined();
    expect(screen.getByText(/Persona Engagement Separation Not Tracked/i)).toBeDefined();
  });

  it('supports date preset selection and tab switching to Account Roster', async () => {
    render(<AdminPortalModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Overview Dashboard')).toBeDefined();
    });

    // Date Presets
    const last7Btn = screen.getByText('Last 7 Days');
    fireEvent.click(last7Btn);
    expect(api.getAdminDashboard).toHaveBeenCalled();

    // Tab Switch
    const rosterTab = screen.getByText(/Account Roster/i);
    fireEvent.click(rosterTab);

    // User roster should now be visible
    expect(screen.getByText('Super Admin')).toBeDefined();
    expect(screen.getByText('admin@careercompass.ai')).toBeDefined();
    expect(screen.getByText('Priya Patel')).toBeDefined();
  });
});
