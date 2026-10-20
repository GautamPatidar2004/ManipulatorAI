import React from 'react';
import { Info, ShieldCheck, Bookmark, Compass } from 'lucide-react';
import type { InfoCardBlock } from '../../../types/blocks';

interface InfoCardBlockViewProps {
  block: InfoCardBlock;
}

function resolveIcon(iconName?: string) {
  switch (iconName) {
    case 'shield-check':
      return <ShieldCheck size={15} className="text-blue-600 shrink-0" />;
    case 'bookmark':
      return <Bookmark size={15} className="text-indigo-600 shrink-0" />;
    case 'compass':
      return <Compass size={15} className="text-blue-600 shrink-0" />;
    default:
      return <Info size={15} className="text-blue-600 shrink-0" />;
  }
}

export const InfoCardBlockView: React.FC<InfoCardBlockViewProps> = ({ block }) => {
  const { title, description, badge, icon } = block;
  if (!title && !description) return null;

  return (
    <div className="my-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm text-slate-800">
          {resolveIcon(icon)}
          <span>{title}</span>
        </div>
        {badge && (
          <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
        {description}
      </p>
    </div>
  );
};
