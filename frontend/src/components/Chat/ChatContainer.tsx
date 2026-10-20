import React from 'react';
import type { ChatMessage } from '../../types/chat';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { EmptyState } from './EmptyState';
import { ErrorBanner } from '../Common/ErrorBanner';

interface ChatContainerProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (content: string) => void;
  onRetry?: () => void;
  onDismissError?: () => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  isLoading,
  error,
  onSendMessage,
  onRetry,
  onDismissError,
}) => {
  return (
    <main className="flex-1 flex flex-col min-h-0 relative bg-slate-50">
      {error && (
        <div className="p-3 sm:px-6 pt-3 shrink-0">
          <ErrorBanner
            message={error}
            onRetry={onRetry}
            onDismiss={onDismissError}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto flex flex-col">
        {messages.length === 0 ? (
          <EmptyState
            onSelectPrompt={onSendMessage}
            disabled={isLoading}
          />
        ) : (
          <MessageList
            messages={messages}
            isLoading={isLoading}
            onSendMessage={onSendMessage}
          />
        )}
      </div>

      <MessageComposer
        onSendMessage={onSendMessage}
        isLoading={isLoading}
      />
    </main>
  );
};
