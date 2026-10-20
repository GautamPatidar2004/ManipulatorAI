import React from 'react';
import { Award, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import type { RecommendationCardBlock } from '../../../types/blocks';

interface RecommendationCardBlockViewProps {
  block: RecommendationCardBlock;
  onActionClick?: (payload: string) => void;
}

export const RecommendationCardBlockView: React.FC<RecommendationCardBlockViewProps> = ({
  block,
  onActionClick,
}) => {
  const {
    title,
    description,
    reasoning,
    risks_and_limitations,
    priority = 'medium',
    action_label,
  } = block;

  const priorityStyles = {
    high: 'bg-rose-50 text-rose-700 border-rose-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-700 border-slate-200',
  }[priority] || 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <div className="my-2.5 p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-900">
          <Award size={16} className="text-blue-600 shrink-0" />
          <span>{title}</span>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${priorityStyles}`}
        >
          {priority.toUpperCase()} Priority
        </span>
      </div>

      {/* Description */}
      <p className="text-xs sm:text-sm text-slate-600 mb-3 leading-relaxed">
        {description}
      </p>

      {/* Reasoning & Risks Grid */}
      <div className="space-y-2 text-xs">
        {reasoning && (
          <div className="p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-lg">
            <div className="flex items-center gap-1 font-semibold text-emerald-800 mb-0.5">
              <CheckCircle size={13} className="text-emerald-600 shrink-0" />
              <span>Why Recommended</span>
            </div>
            <p className="text-slate-600 leading-normal pl-4">{reasoning}</p>
          </div>
        )}

        {risks_and_limitations && (
          <div className="p-2.5 bg-amber-50/60 border border-amber-100 rounded-lg">
            <div className="flex items-center gap-1 font-semibold text-amber-800 mb-0.5">
              <AlertTriangle size={13} className="text-amber-600 shrink-0" />
              <span>Risks & Considerations</span>
            </div>
            <p className="text-slate-600 leading-normal pl-4">{risks_and_limitations}</p>
          </div>
        )}
      </div>

      {/* Action Button */}
      {action_label && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={() => onActionClick?.(action_label)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
          >
            <span>{action_label}</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
};
