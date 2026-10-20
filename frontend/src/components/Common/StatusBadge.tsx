import React from 'react';

interface StatusBadgeProps {
  isHealthy: boolean | null;
  aiAvailable: boolean;
  checking?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  isHealthy,
  aiAvailable,
  checking = false,
}) => {
  if (checking) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
        <span>Checking API...</span>
      </div>
    );
  }

  if (isHealthy === false) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"
        title="Backend service unreachable at localhost:8000"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        <span>Backend Offline</span>
      </div>
    );
  }

  if (isHealthy === true && !aiAvailable) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"
        title="Configure AI_PROVIDER (gemini, groq, or openai) and API key in backend/.env"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        <span>AI Setup Required</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
      title="AI Provider active and ready for career consultations"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span>AI Online</span>
    </div>
  );
};
