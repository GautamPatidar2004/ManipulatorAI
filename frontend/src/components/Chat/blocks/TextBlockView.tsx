import React from 'react';
import type { TextBlock } from '../../../types/blocks';

interface TextBlockViewProps {
  block: TextBlock;
}

export const TextBlockView: React.FC<TextBlockViewProps> = ({ block }) => {
  const { text, variant = 'body' } = block;
  if (!text) return null;

  if (variant === 'callout') {
    return (
      <div className="my-2 p-3 bg-blue-50/70 border-l-4 border-blue-500 rounded-r-lg text-xs sm:text-sm text-slate-800 leading-relaxed">
        {text}
      </div>
    );
  }

  if (variant === 'quote') {
    return (
      <blockquote className="my-2 pl-3.5 border-l-2 border-slate-300 italic text-xs sm:text-sm text-slate-600 leading-relaxed">
        "{text}"
      </blockquote>
    );
  }

  return (
    <p className="my-1.5 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
      {text}
    </p>
  );
};
