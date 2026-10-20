import React from 'react';
import {
  Compass,
  Plus,
  MessageSquare,
  X,
  Clock,
  Trash2,
  LogOut,
} from 'lucide-react';
import type { ConversationSession } from '../../types/chat';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ConversationSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onNewChat: () => void;
  isBackendHealthy: boolean | null;
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  } catch {
    return '';
  }
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  isBackendHealthy,
}) => {
  const { user, isAdmin, logout } = useAuth();

  return (
    <>
      {/* Mobile drawer backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-35"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 w-72 min-w-72 h-full flex flex-col bg-slate-50/95 md:bg-slate-50/70 border-r border-slate-200 z-40 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } shadow-xl md:shadow-none`}
      >
        {/* Sidebar Header / Brand Identity */}
        <div className="flex items-center justify-between p-4 px-4.5 border-b border-slate-200/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <Compass size={21} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">CareerCompass</h2>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">
                AI Career Counsellor
              </span>
            </div>
          </div>

          <button
            type="button"
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action: New Chat */}
        <div className="p-3.5 px-4 pb-2 shrink-0">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200/80 hover:border-blue-600 rounded-xl text-sm font-semibold transition-all duration-150 shadow-xs cursor-pointer"
            onClick={() => {
              onNewChat();
              onClose();
            }}
          >
            <Plus size={16} />
            <span>New Consultation</span>
          </button>
        </div>

        {/* Conversation History */}
        <div className="flex-1 flex flex-col px-3 py-2 overflow-y-auto min-h-0">
          <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <Clock size={12} />
            <span>Consultation History</span>
          </div>

          <div className="flex flex-col gap-1 mt-1">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center text-center py-10 px-4 gap-1.5 text-slate-400 my-auto">
                <MessageSquare size={22} className="opacity-40 mb-1" />
                <p className="text-xs font-semibold text-slate-600">No active sessions yet.</p>
                <span className="text-[11px] text-slate-400 leading-relaxed">
                  Start a new consultation to track career dialogues.
                </span>
              </div>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                const count = session.message_count ?? (session as unknown as { messageCount: number }).messageCount ?? 0;
                const timestamp = session.updated_at || (session as unknown as { updatedAt: string }).updatedAt;

                return (
                  <div
                    key={session.id}
                    className={`group relative flex items-center rounded-xl transition-all ${
                      isActive
                        ? 'bg-white text-blue-700 border border-slate-200 shadow-xs font-semibold'
                        : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full flex items-start gap-2.5 p-2.5 pr-8 text-left transition-all cursor-pointer"
                      onClick={() => {
                        onSelectSession(session.id);
                        onClose();
                      }}
                    >
                      <MessageSquare
                        size={15}
                        className={`mt-0.5 shrink-0 ${isActive ? 'text-blue-600 opacity-100' : 'opacity-60'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs truncate">{session.title}</span>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                          <span>{formatRelativeTime(timestamp)}</span>
                          {count > 0 && (
                            <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-500 font-mono">
                              {count} msgs
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {onDeleteSession && (
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 absolute right-2 top-2.5 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all cursor-pointer"
                        title="Delete conversation"
                        aria-label={`Delete conversation ${session.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-slate-200/70 bg-slate-50/90 shrink-0 space-y-2.5">
          {user && (
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isAdmin
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate">{user.full_name}</div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                        isAdmin
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {user.role}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[90px]">{user.email}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isBackendHealthy ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span>Backend {isBackendHealthy ? 'Online' : 'Offline'}</span>
            </span>
            <span className="text-[10px] text-slate-400">CareerCompass AI</span>
          </div>
        </div>
      </aside>
    </>
  );
};
