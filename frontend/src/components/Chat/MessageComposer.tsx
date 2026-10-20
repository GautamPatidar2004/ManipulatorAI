import React, { useState, useRef, useEffect } from 'react';
import { Send, CornerDownLeft } from 'lucide-react';

interface MessageComposerProps {
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  isLoading,
  disabled = false,
}) => {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height up to 160px
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      const newHeight = Math.min(el.scrollHeight, 160);
      el.style.height = `${newHeight}px`;
    }
  }, [content]);

  const isSubmittingRef = useRef(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || isLoading || disabled || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    onSendMessage(trimmed);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  const isSendDisabled = !content.trim() || isLoading || disabled;

  return (
    <footer className="p-3 sm:px-6 pb-4 bg-slate-50/80 border-t border-slate-200 shrink-0">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex flex-col gap-1.5">
        <div className="relative flex items-end bg-white border border-slate-300 focus-within:border-blue-600 focus-within:ring-3 focus-within:ring-blue-100 rounded-2xl p-2 px-3 sm:px-4 shadow-xs transition-all">
          <textarea
            ref={textareaRef}
            className="flex-1 border-0 bg-transparent resize-none py-1 max-h-40 text-sm sm:text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
            placeholder="Ask about career transitions, resume strategies, skill benchmarks..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || disabled}
            rows={1}
            maxLength={4000}
            aria-label="Career consultation query input"
          />

          <button
            type="submit"
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white ml-2 shrink-0 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed shadow-xs cursor-pointer"
            disabled={isSendDisabled}
            aria-label="Send message"
            title="Send message (Enter)"
          >
            {isLoading ? (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between px-1 text-xs text-slate-400">
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <CornerDownLeft size={12} className="text-slate-400" />
            Press <kbd className="font-mono bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-600">Enter</kbd> to send, <kbd className="font-mono bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-600">Shift + Enter</kbd> for new line
          </span>
          <span className="font-mono text-[11px] ml-auto">
            {content.length}/4000
          </span>
        </div>
      </form>
    </footer>
  );
};
