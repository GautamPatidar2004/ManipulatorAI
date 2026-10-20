import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminPortalModal } from '../components/Admin/AdminPortalModal';
import { api } from '../api/client';
import type {
  AdminDashboardResponse,
  PaginatedUsersResponse,
  UserDetailResponse,
  PaginatedEscalationsResponse,
} from '../types/auth';

const mockDashboardData: AdminDashboardResponse = {
  kpis: {
    total_registered_users: 25,
    active_users: 22,
    total_conversations: 40,
    pending_escalations: 1,
    pending_escalations_note: 'Active cases currently in pending triage state.',
    pending_escalations_available: true,
    collected_feedback_count: 15,
  },
  conversation_trends: [{ date: '2026-10-15', count: 5 }],
  engagement_by_persona: [],
  concern_categories: [],
  feedback_breakdown: { helpful: 10, unhelpful: 2, helpful_percentage: 83.3 },
  filters: {
    date_range_available: true,
    language_filter_available: false,
    language_note: 'Not stored',
    location_filter_available: false,
    location_note: 'Not stored',
    available_languages: [],
    available_locations: [],
  },
  data_sources: [],
  missing_metrics: [],
};

const mockUsersData: PaginatedUsersResponse = {
  items: [
    {
      id: 'usr-admin-1',
      email: 'admin@careercompass.ai',
      full_name: 'Lead Admin',
      role: 'admin',
      is_active: true,
      created_at: '2026-10-01T10:00:00Z',
      conversation_count: 5,
      feedback_count: 2,
      last_active_at: '2026-10-15T12:00:00Z',
    },
    {
      id: 'usr-student-2',
      email: 'student@example.com',
      full_name: 'Aarav Sharma',
      role: 'user',
      is_active: true,
      created_at: '2026-10-05T12:00:00Z',
      conversation_count: 2,
      feedback_count: 1,
      last_active_at: '2026-10-16T12:00:00Z',
    },
  ],
  users: [
    {
      id: 'usr-admin-1',
      email: 'admin@careercompass.ai',
      full_name: 'Lead Admin',
      role: 'admin',
      is_active: true,
      created_at: '2026-10-01T10:00:00Z',
      conversation_count: 5,
      feedback_count: 2,
      last_active_at: '2026-10-15T12:00:00Z',
    },
    {
      id: 'usr-student-2',
      email: 'student@example.com',
      full_name: 'Aarav Sharma',
      role: 'user',
      is_active: true,
      created_at: '2026-10-05T12:00:00Z',
      conversation_count: 2,
      feedback_count: 1,
      last_active_at: '2026-10-16T12:00:00Z',
    },
  ],
  total: 2,
  page: 1,
  limit: 10,
  total_pages: 1,
};

const mockUserDetail: UserDetailResponse = {
  user: {
    id: 'usr-student-2',
    email: 'student@example.com',
    full_name: 'Aarav Sharma',
    role: 'user',
    is_active: true,
    created_at: '2026-10-05T12:00:00Z',
  },
  conversations: [
    {
      id: 'conv-101',
      title: 'Exploring Engineering vs Design careers',
      created_at: '2026-10-06T12:00:00Z',
      updated_at: '2026-10-06T12:30:00Z',
      message_count: 6,
    },
  ],
  feedback: [
    {
      id: 'fb-201',
      conversation_id: 'conv-101',
      message_id: 'msg-1',
      rating: 'helpful',
      category: 'stream_selection',
      created_at: '2026-10-06T12:30:00Z',
    },
  ],
  active_memories_count: 2,
  escalation_cases_count: 1,
};

const mockEscalations: PaginatedEscalationsResponse = {
  items: [
    {
      id: 'case-001',
      conversation_id: 'conv-101',
      conversation_title: 'Engineering vs Design',
      user_id: 'usr-student-2',
      user_email: 'student@example.com',
      user_name: 'Aarav Sharma',
      trigger_type: 'complex_family_conflict',
      reason: 'Parent insists on engineering, student wants design',
      priority: 'high',
      status: 'pending',
      user_notes: 'Need human counsellor to facilitate family meeting',
      assigned_to: null,
      assigned_to_name: null,
      assigned_at: null,
      resolution_notes: null,
      resolved_at: null,
      created_at: '2026-10-15T09:00:00Z',
      updated_at: '2026-10-15T09:00:00Z',
    },
    {
      id: 'case-002',
      conversation_id: 'conv-102',
      conversation_title: 'Scholarship Advice',
      user_id: 'usr-student-3',
      user_email: 'parent@example.com',
      user_name: 'Sunita Verma',
      trigger_type: 'financial_feasibility',
      reason: 'Overseas scholarship financial risk',
      priority: 'medium',
      status: 'assigned',
      user_notes: null,
      assigned_to: 'usr-admin-1',
      assigned_to_name: 'Lead Admin',
      assigned_at: '2026-10-16T11:00:00Z',
      resolution_notes: null,
      resolved_at: null,
      created_at: '2026-10-15T10:00:00Z',
      updated_at: '2026-10-16T11:00:00Z',
    },
  ],
  total: 2,
  pending_count: 1,
  assigned_count: 1,
  in_progress_count: 0,
  resolved_count: 0,
  page: 1,
  limit: 15,
  total_pages: 1,
};

