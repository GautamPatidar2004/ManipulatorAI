import React from 'react';
import { MessageSquarePlus } from 'lucide-react';
import type { QuickRepliesBlock } from '../../../types/blocks';

interface QuickRepliesBlockViewProps {
  block: QuickRepliesBlock;
  onActionClick?: (payload: string) => void;
}

export const QuickRepliesBlockView: React.FC<QuickRepliesBlockViewProps> = ({
  block,
  onActionClick,
}) => {
  const { options = [] } = block;
  if (!Array.isArray(options) || options.length === 0) return null;

  return (
    <div className="my-2.5 pt-2 border-t border-slate-100">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
        <MessageSquarePlus size={14} className="text-blue-600 shrink-0" />
        <span>Quick Responses</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onActionClick?.(opt.payload || opt.label)}
            className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-3 py-1.5 rounded-full border border-slate-200 hover:border-blue-300 shadow-2xs transition-all cursor-pointer font-medium active:scale-98"
          >
            <span>{opt.label}</span>
            {opt.category && (
              <span className="text-[10px] text-slate-400 font-normal">
                ({opt.category})
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
