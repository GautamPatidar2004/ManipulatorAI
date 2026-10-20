import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { BulletListBlock } from '../../../types/blocks';

interface BulletListBlockViewProps {
  block: BulletListBlock;
}

export const BulletListBlockView: React.FC<BulletListBlockViewProps> = ({ block }) => {
  const { title, items } = block;
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="my-2 space-y-1">
      {title && (
        <div className="text-xs font-semibold text-slate-800 mb-1">{title}</div>
      )}
      <ul className="space-y-1 pl-1">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
            <CheckCircle2 size={14} className="text-blue-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
