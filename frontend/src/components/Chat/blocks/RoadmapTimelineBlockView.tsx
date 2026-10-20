import React from 'react';
import { Route, Clock, Check } from 'lucide-react';
import type { RoadmapTimelineBlock } from '../../../types/blocks';

interface RoadmapTimelineBlockViewProps {
  block: RoadmapTimelineBlock;
}

export const RoadmapTimelineBlockView: React.FC<RoadmapTimelineBlockViewProps> = ({ block }) => {
  const { title, steps, estimated_duration } = block;
  if (!Array.isArray(steps) || steps.length === 0) return null;

  return (
    <div className="my-3 p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-900">
          <Route size={16} className="text-blue-600 shrink-0" />
          <span>{title}</span>
        </div>
        {estimated_duration && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100 shrink-0">
            <Clock size={11} />
            <span>{estimated_duration}</span>
          </span>
        )}
      </div>

      {/* Timeline Steps */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {steps.map((step, idx) => (
          <div key={idx} className="relative group">
            {/* Step Circle Indicator */}
            <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center ring-4 ring-white shadow-2xs">
              {step.step_number || idx + 1}
            </div>

            {/* Step Content */}
            <div className="bg-slate-50/70 p-2.5 sm:p-3 rounded-lg border border-slate-100">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="font-semibold text-xs sm:text-sm text-slate-900">
                  {step.title}
                </span>
                {step.duration && (
                  <span className="text-[10px] text-slate-500 font-medium shrink-0">
                    {step.duration}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-1.5">
                {step.description}
              </p>

              {/* Milestones */}
              {Array.isArray(step.milestones) && step.milestones.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-slate-200/50">
                  {step.milestones.map((ms, mIdx) => (
                    <div key={mIdx} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Check size={11} className="text-emerald-600 shrink-0" />
                      <span>{ms}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
