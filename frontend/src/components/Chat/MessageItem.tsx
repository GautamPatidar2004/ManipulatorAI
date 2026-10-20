import React, { useState } from 'react';
import {
  User,
  Compass,
  Info,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Check,
  X,
} from 'lucide-react';
import type { ChatMessage } from '../../types/chat';
import { StructuredBlockRenderer } from './StructuredBlockRenderer';
import { api } from '../../api/client';

interface MessageItemProps {
  message: ChatMessage;
  onActionClick?: (payload: string) => void;
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onActionClick }) => {
  const isUser = message.role === 'user';
  const timeFormatted = formatTimestamp(message.timestamp);

  // Message Feedback State (Prompt 11)
  const [feedbackRating, setFeedbackRating] = useState<'helpful' | 'unhelpful' | null>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [feedbackErrorMsg, setFeedbackErrorMsg] = useState<string | null>(null);

  const handleSelectRating = (rating: 'helpful' | 'unhelpful') => {
    if (feedbackStatus === 'submitted') return;
    setFeedbackRating(rating);
    setShowCommentBox(true);
  };

  const handleSubmitFeedback = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!feedbackRating || !message.id) return;

    setFeedbackStatus('submitting');
    setFeedbackErrorMsg(null);
    try {
      await api.submitMessageFeedback(
        message.id,
        feedbackRating,
        feedbackComment.trim() || undefined,
      );
      setFeedbackStatus('submitted');
      setShowCommentBox(false);
    } catch (err) {
      setFeedbackStatus('error');
      setFeedbackErrorMsg(err instanceof Error ? err.message : 'Could not submit feedback.');
    }
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className="shrink-0 mt-0.5" aria-hidden="true">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-medium shadow-xs">
            <User size={16} />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-xs">
            <Compass size={17} />
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className={`max-w-[85%] sm:max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-xs font-semibold text-slate-700">
            {isUser ? 'You' : 'Career Counsellor'}
          </span>
          {message.status === 'unavailable' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
              <AlertTriangle size={11} />
              AI Pending Setup
            </span>
          )}
          {timeFormatted && (
            <time className="text-[11px] text-slate-400" dateTime={message.timestamp}>
              {timeFormatted}
            </time>
          )}
        </div>

        <div
          className={`rounded-2xl p-3.5 px-4 text-sm sm:text-[15px] leading-relaxed shadow-xs ${
            isUser
              ? 'rounded-tr-xs bg-linear-to-r from-blue-600 to-blue-700 text-white'
              : 'rounded-tl-xs bg-white border border-slate-200 text-slate-900'
          }`}
        >
          <div className="break-words">
            {message.content.split('\n').map((line, idx) => (
              <React.Fragment key={idx}>
                {line}
                {idx < message.content.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>

          {message.notice &&
            message.status === 'unavailable' &&
            !message.notice.toLowerCase().includes('generated via') &&
            !message.notice.toLowerCase().includes('counselling intelligence') &&
            !message.notice.toLowerCase().includes('openai') &&
            !message.notice.toLowerCase().includes('gemini') &&
            !message.notice.toLowerCase().includes('groq') && (
            <div className="mt-3 p-2.5 px-3 bg-amber-50 border border-amber-200 border-l-3 border-l-amber-500 rounded-sm flex items-start gap-2 text-xs text-amber-800">
              <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <span>{message.notice}</span>
            </div>
          )}

          {message.structured && (
            <StructuredBlockRenderer
              block={message.structured}
              mainContent={message.content}
              onActionClick={onActionClick}
            />
          )}
        </div>

        {/* Message-Level Feedback Controls (Assistant messages only) */}
        {!isUser && message.id && (
          <div className="mt-1.5 px-1 flex flex-col gap-1.5 text-xs text-slate-500">
            {feedbackStatus === 'submitted' ? (
              <div className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                <Check size={13} />
                <span>Thank you for your feedback!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Helpful?</span>
                <button
                  type="button"
                  onClick={() => handleSelectRating('helpful')}
                  disabled={feedbackStatus === 'submitting'}
                  className={`p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer ${
                    feedbackRating === 'helpful' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Mark as helpful"
                  aria-label="Helpful"
                >
                  <ThumbsUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectRating('unhelpful')}
                  disabled={feedbackStatus === 'submitting'}
                  className={`p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer ${
                    feedbackRating === 'unhelpful' ? 'text-rose-600 bg-rose-50 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Mark as unhelpful"
                  aria-label="Not helpful"
                >
                  <ThumbsDown size={13} />
                </button>
              </div>
            )}

            {/* Optional Comment Input */}
            {showCommentBox && feedbackStatus !== 'submitted' && (
              <form onSubmit={handleSubmitFeedback} className="flex items-center gap-1.5 mt-1 max-w-sm">
                <input
                  type="text"
                  placeholder="Optional reason (e.g. clarity, specifics)..."
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  maxLength={500}
                  className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={feedbackStatus === 'submitting'}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {feedbackStatus === 'submitting' ? 'Saving...' : 'Send'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCommentBox(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  title="Close"
                >
                  <X size={13} />
                </button>
              </form>
            )}

            {feedbackErrorMsg && (
              <span className="text-[11px] text-rose-500">{feedbackErrorMsg}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

