import React from 'react';
import { Compass } from 'lucide-react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex gap-3" aria-live="polite">
      <div className="shrink-0 mt-0.5" aria-hidden="true">
        <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-xs">
          <Compass size={17} />
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-3 px-4 shadow-xs">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" />
          </div>
          <span className="text-xs text-slate-500 font-medium">Connecting to career engine...</span>
        </div>
      </div>
    </div>
  );
};
