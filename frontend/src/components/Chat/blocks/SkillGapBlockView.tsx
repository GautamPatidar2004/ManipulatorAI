import React from 'react';
import { Target, Check, AlertCircle, ArrowRight } from 'lucide-react';
import type { SkillGapBlock } from '../../../types/blocks';

interface SkillGapBlockViewProps {
  block: SkillGapBlock;
}

export const SkillGapBlockView: React.FC<SkillGapBlockViewProps> = ({ block }) => {
  const {
    target_role,
    prerequisites = [],
    existing_skills = [],
    missing_skills = [],
    recommended_actions = [],
  } = block;

  return (
    <div className="my-3 p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
      {/* Header */}
      <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-900 mb-2.5">
        <Target size={16} className="text-blue-600 shrink-0" />
        <span>Skill-Gap Analysis: {target_role}</span>
      </div>

      {/* Prerequisites if present */}
      {Array.isArray(prerequisites) && prerequisites.length > 0 && (
        <div className="mb-2.5 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
          <span className="font-semibold text-slate-700 mr-1.5">Prerequisites:</span>
          <span className="text-slate-600">{prerequisites.join(' • ')}</span>
        </div>
      )}

      {/* Skills Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3 text-xs">
        {/* Existing Skills */}
        <div className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg">
          <div className="flex items-center gap-1 font-semibold text-emerald-800 mb-1.5">
            <Check size={13} className="text-emerald-600" />
            <span>Demonstrated / Current Skills</span>
          </div>
          {existing_skills.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {existing_skills.map((s, idx) => (
                <span
                  key={idx}
                  className="bg-white text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-400 italic text-[11px]">None recorded yet</span>
          )}
        </div>

        {/* Missing Skills */}
        <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg">
          <div className="flex items-center gap-1 font-semibold text-amber-800 mb-1.5">
            <AlertCircle size={13} className="text-amber-600" />
            <span>Identified Skill Gaps</span>
          </div>
          {missing_skills.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {missing_skills.map((s, idx) => (
                <span
                  key={idx}
                  className="bg-white text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-emerald-600 text-[11px]">No critical skill gaps</span>
          )}
        </div>
      </div>

      {/* Recommended Actions */}
      {Array.isArray(recommended_actions) && recommended_actions.length > 0 && (
        <div className="pt-2 border-t border-slate-100 text-xs">
          <div className="font-semibold text-slate-700 mb-1">Recommended Next Actions:</div>
          <ul className="space-y-1">
            {recommended_actions.map((act, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-slate-600">
                <ArrowRight size={12} className="text-blue-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{act}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
