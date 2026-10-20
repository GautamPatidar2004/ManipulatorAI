import React from 'react';
import { BookOpen, Clock, Tag } from 'lucide-react';
import type { LearningPlanBlock } from '../../../types/blocks';

interface LearningPlanBlockViewProps {
  block: LearningPlanBlock;
}

export const LearningPlanBlockView: React.FC<LearningPlanBlockViewProps> = ({ block }) => {
  const { title, modules = [], level = 'beginner', prerequisites = [] } = block;

  const levelStyles = {
    beginner: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    intermediate: 'bg-blue-50 text-blue-700 border-blue-200',
    advanced: 'bg-purple-50 text-purple-700 border-purple-200',
  }[level] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className="my-3 p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-900">
          <BookOpen size={16} className="text-blue-600 shrink-0" />
          <span>{title}</span>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${levelStyles}`}
        >
          {level}
        </span>
      </div>

      {/* Prerequisites */}
      {Array.isArray(prerequisites) && prerequisites.length > 0 && (
        <div className="mb-3 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
          <span className="font-semibold text-slate-700 mr-1.5">Prerequisites:</span>
          <span className="text-slate-600">{prerequisites.join(', ')}</span>
        </div>
      )}

      {/* Modules List */}
      <div className="space-y-2">
        {modules.map((m, idx) => (
          <div
            key={idx}
            className="p-2.5 bg-slate-50/70 border border-slate-200/80 rounded-lg text-xs"
          >
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="font-semibold text-slate-900">
                Module {m.module_index || idx + 1}: {m.title}
              </span>
              {m.duration && (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
                  <Clock size={10} />
                  <span>{m.duration}</span>
                </span>
              )}
            </div>

            {/* Topics */}
            {Array.isArray(m.topics) && m.topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 mb-1.5">
                {m.topics.map((t, tIdx) => (
                  <span
                    key={tIdx}
                    className="inline-flex items-center gap-1 bg-white text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded text-[10px]"
                  >
                    <Tag size={9} className="text-blue-500" />
                    <span>{t}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Recommended Resources */}
            {Array.isArray(m.recommended_resources) && m.recommended_resources.length > 0 && (
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                <span className="font-medium text-slate-600">Resources: </span>
                <span>{m.recommended_resources.join(', ')}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
