import React from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import type { KeyTakeawaysBlock } from '../../../types/blocks';

interface KeyTakeawaysBlockViewProps {
  block: KeyTakeawaysBlock;
}

export const KeyTakeawaysBlockView: React.FC<KeyTakeawaysBlockViewProps> = ({ block }) => {
  const { title = 'Key Takeaways', points } = block;
  if (!Array.isArray(points) || points.length === 0) return null;

  return (
    <div className="my-2.5 p-3 sm:p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 mb-2">
        <Sparkles size={14} className="text-blue-600 shrink-0" />
        <span>{title}</span>
      </div>
      <ul className="space-y-1.5">
        {points.map((pt, idx) => (
          <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-800">
            <CheckCircle2 size={13} className="text-blue-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{pt}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
