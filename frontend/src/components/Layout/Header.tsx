import React from 'react';
import { Menu, Compass, Brain, ShieldAlert, LogOut, LogIn, User as UserIcon } from 'lucide-react';
import { StatusBadge } from '../Common/StatusBadge';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  currentTitle: string;
  isHealthy: boolean | null;
  aiAvailable: boolean;
  checkingHealth: boolean;
  onToggleSidebar: () => void;
  onOpenMemory?: () => void;
  onOpenAdmin?: () => void;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTitle,
  isHealthy,
  aiAvailable,
  checkingHealth,
  onToggleSidebar,
  onOpenMemory,
  onOpenAdmin,
  onOpenAuth,
}) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  return (
    <header className="flex items-center justify-between p-3 sm:px-6 bg-white border-b border-slate-200 shadow-xs z-20 shrink-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation drawer"
          title="Open conversation history"
        >
          <Menu size={19} />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Compass size={18} />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight line-clamp-1">
              {currentTitle || 'New Consultation'}
            </h1>
            <span className="text-[11px] text-slate-400 block">AI Career Guidance • Confidential</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Admin Portal Button */}
        {isAuthenticated && isAdmin && onOpenAdmin && (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200 cursor-pointer shadow-2xs"
            title="Switch to Admin Panel"
          >
            <ShieldAlert size={14} className="text-purple-600" />
            <span className="hidden sm:inline">Switch to Admin</span>
            <span className="sr-only">Admin Portal</span>
          </button>
        )}

        {/* Memory Button */}
        {onOpenMemory && (
          <button
            type="button"
            onClick={onOpenMemory}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-colors border border-slate-200/80 cursor-pointer"
            title="View, edit, or forget persistent memories"
          >
            <Brain size={15} className="text-blue-600" />
            <span className="hidden sm:inline">Memory</span>
          </button>
        )}

        {/* Backend health status badge */}
        <StatusBadge
          isHealthy={isHealthy}
          aiAvailable={aiAvailable}
          checking={checkingHealth}
        />

        {/* User Identity & Auth Action */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-slate-200">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800 line-clamp-1 max-w-[120px]">
                {user.full_name}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {user.role}
              </span>
            </div>

            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                isAdmin
                  ? 'bg-purple-100 text-purple-700 border border-purple-300'
                  : 'bg-blue-100 text-blue-700 border border-blue-300'
              }`}
              title={`${user.full_name} (${user.email})`}
            >
              {user.full_name.charAt(0).toUpperCase() || <UserIcon size={13} />}
            </div>

            <button
              type="button"
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Sign out of consultation"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs ml-1"
            >
              <LogIn size={13} />
              <span>Sign In</span>
            </button>
          )
        )}
      </div>
    </header>
  );
};
