import React from 'react';
import { HelpCircle, ChevronRight } from 'lucide-react';
import type { FollowUpQuestionsBlock } from '../../../types/blocks';

interface FollowUpQuestionsBlockViewProps {
  block: FollowUpQuestionsBlock;
  onActionClick?: (questionText: string) => void;
}

export const FollowUpQuestionsBlockView: React.FC<FollowUpQuestionsBlockViewProps> = ({
  block,
  onActionClick,
}) => {
  const { questions = [] } = block;
  if (!Array.isArray(questions) || questions.length === 0) return null;

  return (
    <div className="my-2.5 pt-2 border-t border-slate-100">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
        <HelpCircle size={14} className="text-blue-600 shrink-0" />
        <span>Suggested Follow-Up Inquiries</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {questions.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onActionClick?.(q)}
            className="flex items-center justify-between text-left text-xs bg-slate-50 hover:bg-blue-50/80 text-slate-700 hover:text-blue-700 px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer group"
          >
            <span className="leading-normal">{q}</span>
            <ChevronRight
              size={13}
              className="text-slate-400 group-hover:text-blue-600 shrink-0 ml-1 transition-transform group-hover:translate-x-0.5"
            />
          </button>
        ))}
      </div>
    </div>
  );
};
