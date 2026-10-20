import React from 'react';
import type { HeadingBlock } from '../../../types/blocks';

interface HeadingBlockViewProps {
  block: HeadingBlock;
}

export const HeadingBlockView: React.FC<HeadingBlockViewProps> = ({ block }) => {
  const { level = 2, text } = block;
  if (!text) return null;

  switch (level) {
    case 1:
      return (
        <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-3 mb-1.5 flex items-center gap-1.5">
          {text}
        </h3>
      );
    case 2:
      return (
        <h4 className="text-xs sm:text-sm font-bold text-slate-800 mt-2.5 mb-1 flex items-center gap-1.5">
          {text}
        </h4>
      );
    case 3:
      return (
        <h5 className="text-[11px] sm:text-xs font-semibold text-slate-700 uppercase tracking-wider mt-2 mb-1">
          {text}
        </h5>
      );
    case 4:
    default:
      return (
        <h6 className="text-[11px] sm:text-xs font-medium text-slate-600 mt-1.5 mb-0.5">
          {text}
        </h6>
      );
  }
};
