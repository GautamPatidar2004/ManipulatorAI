import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldAlert,
  Users,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  X,
  RefreshCw,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  UserCheck,
  Filter,
  Eye,
  FileText,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
} from 'lucide-react';
import { api } from '../../api/client';
import type {
  AdminDashboardResponse,
  EscalationCaseBrief,
  UserDetailResponse,
  UserSummaryResponse,
} from '../../types/auth';

interface AdminPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabType;
}

type TabType = 'overview' | 'users' | 'escalations';
type DatePreset = 'all' | '7d' | '30d' | 'custom';

export const AdminPortalModal: React.FC<AdminPortalModalProps> = ({ isOpen, onClose, initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter states for Dashboard
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

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

  // Escalation Management State
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

  // Fetch Dashboard Data
  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dashData, usersData] = await Promise.all([
        api.getAdminDashboard({
          start_date: queryStartDate,
          end_date: queryEndDate,
          language: selectedLanguage || undefined,
          location: selectedLocation || undefined,
        }),
        api.getAdminUsers({ page: userPage, limit: 10 }).catch(() => null),
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

  // Fetch Users
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

  // Fetch Escalations
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

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'overview') {
      fetchDashboardData();
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'escalations') {
      fetchEscalations();
    }
  }, [
    isOpen,
    activeTab,
    queryStartDate,
    queryEndDate,
    selectedLanguage,
    selectedLocation,
    userPage,
    userStatusFilter,
    userRoleFilter,
    escPage,
    escStatusFilter,
    escPriorityFilter,
  ]);

  // Load User Details
  const handleOpenUserDetail = async (userId: string) => {
    setIsLoadingUserDetail(true);
    try {
      const detail = await api.getAdminUserDetail(userId);
      setSelectedUserDetail(detail);
    } catch {
      setError('Failed to load user consultation history.');
    } finally {
      setIsLoadingUserDetail(false);
    }
  };

  // Toggle User Status
  const handleToggleUserStatus = async (user: UserSummaryResponse) => {
    const nextStatus = !user.is_active;
    try {
      await api.updateUserStatus(user.id, nextStatus);
      setSuccessMessage(`Account ${user.email} successfully ${nextStatus ? 'activated' : 'deactivated'}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchUsers();
      if (selectedUserDetail && selectedUserDetail.user.id === user.id) {
        setSelectedUserDetail({
          ...selectedUserDetail,
          user: { ...selectedUserDetail.user, is_active: nextStatus },
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update account status.');
    }
  };

  // Select Escalation Case for Triage
  const handleSelectCase = (c: EscalationCaseBrief) => {
    setSelectedCase(c);
    setCaseStatusEdit(c.status);
    setCasePriorityEdit(c.priority);
    setCaseAssigneeEdit(c.assigned_to || '');
    setCaseNotesEdit(c.resolution_notes || '');
  };

  // Update Escalation Case
  const handleSaveCaseUpdate = async () => {
    if (!selectedCase) return;
    setIsUpdatingCase(true);
    try {
      const updated = await api.updateEscalationCase(selectedCase.id, {
        status: caseStatusEdit,
        priority: casePriorityEdit,
        assigned_to: caseAssigneeEdit || '',
        resolution_notes: caseNotesEdit,
      });
      setSelectedCase(updated);
      setSuccessMessage(`Escalation case updated successfully.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchEscalations();
    } catch (err: any) {
      setError(err?.message || 'Failed to update escalation case.');
    } finally {
      setIsUpdatingCase(false);
    }
  };

  // List of Admin Users for Counsellor Assignment (authorized assignees)
  const authorizedAdmins = useMemo(() => {
    return userItems.filter((u) => u.role === 'admin');
  }, [userItems]);

  if (!isOpen) return null;

  const maxConcernCount = dashboard
    ? Math.max(1, ...dashboard.concern_categories.map((c) => c.count))
    : 1;

  const maxTrendCount = dashboard && dashboard.conversation_trends.length > 0
    ? Math.max(1, ...dashboard.conversation_trends.map((t) => t.count))
    : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-portal-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 border-b border-slate-200 shrink-0 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="admin-portal-title" className="text-base sm:text-lg font-bold text-slate-900">
                  CareerCompass Admin Operations
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-500">
                User governance, counsellor escalations & Neon PostgreSQL telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'overview') fetchDashboardData();
                else if (activeTab === 'users') fetchUsers();
                else if (activeTab === 'escalations') fetchEscalations();
              }}
              disabled={isLoading}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Refresh"
              aria-label="Refresh view"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin text-purple-600' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Close portal"
              aria-label="Close admin modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex items-center px-4 sm:px-6 border-b border-slate-200 bg-white shrink-0 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveTab('overview'); setSelectedUserDetail(null); setSelectedCase(null); }}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'overview'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 size={16} />
            <span>Overview Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('users'); setSelectedCase(null); }}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'users'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={16} />
            <span>User Management & Account Roster ({userTotal || userItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('escalations'); setSelectedUserDetail(null); }}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'escalations'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LifeBuoy size={16} />
            <span>Counsellor Escalations</span>
            {escPendingCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                {escPendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 text-xs text-red-700">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
              <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700 cursor-pointer">
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

          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === 'overview' && (
            <>
              {/* Filter Controls Bar */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-3">
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
                      Custom
                    </button>
                  </div>
                </div>

                {datePreset === 'custom' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="admin-start-date" className="text-[11px] font-semibold text-slate-500">From:</label>
                      <input
                        id="admin-start-date"
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="admin-end-date" className="text-[11px] font-semibold text-slate-500">To:</label>
                      <input
                        id="admin-end-date"
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                      />
                    </div>
                  </div>
                )}

                {/* Available Language & Location Filters from Memory Context */}
                {((dashboard?.filters.available_languages && dashboard.filters.available_languages.length > 0) ||
                  (dashboard?.filters.available_locations && dashboard.filters.available_locations.length > 0)) && (
                  <div className="flex items-center gap-4 pt-2 border-t border-slate-200 flex-wrap text-xs">
                    {dashboard.filters.available_languages.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <label htmlFor="admin-filter-language" className="text-slate-500 font-semibold text-[11px]">Language:</label>
                        <select
                          id="admin-filter-language"
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                        >
                          <option value="">All Languages</option>
                          {dashboard.filters.available_languages.map((lang) => (
                            <option key={lang} value={lang}>{lang}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {dashboard.filters.available_locations.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <label htmlFor="admin-filter-location" className="text-slate-500 font-semibold text-[11px]">Location:</label>
                        <select
                          id="admin-filter-location"
                          value={selectedLocation}
                          onChange={(e) => setSelectedLocation(e.target.value)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                        >
                          <option value="">All Locations</option>
                          {dashboard.filters.available_locations.map((loc) => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Database Filter Availability Notice */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">Database Schema Filter Support:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                    Date Range (Available)
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium cursor-help"
                    title={dashboard?.filters.language_note || 'Language column not present in schema'}
                  >
                    Language (Data not available)
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium cursor-help"
                    title={dashboard?.filters.location_note || 'Location column not present in schema'}
                  >
                    Location (Data not available)
                  </span>
                </div>
              </div>

              {/* 5 KPI Cards */}
              {dashboard && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                      <span>Total Users</span>
                      <Users size={16} className="text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {dashboard.kpis.total_registered_users}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Registered accounts</div>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                      <span>Active Users</span>
                      <Sparkles size={16} className="text-emerald-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {dashboard.kpis.active_users}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Engaged in consultation</div>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
                      <span>Consultations</span>
                      <MessageSquare size={16} className="text-indigo-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {dashboard.kpis.total_conversations}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Conversation threads</div>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
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

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
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

              {/* Visual Analytics */}
              {dashboard && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Trends */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <TrendingUp size={15} className="text-indigo-600" />
                          <span>Conversation Trends Over Time</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Daily counselling consultation session creation volume
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {dashboard.conversation_trends.length} recorded dates
                      </span>
                    </div>

                    {dashboard.conversation_trends.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                        <MessageSquare size={28} className="mb-2 opacity-30" />
                        <p className="text-xs">No conversations recorded in this date range.</p>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-end space-y-2 pt-4">
                        <table className="sr-only">
                          <caption>Consultation Volume by Date</caption>
                          <thead>
                            <tr>
                              <th scope="col">Date</th>
                              <th scope="col">Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboard.conversation_trends.map((t) => (
                              <tr key={t.date}>
                                <td>{t.date}</td>
                                <td>{t.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="flex items-end gap-2 h-36 pt-4 px-2 border-b border-slate-200 overflow-x-auto">
                          {dashboard.conversation_trends.map((t) => {
                            const heightPct = Math.max(12, Math.round((t.count / maxTrendCount) * 100));
                            return (
                              <div
                                key={t.date}
                                className="flex-1 min-w-[28px] max-w-[48px] flex flex-col items-center gap-1 group"
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

                  {/* Concern Categories */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Layers size={15} className="text-purple-600" />
                          <span>Student & Parent Concern Categories</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Aggregated from dialogue message turns & persistent user memory facts
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 space-y-3 pt-1">
                      {dashboard.concern_categories.map((c) => {
                        const widthPct = Math.max(4, Math.round((c.count / maxConcernCount) * 100));
                        return (
                          <div key={c.category} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800">{c.label}</span>
                              <span className="font-mono font-bold text-slate-700">
                                {c.count} <span className="text-[10px] font-normal text-slate-400">signals</span>
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${widthPct}%` }}
                                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                              />
                            </div>
                            <div className="text-[10px] text-slate-400 italic">
                              {c.source_description}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Parent vs Learner */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Users size={15} className="text-blue-600" />
                          <span>Parent vs Learner Engagement</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Persona engagement distribution based on available database schema
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                        Data not available
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2 bg-slate-50/70 border border-dashed border-slate-200 rounded-lg">
                      <AlertTriangle size={24} className="text-amber-500" />
                      <div className="text-xs font-semibold text-slate-800">
                        Persona Engagement Separation Not Tracked
                      </div>
                      <p className="text-[11px] text-slate-500 max-w-sm">
                        All non-admin accounts hold the standard <code className="px-1 py-0.5 bg-slate-200 text-slate-800 rounded font-mono">user</code> role. The database does not maintain a fabricated parent/learner split flag.
                      </p>
                    </div>
                  </div>

                  {/* Feedback Sentiment */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <ThumbsUp size={15} className="text-emerald-600" />
                          <span>Feedback Sentiment Breakdown</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Student-submitted ratings for counsel quality
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center space-y-4">
                      <div className="flex items-center justify-around text-center">
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 min-w-[120px]">
                          <div className="flex items-center justify-center gap-1.5 text-emerald-700 text-xs font-bold mb-1">
                            <ThumbsUp size={14} />
                            <span>Helpful</span>
                          </div>
                          <div className="text-2xl font-bold text-emerald-800">
                            {dashboard.feedback_breakdown.helpful}
                          </div>
                        </div>

                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 min-w-[120px]">
                          <div className="flex items-center justify-center gap-1.5 text-rose-700 text-xs font-bold mb-1">
                            <ThumbsDown size={14} />
                            <span>Unhelpful</span>
                          </div>
                          <div className="text-2xl font-bold text-rose-800">
                            {dashboard.feedback_breakdown.unhelpful}
                          </div>
                        </div>
                      </div>

                      {dashboard.kpis.collected_feedback_count > 0 && (
                        <div className="space-y-1">
                          <div className="w-full h-3 bg-rose-200 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${dashboard.feedback_breakdown.helpful_percentage || 0}%` }}
                              className="h-full bg-emerald-500 transition-all duration-300"
                              title={`${dashboard.feedback_breakdown.helpful_percentage}% Helpful`}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                            <span>{dashboard.feedback_breakdown.helpful_percentage}% Helpful</span>
                            <span>{dashboard.kpis.collected_feedback_count} Total Reviews</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users by name or email..."
                      value={userSearchQuery}
                      onChange={(e) => { setUserSearchQuery(e.target.value); setUserPage(1); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') fetchUsers(); }}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchUsers()}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors cursor-pointer"
                  >
                    Search
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-semibold text-[11px]">Role:</span>
                    <select
                      value={userRoleFilter}
                      onChange={(e) => { setUserRoleFilter(e.target.value as any); setUserPage(1); }}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                    >
                      <option value="all">All Roles</option>
                      <option value="user">User (Student/Parent)</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-semibold text-[11px]">Status:</span>
                    <select
                      value={userStatusFilter}
                      onChange={(e) => { setUserStatusFilter(e.target.value as any); setUserPage(1); }}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Deactivated Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Users Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3.5">User</th>
                        <th className="py-2.5 px-3.5">Role</th>
                        <th className="py-2.5 px-3.5">Activity</th>
                        <th className="py-2.5 px-3.5">Registered</th>
                        <th className="py-2.5 px-3.5">Status</th>
                        <th className="py-2.5 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {userItems.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3.5">
                            <div className="font-semibold text-slate-900">{u.full_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          </td>
                          <td className="py-2.5 px-3.5">
                            {u.role === 'admin' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wider border border-purple-200">
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                User
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <div className="text-slate-700 font-medium">{u.conversation_count} consultation(s)</div>
                            <div className="text-[10px] text-slate-400">{u.feedback_count} review(s)</div>
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px]">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3.5">
                            {u.is_active ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                Deactivated
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={isLoadingUserDetail}
                                onClick={() => handleOpenUserDetail(u.id)}
                                className="px-2 py-1 rounded-lg text-slate-600 hover:text-purple-700 hover:bg-purple-50 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                                title="Inspect consultation history"
                              >
                                {isLoadingUserDetail ? <RefreshCw size={13} className="animate-spin text-purple-600" /> : <Eye size={13} />}
                                <span>Inspect</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                                  u.is_active
                                    ? 'text-rose-600 hover:bg-rose-50'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={u.is_active ? 'Deactivate account' : 'Activate account'}
                              >
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {userItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No user accounts found matching query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                  <span>
                    Showing page {userPage} of {userTotalPages} ({userTotal} total users)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={userPage <= 1}
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={userPage >= userTotalPages}
                      onClick={() => setUserPage((p) => p + 1)}
                      className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* User Details Drawer / Inspection Card */}
              {selectedUserDetail && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-purple-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        User Audit & Activity: {selectedUserDetail.user.full_name} ({selectedUserDetail.user.email})
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUserDetail(null)}
                      className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Registered Role</span>
                      <span className="font-bold text-slate-800 uppercase">{selectedUserDetail.user.role}</span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Consultation Sessions</span>
                      <span className="font-bold text-slate-800">{selectedUserDetail.conversations.length}</span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Active Memory Facts</span>
                      <span className="font-bold text-slate-800">{selectedUserDetail.active_memories_count}</span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Escalation Cases</span>
                      <span className="font-bold text-slate-800">{selectedUserDetail.escalation_cases_count}</span>
                    </div>
                  </div>

                  {/* Conversations list */}
                  <div>
                    <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Recent Consultation Threads
                    </h5>
                    {selectedUserDetail.conversations.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No consultation threads started yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {selectedUserDetail.conversations.map((c) => (
                          <div
                            key={c.id}
                            className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-800">{c.title}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Updated: {new Date(c.updated_at).toLocaleString()}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                              {c.message_count} messages
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Feedback history list */}
                  <div>
                    <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Submitted Feedback & Ratings
                    </h5>
                    {selectedUserDetail.feedback.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No feedback submitted yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {selectedUserDetail.feedback.map((f) => (
                          <div
                            key={f.id}
                            className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              {f.rating === 'helpful' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <ThumbsUp size={11} /> Helpful
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-700 font-semibold text-[11px] bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                  <ThumbsDown size={11} /> Unhelpful
                                </span>
                              )}
                              {f.category && (
                                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                  {f.category}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(f.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COUNSELLOR ESCALATIONS */}
          {activeTab === 'escalations' && (
            <div className="space-y-4">
              {/* Status Triage Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => { setEscStatusFilter('pending'); setEscPage(1); }}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    escStatusFilter === 'pending'
                      ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/40'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-700 mb-1">
                    <span>Pending</span>
                    <Clock size={15} />
                  </div>
                  <div className="text-2xl font-bold text-amber-900">{escPendingCount}</div>
                  <div className="text-[10px] text-amber-700">Awaiting counsellor triage</div>
                </button>

                <button
                  type="button"
                  onClick={() => { setEscStatusFilter('assigned'); setEscPage(1); }}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    escStatusFilter === 'assigned'
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400/40'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-700 mb-1">
                    <span>Assigned</span>
                    <UserCheck size={15} />
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{escAssignedCount}</div>
                  <div className="text-[10px] text-blue-700">Assigned to staff counsellor</div>
                </button>

                <button
                  type="button"
                  onClick={() => { setEscStatusFilter('in_progress'); setEscPage(1); }}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    escStatusFilter === 'in_progress'
                      ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-400/40'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-purple-700 mb-1">
                    <span>In Progress</span>
                    <LifeBuoy size={15} />
                  </div>
                  <div className="text-2xl font-bold text-purple-900">{escInProgressCount}</div>
                  <div className="text-[10px] text-purple-700">Active human guidance</div>
                </button>

                <button
                  type="button"
                  onClick={() => { setEscStatusFilter('resolved'); setEscPage(1); }}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    escStatusFilter === 'resolved'
                      ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/40'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 mb-1">
                    <span>Resolved</span>
                    <CheckCircle2 size={15} />
                  </div>
                  <div className="text-2xl font-bold text-emerald-900">{escResolvedCount}</div>
                  <div className="text-[10px] text-emerald-700">Completed & notes filed</div>
                </button>
              </div>

              {/* Filter and Clear */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Filter size={14} className="text-slate-500" />
                    <span className="font-semibold text-slate-700">Filter Status:</span>
                    <select
                      value={escStatusFilter}
                      onChange={(e) => { setEscStatusFilter(e.target.value); setEscPage(1); }}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                    >
                      <option value="">All Statuses ({escTotal})</option>
                      <option value="pending">Pending ({escPendingCount})</option>
                      <option value="assigned">Assigned ({escAssignedCount})</option>
                      <option value="in_progress">In Progress ({escInProgressCount})</option>
                      <option value="resolved">Resolved ({escResolvedCount})</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Priority:</span>
                    <select
                      value={escPriorityFilter}
                      onChange={(e) => { setEscPriorityFilter(e.target.value); setEscPage(1); }}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                    >
                      <option value="">All Priorities</option>
                      <option value="high">High Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>
                </div>

                {(escStatusFilter || escPriorityFilter) && (
                  <button
                    type="button"
                    onClick={() => { setEscStatusFilter(''); setEscPriorityFilter(''); setEscPage(1); }}
                    className="text-purple-600 hover:text-purple-800 font-semibold cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Cases List Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3.5">Priority</th>
                        <th className="py-2.5 px-3.5">Status</th>
                        <th className="py-2.5 px-3.5">Student / User</th>
                        <th className="py-2.5 px-3.5">Trigger & Reason</th>
                        <th className="py-2.5 px-3.5">Assigned To</th>
                        <th className="py-2.5 px-3.5">Created</th>
                        <th className="py-2.5 px-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {escalations.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3.5">
                            {c.priority === 'high' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase">
                                High
                              </span>
                            ) : c.priority === 'medium' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                                Medium
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                Low
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5">
                            {c.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-bold text-[11px]">
                                <Clock size={12} /> Pending
                              </span>
                            ) : c.status === 'assigned' ? (
                              <span className="inline-flex items-center gap-1 text-blue-700 font-semibold text-[11px]">
                                <UserCheck size={12} /> Assigned
                              </span>
                            ) : c.status === 'in_progress' ? (
                              <span className="inline-flex items-center gap-1 text-purple-700 font-semibold text-[11px]">
                                <LifeBuoy size={12} /> In Progress
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                <CheckCircle2 size={12} /> Resolved
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <div className="font-semibold text-slate-900">{c.user_name || 'Student / Parent'}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{c.user_email || c.user_id}</div>
                          </td>
                          <td className="py-2.5 px-3.5 max-w-xs">
                            <div className="font-medium text-slate-800 line-clamp-1">{c.reason}</div>
                            <div className="text-[10px] text-slate-400 capitalize">{c.trigger_type.replace(/_/g, ' ')}</div>
                          </td>
                          <td className="py-2.5 px-3.5">
                            {c.assigned_to_name ? (
                              <span className="text-slate-800 font-semibold">{c.assigned_to_name}</span>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px]">
                            {new Date(c.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleSelectCase(c)}
                              className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Triage
                            </button>
                          </td>
                        </tr>
                      ))}
                      {escalations.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No counsellor escalation cases found matching filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                  <span>
                    Showing page {escPage} of {escTotalPages} ({escTotal} cases total)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={escPage <= 1}
                      onClick={() => setEscPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={escPage >= escTotalPages}
                      onClick={() => setEscPage((p) => p + 1)}
                      className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Triage & Case Update Modal / Section */}
              {selectedCase && (
                <div className="p-4 bg-slate-50 border border-purple-200 rounded-xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                    <div className="flex items-center gap-2">
                      <LifeBuoy size={18} className="text-purple-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Counsellor Case Triage — Reference: {selectedCase.id.slice(0, 8).toUpperCase()}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCase(null)}
                      className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 text-[11px] block">Trigger & Reasoning:</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{selectedCase.reason}</p>
                      {selectedCase.user_notes && (
                        <div className="mt-2 p-2 bg-white rounded border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-semibold">Student Context / Notes:</span>
                          <p className="text-slate-700 italic text-[11px]">{selectedCase.user_notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-slate-600 min-w-[70px]">Status:</label>
                        <select
                          value={caseStatusEdit}
                          onChange={(e) => setCaseStatusEdit(e.target.value as any)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 flex-1"
                        >
                          <option value="pending">Pending</option>
                          <option value="assigned">Assigned</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-slate-600 min-w-[70px]">Priority:</label>
                        <select
                          value={casePriorityEdit}
                          onChange={(e) => setCasePriorityEdit(e.target.value as any)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 flex-1"
                        >
                          <option value="high">High Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="low">Low Priority</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-slate-600 min-w-[70px]">Assignee:</label>
                        <select
                          value={caseAssigneeEdit}
                          onChange={(e) => setCaseAssigneeEdit(e.target.value)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 flex-1"
                        >
                          <option value="">Unassigned</option>
                          {authorizedAdmins.map((adm) => (
                            <option key={adm.id} value={adm.id}>
                              {adm.full_name} ({adm.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Resolution / Counsellor Advising Notes:
                    </label>
                    <textarea
                      rows={3}
                      value={caseNotesEdit}
                      onChange={(e) => setCaseNotesEdit(e.target.value)}
                      placeholder="Add guidance notes, scheduled institutional advisory, or student follow-up outcome..."
                      className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-100">
                    <button
                      type="button"
                      onClick={() => setSelectedCase(null)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingCase}
                      onClick={handleSaveCaseUpdate}
                      className="px-4 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {isUpdatingCase ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                      <span>Save & Update Case</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
