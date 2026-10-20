import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { LimitationNoticeBlock } from '../../../types/blocks';

interface LimitationNoticeBlockViewProps {
  block: LimitationNoticeBlock;
}

export const LimitationNoticeBlockView: React.FC<LimitationNoticeBlockViewProps> = ({ block }) => {
  const {
    title = 'Evidence Limitation Notice',
    message,
    missing_fields = [],
  } = block;
  if (!message) return null;

  return (
    <div className="my-2 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-amber-900 mb-0.5">
        <ShieldAlert size={13} className="text-amber-600 shrink-0" />
        <span className="text-[11px] uppercase tracking-wide">{title}</span>
      </div>

      <p className="text-[11px] text-amber-800 leading-normal">
        {message}
      </p>

      {Array.isArray(missing_fields) && missing_fields.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] text-amber-700">
          <span className="font-medium">Withheld:</span>
          {missing_fields.map((field, idx) => (
            <span
              key={idx}
              className="bg-white/80 text-amber-800 px-1 py-0.2 rounded font-mono border border-amber-200"
            >
              {field}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