describe('Prompt 3: User Management and Counsellor Escalations Frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'getAdminDashboard').mockResolvedValue(mockDashboardData);
    vi.spyOn(api, 'getAdminUsers').mockResolvedValue(mockUsersData);
    vi.spyOn(api, 'getAdminUserDetail').mockResolvedValue(mockUserDetail);
    vi.spyOn(api, 'updateUserStatus').mockResolvedValue({
      id: 'usr-student-2',
      email: 'student@example.com',
      full_name: 'Aarav Sharma',
      role: 'user',
      is_active: false,
      created_at: '2026-10-05T12:00:00Z',
    });
    vi.spyOn(api, 'getAdminEscalations').mockResolvedValue(mockEscalations);
    vi.spyOn(api, 'updateEscalationCase').mockResolvedValue({
      ...mockEscalations.items[0],
      status: 'in_progress',
      assigned_to: 'usr-admin-1',
      assigned_to_name: 'Lead Admin',
    });
  });

  it('renders User Management roster and searches registered users', async () => {
    render(<AdminPortalModal isOpen={true} onClose={vi.fn()} initialTab="users" />);

    await waitFor(() => {
      expect(screen.getByText('Lead Admin')).toBeDefined();
    });

    expect(screen.getByText('Aarav Sharma')).toBeDefined();
    expect(screen.getByText('student@example.com')).toBeDefined();

    // Search input
    const searchInput = screen.getByPlaceholderText(/Search users by name or email/i);
    fireEvent.change(searchInput, { target: { value: 'Aarav' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(api.getAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'Aarav',
        })
      );
    });
  });

  it('inspects user details drawer and displays consultation and feedback history', async () => {
    render(<AdminPortalModal isOpen={true} onClose={vi.fn()} initialTab="users" />);

    await waitFor(() => {
      expect(screen.getByText('Aarav Sharma')).toBeDefined();
    });

    // Click inspect button for Aarav Sharma (second user row)
    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    fireEvent.click(inspectButtons[1]);

    await waitFor(() => {
      expect(api.getAdminUserDetail).toHaveBeenCalledWith('usr-student-2');
    });

    // Check inspection drawer contents
    await waitFor(() => {
      expect(screen.getByText(/User Audit & Activity/i)).toBeDefined();
      expect(screen.getByText(/Exploring Engineering vs Design careers/i)).toBeDefined();
      expect(screen.getByText(/stream_selection/i)).toBeDefined();
    });
  });

  it('toggles user account activation securely', async () => {
    render(<AdminPortalModal isOpen={true} onClose={vi.fn()} initialTab="users" />);

    await waitFor(() => {
      expect(screen.getByText('Aarav Sharma')).toBeDefined();
    });

    // Click deactivate button on Aarav Sharma
    const deactivateButtons = screen.getAllByRole('button', { name: /Deactivate/i });
    fireEvent.click(deactivateButtons[1]);

    await waitFor(() => {
      expect(api.updateUserStatus).toHaveBeenCalledWith('usr-student-2', false);
    });
  });

  it('renders Counsellor Escalations queue with status counters and filters', async () => {
    render(<AdminPortalModal isOpen={true} onClose={vi.fn()} initialTab="escalations" />);

    await waitFor(() => {
      expect(screen.getByText(/Parent insists on engineering, student wants design/i)).toBeDefined();
    });

    // Verify case 2 in queue
    expect(screen.getByText(/Overseas scholarship financial risk/i)).toBeDefined();

    // Status counters
    expect(screen.getAllByText(/Pending/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Assigned/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/In Progress/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Resolved/i).length).toBeGreaterThanOrEqual(1);
  });

  it('allows opening triage drawer, assigning an authorized admin counsellor and saving resolution notes', async () => {
    render(<AdminPortalModal isOpen={true} onClose={vi.fn()} initialTab="escalations" />);

    await waitFor(() => {
      expect(screen.getByText(/Parent insists on engineering, student wants design/i)).toBeDefined();
    });

    // Click exact Triage button on first case row
    const triageButtons = screen.getAllByRole('button', { name: /^Triage$/i });
    fireEvent.click(triageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Counsellor Case Triage/i)).toBeDefined();
      expect(screen.getByText(/Need human counsellor to facilitate family meeting/i)).toBeDefined();
    });

    // Assign to Lead Admin (authorized admin)
    const assignSelect = screen.getByDisplayValue(/Unassigned/i);
    fireEvent.change(assignSelect, { target: { value: 'usr-admin-1' } });

    // Change status to in_progress
    const statusSelect = screen.getByDisplayValue('Pending');
    fireEvent.change(statusSelect, { target: { value: 'in_progress' } });

    // Enter resolution notes
    const notesArea = screen.getByPlaceholderText(/Add guidance notes/i);
    fireEvent.change(notesArea, {
      target: { value: 'Conducted family mediation session. Student enrolled in design bridge course.' },
    });

    // Click Save & Update Case
    const saveButton = screen.getByRole('button', { name: /Save & Update Case/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.updateEscalationCase).toHaveBeenCalledWith('case-001', {
        status: 'in_progress',
        priority: 'high',
        assigned_to: 'usr-admin-1',
        resolution_notes: 'Conducted family mediation session. Student enrolled in design bridge course.',
      });
    });
  });
});
