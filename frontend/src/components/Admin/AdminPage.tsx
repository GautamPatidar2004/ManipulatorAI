import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldAlert,
  Users,
  MessageSquare,
  ThumbsUp,
  RefreshCw,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Calendar,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  Filter,
  LifeBuoy,
  GraduationCap,
  Database,
  LineChart,
  Settings,
  ArrowLeft,
  Download,
  Plus,
  Trash2,
  ExternalLink,
  Edit2,
  Check,
  X,
  Menu,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type {
  AdminDashboardResponse,
  EscalationCaseBrief,
  UserDetailResponse,
  UserSummaryResponse,
  VerifiedOutcomeItem,
  KnowledgeSourceItem,
  KnowledgeQualityOverviewResponse,
  ProgrammeAnalyticsResponse,
} from '../../types/auth';

export type AdminSection =
  | 'overview'
  | 'users'
  | 'concerns'
  | 'escalations'
  | 'outcomes'
  | 'knowledge'
  | 'analytics'
  | 'settings';

interface AdminPageProps {
  onBackToChat: () => void;
  initialSection?: AdminSection;
}

type DatePreset = 'all' | '7d' | '30d' | 'custom';

export const AdminPage: React.FC<AdminPageProps> = ({
  onBackToChat,
  initialSection = 'overview',
}) => {
  const { user: currentAdmin, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSection>(initialSection);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Common UI State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Overview & Concerns State
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // User Management State
  const [userItems, setUserItems] = useState<UserSummaryResponse[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDetailResponse | null>(null);
  const [isLoadingUserDetail, setIsLoadingUserDetail] = useState(false);

  // Escalations State
  const [escalations, setEscalations] = useState<EscalationCaseBrief[]>([]);
  const [escTotal, setEscTotal] = useState(0);
  const [escPendingCount, setEscPendingCount] = useState(0);
  const [escAssignedCount, setEscAssignedCount] = useState(0);
  const [escInProgressCount, setEscInProgressCount] = useState(0);
  const [escResolvedCount, setEscResolvedCount] = useState(0);
  const [escPage, setEscPage] = useState(1);
  const [escTotalPages, setEscTotalPages] = useState(1);
  const [escStatusFilter, setEscStatusFilter] = useState<string>('');
  const [escPriorityFilter, setEscPriorityFilter] = useState<string>('');
  const [selectedCase, setSelectedCase] = useState<EscalationCaseBrief | null>(null);
  const [caseStatusEdit, setCaseStatusEdit] = useState<'pending' | 'assigned' | 'in_progress' | 'resolved'>('pending');
  const [casePriorityEdit, setCasePriorityEdit] = useState<'high' | 'medium' | 'low'>('medium');
  const [caseAssigneeEdit, setCaseAssigneeEdit] = useState<string>('');
  const [caseNotesEdit, setCaseNotesEdit] = useState<string>('');
  const [isUpdatingCase, setIsUpdatingCase] = useState(false);

  // Verified Trade Outcomes State
  const [outcomes, setOutcomes] = useState<VerifiedOutcomeItem[]>([]);
  const [outcomeTotal, setOutcomeTotal] = useState(0);
  const [outcomePage, setOutcomePage] = useState(1);
  const [outcomeTotalPages, setOutcomeTotalPages] = useState(1);
  const [outcomeTradeSearch, setOutcomeTradeSearch] = useState('');
  const [outcomeStatusFilter, setOutcomeStatusFilter] = useState('');
  const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState<VerifiedOutcomeItem | null>(null);
  const [outcomeForm, setOutcomeForm] = useState({
    trade: '',
    training_provider: '',
    location: '',
    nsqf_level: 'Level 4',
    placement_rate: 75,
    post_training_earnings_range: '₹18,000 - ₹28,000/mo',
    reporting_period: '2025-2026',
    sample_size: 150,
    progression_pathways: '',
    source_url: '',
    verification_status: 'verified' as 'verified' | 'unverified' | 'pending_review',
    notes: '',
  });

  // Knowledge Base State
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeQualityOverviewResponse | null>(null);

  // Programme Analytics State
  const [analyticsData, setAnalyticsData] = useState<ProgrammeAnalyticsResponse | null>(null);

  // Compute active start & end dates
  const { queryStartDate, queryEndDate } = useMemo(() => {
    const now = new Date();
    if (datePreset === '7d') {
      const past7 = new Date();
      past7.setDate(now.getDate() - 7);
      return {
        queryStartDate: past7.toISOString().split('T')[0],
        queryEndDate: now.toISOString().split('T')[0],
      };
    }
    if (datePreset === '30d') {
      const past30 = new Date();
      past30.setDate(now.getDate() - 30);
      return {
        queryStartDate: past30.toISOString().split('T')[0],
        queryEndDate: now.toISOString().split('T')[0],
      };
    }
    if (datePreset === 'custom') {
      return {
        queryStartDate: customStartDate || undefined,
        queryEndDate: customEndDate || undefined,
      };
    }
    return { queryStartDate: undefined, queryEndDate: undefined };
  }, [datePreset, customStartDate, customEndDate]);

  // Fetch functions
  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dashData, usersData] = await Promise.all([
        api.getAdminDashboard({
          start_date: queryStartDate,
          end_date: queryEndDate,
        }),
        api.getAdminUsers({ page: 1, limit: 10 }).catch(() => null),
      ]);
      setDashboard(dashData);
      if (usersData) {
        setUserItems(usersData.items || (usersData as any).users || []);
        setUserTotal(usersData.total || 0);
        setUserTotalPages(usersData.total_pages || 1);
      }
    } catch {
      setError('Failed to load administrator dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const isActParam = userStatusFilter === 'all' ? undefined : userStatusFilter === 'active';
      const roleParam = userRoleFilter === 'all' ? undefined : userRoleFilter;
      const data = await api.getAdminUsers({
        q: userSearchQuery.trim() || undefined,
        role: roleParam,
        is_active: isActParam,
        page: userPage,
        limit: 10,
      });
      setUserItems(data.items || (data as any).users || []);
      setUserTotal(data.total || 0);
      setUserTotalPages(data.total_pages || 1);
    } catch {
      setError('Failed to retrieve user accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEscalations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, usersData] = await Promise.all([
        api.getAdminEscalations({
          status: escStatusFilter || undefined,
          priority: escPriorityFilter || undefined,
          page: escPage,
          limit: 15,
        }),
        userItems.length === 0 ? api.getAdminUsers({ limit: 50 }).catch(() => null) : Promise.resolve(null),
      ]);
      setEscalations(data.items);
      setEscTotal(data.total);
      setEscPendingCount(data.pending_count);
      setEscAssignedCount(data.assigned_count);
      setEscInProgressCount(data.in_progress_count);
      setEscResolvedCount(data.resolved_count);
      setEscTotalPages(data.total_pages);
      if (usersData) {
        setUserItems(usersData.items || (usersData as any).users || []);
      }
    } catch {
      setError('Failed to retrieve counsellor escalation cases.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOutcomes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getAdminOutcomes({
        trade: outcomeTradeSearch.trim() || undefined,
        verification_status: outcomeStatusFilter || undefined,
        page: outcomePage,
        limit: 10,
      });
      setOutcomes(data.items);
      setOutcomeTotal(data.total);
      setOutcomeTotalPages(data.total_pages);
    } catch {
      setError('Failed to retrieve verified vocational outcome benchmarks.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKnowledge = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getAdminKnowledgeSources();
      setKnowledgeData(data);
    } catch {
      setError('Failed to retrieve knowledge quality overview.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getAdminProgrammeAnalytics({
        start_date: queryStartDate,
        end_date: queryEndDate,
      });
      setAnalyticsData(data);
    } catch {
      setError('Failed to retrieve programme analytics and outcome shift metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  // Section switch effect
  useEffect(() => {
    if (activeSection === 'overview' || activeSection === 'concerns') {
      fetchDashboardData();
    } else if (activeSection === 'users') {
      fetchUsers();
    } else if (activeSection === 'escalations') {
      fetchEscalations();
    } else if (activeSection === 'outcomes') {
      fetchOutcomes();
    } else if (activeSection === 'knowledge') {
      fetchKnowledge();
    } else if (activeSection === 'analytics') {
      fetchAnalytics();
    }
  }, [activeSection]);

  // Reload when filters change
  useEffect(() => {
    if (activeSection === 'overview' || activeSection === 'concerns') {
      fetchDashboardData();
    }
  }, [queryStartDate, queryEndDate]);

  useEffect(() => {
    if (activeSection === 'users') {
      fetchUsers();
    }
  }, [userPage, userStatusFilter, userRoleFilter]);

  useEffect(() => {
    if (activeSection === 'escalations') {
      fetchEscalations();
    }
  }, [escPage, escStatusFilter, escPriorityFilter]);

  useEffect(() => {
    if (activeSection === 'outcomes') {
      fetchOutcomes();
    }
  }, [outcomePage, outcomeStatusFilter]);

  // Handle user inspect
  const handleInspectUser = async (userId: string) => {
    setIsLoadingUserDetail(true);
    setError(null);
    try {
      const detail = await api.getAdminUserDetail(userId);
      setSelectedUserDetail(detail);
    } catch {
      setError('Failed to load detailed profile and conversation history for this user.');
    } finally {
      setIsLoadingUserDetail(false);
    }
  };

  // Handle user status toggle
  const handleToggleUserStatus = async (user: UserSummaryResponse) => {
    const nextStatus = !user.is_active;
    const actionLabel = nextStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} account "${user.email}"?`)) {
      return;
    }
    try {
      await api.updateUserStatus(user.id, nextStatus);
      setSuccessMessage(`Account ${user.email} successfully ${nextStatus ? 'activated' : 'deactivated'}.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchUsers();
      if (selectedUserDetail && selectedUserDetail.user.id === user.id) {
        setSelectedUserDetail({
          ...selectedUserDetail,
          user: { ...selectedUserDetail.user, is_active: nextStatus },
        });
      }
    } catch {
      setError(`Failed to update account status for ${user.email}.`);
    }
  };

  // Handle escalation triage save
  const handleSaveEscalation = async () => {
    if (!selectedCase) return;
    setIsUpdatingCase(true);
    setError(null);
    try {
      const updated = await api.updateEscalationCase(selectedCase.id, {
        status: caseStatusEdit,
        priority: casePriorityEdit,
        assigned_to: caseAssigneeEdit ? caseAssigneeEdit : null,
        resolution_notes: caseNotesEdit ? caseNotesEdit : null,
      });
      setSelectedCase(updated);
      setSuccessMessage(`Escalation case updated successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchEscalations();
    } catch {
      setError('Failed to update escalation case.');
    } finally {
      setIsUpdatingCase(false);
    }
  };

  // Handle outcome save
  const handleSaveOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (editingOutcome) {
        await api.updateAdminOutcome(editingOutcome.id, outcomeForm);
        setSuccessMessage('Trade outcome benchmark updated.');
      } else {
        await api.createAdminOutcome(outcomeForm);
        setSuccessMessage('New trade outcome benchmark created.');
      }
      setIsOutcomeModalOpen(false);
      setEditingOutcome(null);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchOutcomes();
    } catch {
      setError('Failed to save trade outcome. Please ensure source URL is valid.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle outcome delete
  const handleDeleteOutcome = async (outcome: VerifiedOutcomeItem) => {
    if (!window.confirm(`Delete outcome record for "${outcome.trade}"?`)) return;
    try {
      await api.deleteAdminOutcome(outcome.id);
      setSuccessMessage('Outcome record deleted.');
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchOutcomes();
    } catch {
      setError('Failed to delete outcome record.');
    }
  };

  // Handle knowledge source delete
  const handleDeleteSource = async (source: KnowledgeSourceItem) => {
    if (!window.confirm(`Remove knowledge source "${source.source_title}" and all associated embeddings?`)) return;
    try {
      await api.deleteAdminKnowledgeSource(source.source_id);
      setSuccessMessage(`Knowledge source ${source.source_id} removed.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchKnowledge();
    } catch {
      setError('Failed to delete knowledge source.');
    }
  };

  // Section titles and descriptions
  const sectionMeta: Record<AdminSection, { title: string; subtitle: string }> = {
    overview: {
      title: 'Administrator Overview Dashboard',
      subtitle: 'System-wide consultation telemetry, engagement metrics & quick triage',
    },
    users: {
      title: 'User Management & Governance',
      subtitle: 'Registered accounts, authentication status, dialogue histories & safety audit',
    },
    concerns: {
      title: 'Family Concerns & Sentiment Analysis',
      subtitle: 'Vocational anxiety indicators across income, security, dignity & education',
    },
    escalations: {
      title: 'Counsellor Escalation Queue',
      subtitle: 'Critical student triage, parent friction cases & human-in-the-loop handoffs',
    },
    outcomes: {
      title: 'Verified Trade Outcomes Management',
      subtitle: 'Vocational salary benchmarks, NSQF standards & verified institutional evidence',
    },
    knowledge: {
      title: 'Knowledge Base & Retrieval Quality',
      subtitle: 'Neon pgvector chunks, embedding sources & provenance management',
    },
    analytics: {
      title: 'Programme Analytics & Outcome Shifts',
      subtitle: 'Pre vs post counselling progression, resolution efficacy & research exports',
    },
    settings: {
      title: 'Admin Governance & System Configuration',
      subtitle: 'Database connection, vector configuration & active administrative session',
    },
  };

  const maxTrendCount = useMemo(() => {
    if (!dashboard?.conversation_trends || dashboard.conversation_trends.length === 0) return 1;
    return Math.max(...dashboard.conversation_trends.map((t) => t.count), 1);
  }, [dashboard]);

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* ------------------------------------------------------------------- */}
      {/* PERSISTENT LEFT SIDEBAR */}
      {/* ------------------------------------------------------------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-200 md:static md:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand & Portal Label */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/30 text-purple-400 border border-purple-500/40 flex items-center justify-center font-bold">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight leading-tight">
                CareerCompass AI
              </div>
              <div className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">
                Admin Panel
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs" aria-label="Admin Navigation">
          {/* 1. Overview */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('overview');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
              activeSection === 'overview'
                ? 'bg-purple-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BarChart3 size={16} />
              <span>Overview</span>
            </div>
          </button>

          {/* 2. Users */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('users');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
              activeSection === 'users'
                ? 'bg-purple-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users size={16} />
              <span>Users</span>
            </div>
            {userTotal > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-slate-800 text-slate-300">
                {userTotal}
              </span>
            )}
          </button>

          {/* 3. Family Concerns & Sentiment */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('concerns');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
              activeSection === 'concerns'
                ? 'bg-purple-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Layers size={16} />
              <span>Family Concerns & Sentiment</span>
            </div>
          </button>

          {/* 4. Counsellor Escalations */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('escalations');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
              activeSection === 'escalations'
                ? 'bg-purple-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LifeBuoy size={16} />
              <span>Counsellor Escalations</span>
            </div>
            {escPendingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {escPendingCount}
              </span>
            )}
          </button>

          {/* 5. Verified Trade Outcomes */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('outcomes');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
              activeSection === 'outcomes'
                ? 'bg-purple-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <GraduationCap size={16} />
              <span>Verified Trade Outcomes</span>
            </div>
            {outcomeTotal > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-slate-800 text-slate-300">
                {outcomeTotal}
              </span>
            )}
          </button>

          {/* 6. Knowledge Base */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('knowledge');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
              activeSection === 'knowledge'
                ? 'bg-purple-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Database size={16} />
              <span>Knowledge Base</span>
            </div>
          </button>

          {/* 7. Programme Analytics */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('analytics');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
              activeSection === 'analytics'
                ? 'bg-purple-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LineChart size={16} />
              <span>Programme Analytics</span>
            </div>
          </button>

          {/* 8. Settings */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('settings');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
              activeSection === 'settings'
                ? 'bg-purple-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Settings size={16} />
              <span>Settings</span>
            </div>
          </button>
        </nav>

        {/* Sidebar Footer: Current Admin & Session Info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-purple-700/40 text-purple-300 border border-purple-500/40 flex items-center justify-center font-bold text-xs shrink-0">
              {currentAdmin?.full_name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate">
                {currentAdmin?.full_name || 'Administrator'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {currentAdmin?.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Sign out of Admin Session"
            aria-label="Logout"
          >
            <X size={15} />
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-30 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MAIN LAYOUT AREA */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* TOP HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open sidebar"
            >
              <Menu size={18} />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {sectionMeta[activeSection].title}
              </h1>
              <p className="hidden sm:block text-xs text-slate-500 leading-tight">
                {sectionMeta[activeSection].subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Refresh Action */}
            <button
              type="button"
              onClick={() => {
                if (activeSection === 'overview' || activeSection === 'concerns') fetchDashboardData();
                else if (activeSection === 'users') fetchUsers();
                else if (activeSection === 'escalations') fetchEscalations();
                else if (activeSection === 'outcomes') fetchOutcomes();
                else if (activeSection === 'knowledge') fetchKnowledge();
                else if (activeSection === 'analytics') fetchAnalytics();
              }}
              disabled={isLoading}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
              title="Refresh Section Data"
              aria-label="Refresh view"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin text-purple-600' : ''} />
            </button>

            {/* Admin Identity Pill */}
            {currentAdmin && (
              <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-purple-50 border border-purple-200/80 rounded-lg text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-purple-900">{currentAdmin.full_name}</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider bg-purple-200/80 text-purple-900 rounded">
                  Admin
                </span>
              </div>
            )}

            {/* MANDATORY: BACK TO CHAT BUTTON */}
            <button
              type="button"
              onClick={onBackToChat}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Return to Consultation Workspace"
            >
              <ArrowLeft size={14} />
              <span>Back to Chat</span>
            </button>
          </div>
        </header>

        {/* SCROLLABLE MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Notifications */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 text-xs text-red-700">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* =============================================================== */}
          {/* 1. OVERVIEW SECTION */}
          {/* =============================================================== */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Date Filters Bar */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">Date Range Filter:</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setDatePreset('all')}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        datePreset === 'all'
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      All Time
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('7d')}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        datePreset === '7d'
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Last 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('30d')}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        datePreset === '30d'
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Last 30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('custom')}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        datePreset === 'custom'
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Custom Dates
                    </button>
                  </div>
                </div>

                {datePreset === 'custom' && (
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="overview-start-date" className="text-[11px] font-semibold text-slate-500">From:</label>
                      <input
                        id="overview-start-date"
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="overview-end-date" className="text-[11px] font-semibold text-slate-500">To:</label>
                      <input
                        id="overview-end-date"
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 5 KPI Cards */}
              {dashboard && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                      <span>Total Users</span>
                      <Users size={16} className="text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {dashboard.kpis.total_registered_users}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Registered accounts</div>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                      <span>Active Users</span>
                      <Sparkles size={16} className="text-emerald-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {dashboard.kpis.active_users}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Engaged in consultations</div>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                      <span>Consultations</span>
                      <MessageSquare size={16} className="text-indigo-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {dashboard.kpis.total_conversations}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Dialogue threads</div>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                      <span>Pending Escalations</span>
                      <LifeBuoy size={16} className="text-amber-600" />
                    </div>
                    <div className="text-2xl font-bold text-amber-700">
                      {dashboard.kpis.pending_escalations ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {dashboard.kpis.pending_escalations_note}
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                      <span>Feedback Reviews</span>
                      <ThumbsUp size={16} className="text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {dashboard.kpis.collected_feedback_count}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {dashboard.feedback_breakdown.helpful_percentage !== null
                        ? `${dashboard.feedback_breakdown.helpful_percentage}% Helpful`
                        : 'No reviews yet'}
                    </div>
                  </div>
                </div>
              )}

              {/* Conversation Trends Graph */}
              {dashboard && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <TrendingUp size={15} className="text-indigo-600" />
                        <span>Consultation Dialogue Volume Over Time</span>
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Daily counselling sessions initiated across the platform
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {dashboard.conversation_trends.length} recorded dates
                    </span>
                  </div>

                  {dashboard.conversation_trends.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No conversations recorded in this date range.</p>
                    </div>
                  ) : (
                    <div className="pt-4">
                      <div className="flex items-end gap-2 h-40 pt-4 px-2 border-b border-slate-200 overflow-x-auto">
                        {dashboard.conversation_trends.map((t) => {
                          const heightPct = Math.max(12, Math.round((t.count / maxTrendCount) * 100));
                          return (
                            <div
                              key={t.date}
                              className="flex-1 min-w-[32px] max-w-[52px] flex flex-col items-center gap-1 group"
                            >
                              <span className="text-[10px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">
                                {t.count}
                              </span>
                              <div
                                style={{ height: `${heightPct}%` }}
                                className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm group-hover:from-indigo-500 group-hover:to-indigo-300 transition-all shadow-2xs"
                                title={`${t.date}: ${t.count} conversation(s)`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 px-2 pt-1 font-mono">
                        <span>{dashboard.conversation_trends[0]?.date}</span>
                        <span>{dashboard.conversation_trends[dashboard.conversation_trends.length - 1]?.date}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* 2. USERS SECTION */}
          {/* =============================================================== */}
          {activeSection === 'users' && (
            <div className="space-y-4">
              {/* Controls Bar */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
                  <div className="relative w-full">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search accounts by name or email..."
                      value={userSearchQuery}
                      onChange={(e) => {
                        setUserSearchQuery(e.target.value);
                        setUserPage(1);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-purple-500 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUserPage(1);
                      fetchUsers();
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer"
                  >
                    Search
                  </button>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Filter size={14} className="text-slate-500" />
                    <span className="text-slate-500">Role:</span>
                    <select
                      value={userRoleFilter}
                      onChange={(e) => {
                        setUserRoleFilter(e.target.value as any);
                        setUserPage(1);
                      }}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="all">All Roles</option>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500">Status:</span>
                    <select
                      value={userStatusFilter}
                      onChange={(e) => {
                        setUserStatusFilter(e.target.value as any);
                        setUserPage(1);
                      }}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Registered Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {userItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No user accounts matching the filter criteria.
                          </td>
                        </tr>
                      ) : (
                        userItems.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">{u.full_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  u.role === 'admin'
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  u.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => handleInspectUser(u.id)}
                                className="px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-50 rounded border border-purple-200 transition-colors cursor-pointer"
                                title="Inspect user profile and conversations"
                              >
                                Inspect
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u)}
                                className={`px-2 py-1 text-xs font-semibold rounded border transition-colors cursor-pointer ${
                                  u.is_active
                                    ? 'text-rose-700 border-rose-200 hover:bg-rose-50'
                                    : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                                }`}
                              >
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {userTotalPages > 1 && (
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <div>
                      Page <span className="font-semibold">{userPage}</span> of <span className="font-semibold">{userTotalPages}</span> ({userTotal} total accounts)
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={userPage <= 1}
                        onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={userPage >= userTotalPages}
                        onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* User Inspection Drawer Modal */}
              {selectedUserDetail && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end">
                  <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">User Audit & History</h3>
                        <p className="text-[11px] text-slate-500 font-mono">{selectedUserDetail.user.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedUserDetail(null)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                      {isLoadingUserDetail ? (
                        <div className="p-8 text-center text-slate-400">
                          <RefreshCw size={20} className="animate-spin text-purple-600 mx-auto mb-2" />
                          <span>Loading profile and consultation history...</span>
                        </div>
                      ) : (
                        <>
                          {/* Overview Card */}
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-sm">{selectedUserDetail.user.full_name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800">
                            {selectedUserDetail.user.role}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] border-t border-slate-200">
                          <div>
                            <span className="text-slate-400 block">Status:</span>
                            <span className={selectedUserDetail.user.is_active ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                              {selectedUserDetail.user.is_active ? 'Active Account' : 'Deactivated'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Registered:</span>
                            <span className="text-slate-700">{new Date(selectedUserDetail.user.created_at).toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Active Memories:</span>
                            <span className="text-slate-700 font-semibold">{selectedUserDetail.active_memories_count} items</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Escalations:</span>
                            <span className="text-slate-700 font-semibold">{selectedUserDetail.escalation_cases_count} cases</span>
                          </div>
                        </div>
                      </div>

                      {/* Consultations List */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 mb-2">Past Consultations ({selectedUserDetail.conversations.length})</h4>
                        {selectedUserDetail.conversations.length === 0 ? (
                          <p className="text-slate-400 text-[11px] italic">No consultations initiated by this user yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {selectedUserDetail.conversations.map((c) => (
                              <div key={c.id} className="p-2.5 bg-white border border-slate-200 rounded-lg">
                                <div className="font-semibold text-slate-800">{c.title}</div>
                                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                                  <span>{c.message_count} messages</span>
                                  <span>{new Date(c.updated_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Feedback List */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 mb-2">Submitted Feedback ({selectedUserDetail.feedback.length})</h4>
                        {selectedUserDetail.feedback.length === 0 ? (
                          <p className="text-slate-400 text-[11px] italic">No feedback submissions on record.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {selectedUserDetail.feedback.map((f) => (
                              <div key={f.id} className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  f.rating === 'helpful' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {f.rating.toUpperCase()}
                                </span>
                                <span className="text-[10px] text-slate-400">{new Date(f.created_at).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* 3. FAMILY CONCERNS & SENTIMENT SECTION */}
          {/* =============================================================== */}
          {activeSection === 'concerns' && dashboard && (
            <div className="space-y-6">
              {/* Persona note */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Family Persona Architecture Note: </span>
                  Parent and student learners currently share the uniform <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">user</code> role.
                  Metrics below aggregate signals extracted from conversation turns and memory facts across all 5 core concern dimensions.
                </div>
              </div>

              {/* 5 Core Concern Categories Breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Layers size={16} className="text-purple-600" />
                      <span>Family & Student Vocational Concern Signals</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Distribution of vocational questions by anxiety categories
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {dashboard.concern_categories.map((c) => {
                    const totalSignals = dashboard.concern_categories.reduce((acc, curr) => acc + curr.count, 0) || 1;
                    const pct = Math.round((c.count / totalSignals) * 100);
                    return (
                      <div key={c.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{c.label}</span>
                          <div className="space-x-2">
                            <span className="font-mono text-slate-500">{c.count} signals</span>
                            <span className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{pct}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="bg-purple-600 h-full rounded-full transition-all duration-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sentiment & Feedback Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <ThumbsUp size={16} className="text-emerald-600" />
                    <span>Counselling Quality Sentiment</span>
                  </h3>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="text-3xl font-extrabold text-slate-900">
                      {dashboard.feedback_breakdown.helpful_percentage !== null
                        ? `${dashboard.feedback_breakdown.helpful_percentage}%`
                        : 'N/A'}
                    </div>
                    <div className="text-xs text-slate-500">
                      Helpful rating ratio from verified consultation feedback
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                      <div className="font-semibold text-emerald-800">Helpful Reviews</div>
                      <div className="text-lg font-bold text-emerald-700">{dashboard.feedback_breakdown.helpful}</div>
                    </div>
                    <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-100">
                      <div className="font-semibold text-rose-800">Unhelpful Reviews</div>
                      <div className="text-lg font-bold text-rose-700">{dashboard.feedback_breakdown.unhelpful}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-blue-600" />
                    <span>Signal Extraction Integrity</span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Concern classification runs automatically on student & parent messages.
                    Identified concerns trigger specialized evidentiary grounding modules (e.g. verified NSQF outcome benchmarks for salary hesitation).
                  </p>
                  <div className="pt-2 text-[11px] text-slate-400">
                    Source: Neon Lakebase DB dialogue memory & feedback tables.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* 4. COUNSELLOR ESCALATIONS SECTION */}
          {/* =============================================================== */}
          {activeSection === 'escalations' && (
            <div className="space-y-4">
              {/* Status Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-white border border-amber-200 rounded-xl shadow-2xs">
                  <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Pending Triage</div>
                  <div className="text-2xl font-bold text-amber-800 mt-1">{escPendingCount}</div>
                </div>
                <div className="p-3.5 bg-white border border-blue-200 rounded-xl shadow-2xs">
                  <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Assigned</div>
                  <div className="text-2xl font-bold text-blue-800 mt-1">{escAssignedCount}</div>
                </div>
                <div className="p-3.5 bg-white border border-indigo-200 rounded-xl shadow-2xs">
                  <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">In Progress</div>
                  <div className="text-2xl font-bold text-indigo-800 mt-1">{escInProgressCount}</div>
                </div>
                <div className="p-3.5 bg-white border border-emerald-200 rounded-xl shadow-2xs">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Resolved</div>
                  <div className="text-2xl font-bold text-emerald-800 mt-1">{escResolvedCount}</div>
                </div>
              </div>

              {/* Filter Controls */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-semibold">Status:</span>
                    <select
                      value={escStatusFilter}
                      onChange={(e) => {
                        setEscStatusFilter(e.target.value);
                        setEscPage(1);
                      }}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-semibold">Priority:</span>
                    <select
                      value={escPriorityFilter}
                      onChange={(e) => {
                        setEscPriorityFilter(e.target.value);
                        setEscPage(1);
                      }}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">All Priorities</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-semibold">
                  {escTotal} Total Escalations
                </div>
              </div>

              {/* Escalations Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Status & Priority</th>
                        <th className="py-3 px-4">Reason / Trigger</th>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Assigned Counsellor</th>
                        <th className="py-3 px-4">Created Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {escalations.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No escalation cases matching criteria.
                          </td>
                        </tr>
                      ) : (
                        escalations.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 space-y-1">
                              <div>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    c.status === 'pending'
                                      ? 'bg-amber-100 text-amber-800'
                                      : c.status === 'assigned'
                                      ? 'bg-blue-100 text-blue-800'
                                      : c.status === 'in_progress'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {c.status.replace('_', ' ')}
                                </span>
                              </div>
                              <div>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                    c.priority === 'high'
                                      ? 'bg-rose-100 text-rose-800'
                                      : c.priority === 'medium'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {c.priority} Priority
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 max-w-xs">
                              <div className="font-semibold text-slate-900 truncate">{c.reason}</div>
                              <div className="text-[10px] text-slate-400 truncate">Trigger: {c.trigger_type}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-900">{c.user_name || 'Anonymous User'}</div>
                              <div className="text-[10px] text-slate-400">{c.user_email}</div>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {c.assigned_to_name ? (
                                <span className="font-semibold text-purple-700">{c.assigned_to_name}</span>
                              ) : (
                                <span className="text-slate-400 italic">Unassigned</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {new Date(c.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCase(c);
                                  setCaseStatusEdit(c.status);
                                  setCasePriorityEdit(c.priority);
                                  setCaseAssigneeEdit(c.assigned_to || '');
                                  setCaseNotesEdit(c.resolution_notes || '');
                                }}
                                className="px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-50 rounded border border-purple-200 transition-colors cursor-pointer"
                              >
                                Triage
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {escTotalPages > 1 && (
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <div>
                      Page <span className="font-semibold">{escPage}</span> of <span className="font-semibold">{escTotalPages}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={escPage <= 1}
                        onClick={() => setEscPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={escPage >= escTotalPages}
                        onClick={() => setEscPage((p) => Math.min(escTotalPages, p + 1))}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Case Triage Modal */}
              {selectedCase && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Counsellor Escalation Triage</h3>
                        <p className="text-[11px] text-slate-500">Case ID: {selectedCase.id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCase(null)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <div className="text-[10px] font-bold uppercase text-slate-500">Reason for Escalation</div>
                        <div className="font-semibold text-slate-800">{selectedCase.reason}</div>
                        {selectedCase.user_notes && (
                          <div className="text-slate-600 text-[11px] pt-1 border-t border-slate-200">
                            User Note: {selectedCase.user_notes}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Status</label>
                          <select
                            value={caseStatusEdit}
                            onChange={(e) => setCaseStatusEdit(e.target.value as any)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                          >
                            <option value="pending">Pending</option>
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Priority</label>
                          <select
                            value={casePriorityEdit}
                            onChange={(e) => setCasePriorityEdit(e.target.value as any)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Assigned Counsellor (Admin User ID)</label>
                        <input
                          type="text"
                          placeholder="Admin user ID or leave blank to assign self"
                          value={caseAssigneeEdit}
                          onChange={(e) => setCaseAssigneeEdit(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono text-[11px]"
                        />
                        {currentAdmin && (
                          <button
                            type="button"
                            onClick={() => setCaseAssigneeEdit(currentAdmin.id)}
                            className="mt-1 text-[11px] text-purple-700 hover:underline"
                          >
                            Assign to Myself ({currentAdmin.full_name})
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Resolution & Case Notes</label>
                        <textarea
                          rows={3}
                          placeholder="Document counselling resolution, parent communication, or follow-up actions..."
                          value={caseNotesEdit}
                          onChange={(e) => setCaseNotesEdit(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setSelectedCase(null)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingCase}
                        onClick={handleSaveEscalation}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {isUpdatingCase ? 'Saving...' : 'Save Triage Update'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* 5. VERIFIED TRADE OUTCOMES SECTION */}
          {/* =============================================================== */}
          {activeSection === 'outcomes' && (
            <div className="space-y-4">
              {/* Header Controls Bar */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
                  <div className="relative w-full">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search trade (e.g. Electrician, CNC Operator)..."
                      value={outcomeTradeSearch}
                      onChange={(e) => {
                        setOutcomeTradeSearch(e.target.value);
                        setOutcomePage(1);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && fetchOutcomes()}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOutcomePage(1);
                      fetchOutcomes();
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Search
                  </button>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500">Status:</span>
                    <select
                      value={outcomeStatusFilter}
                      onChange={(e) => {
                        setOutcomeStatusFilter(e.target.value);
                        setOutcomePage(1);
                      }}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">All Verification Statuses</option>
                      <option value="verified">Verified Only</option>
                      <option value="pending_review">Pending Review</option>
                      <option value="unverified">Unverified</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingOutcome(null);
                      setOutcomeForm({
                        trade: '',
                        training_provider: '',
                        location: '',
                        nsqf_level: 'Level 4',
                        placement_rate: 75,
                        post_training_earnings_range: '₹18,000 - ₹28,000/mo',
                        reporting_period: '2025-2026',
                        sample_size: 150,
                        progression_pathways: '',
                        source_url: '',
                        verification_status: 'verified',
                        notes: '',
                      });
                      setIsOutcomeModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus size={14} />
                    <span>Add Trade Benchmark</span>
                  </button>
                </div>
              </div>

              {/* Outcomes Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Trade & Provider</th>
                        <th className="py-3 px-4">NSQF Level & Location</th>
                        <th className="py-3 px-4">Placement Rate</th>
                        <th className="py-3 px-4">Earnings Range</th>
                        <th className="py-3 px-4">Verification</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {outcomes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No verified trade outcomes found. Click "Add Trade Benchmark" to create one.
                          </td>
                        </tr>
                      ) : (
                        outcomes.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">{o.trade}</div>
                              <div className="text-[11px] text-slate-400">{o.training_provider}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-800">{o.nsqf_level}</div>
                              <div className="text-[10px] text-slate-400">{o.location}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-800">{o.placement_rate}%</span>
                              <span className="text-[10px] text-slate-400 block font-mono">N={o.sample_size}</span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {o.post_training_earnings_range}
                            </td>
                            <td className="py-3 px-4 space-y-1">
                              <div>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    o.verification_status === 'verified'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : o.verification_status === 'pending_review'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {o.verification_status.replace('_', ' ')}
                                </span>
                              </div>
                              {o.source_url && (
                                <a
                                  href={o.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                                >
                                  <span>Provenance</span>
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingOutcome(o);
                                  setOutcomeForm({
                                    trade: o.trade,
                                    training_provider: o.training_provider,
                                    location: o.location,
                                    nsqf_level: o.nsqf_level,
                                    placement_rate: o.placement_rate,
                                    post_training_earnings_range: o.post_training_earnings_range,
                                    reporting_period: o.reporting_period,
                                    sample_size: o.sample_size,
                                    progression_pathways: o.progression_pathways || '',
                                    source_url: o.source_url,
                                    verification_status: o.verification_status,
                                    notes: o.notes || '',
                                  });
                                  setIsOutcomeModalOpen(true);
                                }}
                                className="p-1 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded"
                                title="Edit outcome record"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOutcome(o)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                title="Delete outcome record"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {outcomeTotalPages > 1 && (
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <div>
                      Page <span className="font-semibold">{outcomePage}</span> of <span className="font-semibold">{outcomeTotalPages}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={outcomePage <= 1}
                        onClick={() => setOutcomePage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={outcomePage >= outcomeTotalPages}
                        onClick={() => setOutcomePage((p) => Math.min(outcomeTotalPages, p + 1))}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Add/Edit Outcome Modal */}
              {isOutcomeModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {editingOutcome ? 'Edit Trade Outcome Benchmark' : 'Add Verified Trade Outcome'}
                        </h3>
                        <p className="text-[11px] text-slate-500">NSQF benchmark data for vocational counselling</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsOutcomeModalOpen(false)}
                        className="p-1 text-slate-400 hover:text-slate-700"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleSaveOutcome} className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Trade Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Electrician"
                            value={outcomeForm.trade}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, trade: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Training Provider *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Government ITI / NSTI"
                            value={outcomeForm.training_provider}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, training_provider: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Location *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Maharashtra"
                            value={outcomeForm.location}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, location: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">NSQF Level *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Level 4"
                            value={outcomeForm.nsqf_level}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, nsqf_level: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Placement Rate (%) *</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            required
                            value={outcomeForm.placement_rate}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, placement_rate: Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Post-Training Earnings *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. ₹18,000 - ₹28,000/mo"
                            value={outcomeForm.post_training_earnings_range}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, post_training_earnings_range: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Reporting Period *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 2025-2026"
                            value={outcomeForm.reporting_period}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, reporting_period: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Source URL (Provenance) *</label>
                        <input
                          type="url"
                          required
                          placeholder="https://msde.gov.in/reports/2026"
                          value={outcomeForm.source_url}
                          onChange={(e) => setOutcomeForm({ ...outcomeForm, source_url: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono text-[11px]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Verification Status</label>
                          <select
                            value={outcomeForm.verification_status}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, verification_status: e.target.value as any })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                          >
                            <option value="verified">Verified</option>
                            <option value="pending_review">Pending Review</option>
                            <option value="unverified">Unverified</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Sample Size (Cohort)</label>
                          <input
                            type="number"
                            min="1"
                            value={outcomeForm.sample_size}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, sample_size: Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Progression Pathways (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Junior Technician -> Plant Supervisor -> Diploma"
                          value={outcomeForm.progression_pathways}
                          onChange={(e) => setOutcomeForm({ ...outcomeForm, progression_pathways: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setIsOutcomeModalOpen(false)}
                          className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-xs"
                        >
                          Save Outcome
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* 6. KNOWLEDGE BASE SECTION */}
          {/* =============================================================== */}
          {activeSection === 'knowledge' && (
            <div className="space-y-6">
              {/* RAG Quality Overview */}
              {knowledgeData && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="text-slate-500 text-xs font-semibold">Total Knowledge Chunks</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{knowledgeData.total_chunks}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Stored in Neon PostgreSQL pgvector</div>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="text-slate-500 text-xs font-semibold">Active Knowledge Sources</div>
                    <div className="text-2xl font-bold text-purple-700 mt-1">{knowledgeData.total_sources}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Curated vocational documents</div>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="text-slate-500 text-xs font-semibold">Embedding Dimensions</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">1,536</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{knowledgeData.embedding_model}</div>
                  </div>
                </div>
              )}

              {/* Ingestion Pipeline Reference */}
              <div className="p-4 bg-slate-900 text-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Database size={15} className="text-purple-400" />
                    <span>Real Knowledge Ingestion CLI Workflow</span>
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-purple-950 text-purple-300 rounded border border-purple-800">
                    Production Ingestion
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Ingest validated vocational frameworks, NSQF curriculum guides, or institutional salary datasets using the automated chunking script:
                </p>
                <code className="block p-2.5 bg-slate-950 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto">
                  python backend/scripts/ingest_knowledge.py --source &lt;path-or-url&gt; --title "MSDE Trade Outcomes"
                </code>
              </div>

              {/* Knowledge Sources Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Indexed Knowledge Sources
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {knowledgeData?.sources.length || 0} sources registered
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Source Title</th>
                        <th className="py-3 px-4">Chunks</th>
                        <th className="py-3 px-4">Embedding Model</th>
                        <th className="py-3 px-4">Feedback Efficacy</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!knowledgeData || knowledgeData.sources.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No knowledge sources loaded yet.
                          </td>
                        </tr>
                      ) : (
                        knowledgeData.sources.map((s) => (
                          <tr key={s.source_id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">{s.source_title}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-xs">ID: {s.source_id}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                                {s.chunk_count} chunks
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                              {s.embedding_model} ({s.embedding_dim}d)
                            </td>
                            <td className="py-3 px-4 space-x-1.5">
                              <span className="text-emerald-700 font-semibold">{s.helpful_feedback_count} 👍</span>
                              <span className="text-slate-300">/</span>
                              <span className="text-rose-700 font-semibold">{s.unhelpful_feedback_count} 👎</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteSource(s)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                title="Remove knowledge source"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* 7. PROGRAMME ANALYTICS SECTION */}
          {/* =============================================================== */}
          {activeSection === 'analytics' && (
            <div className="space-y-6">
              {/* Analytics Header with CSV Export */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Programme-Level Consultation Analytics
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Measuring outcome shift and counselling resolution across cohort
                  </p>
                </div>

                <a
                  href={api.getAdminAnalyticsCsvUrl({
                    start_date: queryStartDate,
                    end_date: queryEndDate,
                  })}
                  download="careercompass_analytics_export.csv"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                >
                  <Download size={14} />
                  <span>Export Anonymized CSV</span>
                </a>
              </div>

              {/* KPI Summary */}
              {analyticsData && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="text-slate-500 text-xs font-semibold">Total Consultations Evaluated</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{analyticsData.total_consultations}</div>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="text-slate-500 text-xs font-semibold">Escalation Resolution Rate</div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">
                      {analyticsData.escalation_resolution_rate}%
                    </div>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="text-slate-500 text-xs font-semibold">Data Pipeline Verification</div>
                    <div className="text-sm font-semibold text-slate-800 mt-2 flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600" />
                      <span>Anonymized Research Safe</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pre vs Post Counselling Concern Progression */}
              {analyticsData && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Pre- vs Post-Counselling Concern Progression
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tracking shift in family concerns following evidentiary guidance
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Concern Category</th>
                          <th className="py-3 px-4">Initial Signals</th>
                          <th className="py-3 px-4">Resolved / Assisted Signals</th>
                          <th className="py-3 px-4">Outcome Shift</th>
                          <th className="py-3 px-4">Data Sufficiency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analyticsData.concern_shifts.map((s) => (
                          <tr key={s.category} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-900 capitalize">
                              {s.category}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">{s.initial_signals}</td>
                            <td className="py-3 px-4 font-mono text-emerald-700 font-semibold">
                              {s.resolved_or_assisted_signals}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                                +{s.shift_percentage}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[11px]">
                              {s.note}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* 8. SETTINGS SECTION (ONLY WHERE SUPPORTED) */}
          {/* =============================================================== */}
          {activeSection === 'settings' && (
            <div className="space-y-4 max-w-4xl">
              {/* Neon Connection Status */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database size={16} className="text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">Database Connection & Topology</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Connected
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Provider:</span>
                    <span className="font-semibold text-slate-800">Neon Lakebase Postgres (Serverless)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Branch:</span>
                    <span className="font-semibold text-slate-800">production (dry-star-64889587)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Pgvector Extension:</span>
                    <span className="font-semibold text-emerald-700">Enabled (vector index HNSW)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Alembic Schema Version:</span>
                    <span className="font-semibold text-slate-800">0007_add_verified_outcomes</span>
                  </div>
                </div>
              </div>

              {/* Embedding Model */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-600" />
                  <span className="text-xs font-bold text-slate-900">Embedding & RAG Model Topology</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Embedding Model:</span>
                    <span className="font-semibold text-slate-800">text-embedding-3-small</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Dimension:</span>
                    <span className="font-semibold text-slate-800">1,536 dimensions</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Similarity Metric:</span>
                    <span className="font-semibold text-slate-800">Cosine Distance (&lt;=&gt;)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">RAG Fallback Mode:</span>
                    <span className="font-semibold text-slate-800">Deterministic Vocational Evidence Fallback</span>
                  </div>
                </div>
              </div>

              {/* Security & RBAC Configuration */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-blue-600" />
                  <span className="text-xs font-bold text-slate-900">Role-Based Access Control (RBAC)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Strict 2-tier role enforcement: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">admin</code> and <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">user</code>.
                  Public signup grants <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">user</code> role server-side only. Admin endpoints enforce token inspection via FastAPI dependency injection.
                </p>
              </div>

              {/* Active Admin Session */}
              {currentAdmin && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Active Admin Session</span>
                    <button
                      type="button"
                      onClick={logout}
                      className="text-xs text-rose-700 hover:underline font-semibold"
                    >
                      Sign Out
                    </button>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div><span className="text-slate-400">Authenticated Name: </span><span className="font-semibold text-slate-800">{currentAdmin.full_name}</span></div>
                    <div><span className="text-slate-400">Email: </span><span className="font-mono text-slate-800">{currentAdmin.email}</span></div>
                    <div><span className="text-slate-400">Role: </span><span className="font-bold text-purple-700">{currentAdmin.role}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
