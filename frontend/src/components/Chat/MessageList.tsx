import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../types/chat';
import { MessageItem } from './MessageItem';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage?: (content: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  onSendMessage,
}) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Deduplicate messages by ID to guarantee each message renders exactly once
  const uniqueMessages = React.useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((msg) => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });
  }, [messages]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-4xl w-full mx-auto" role="log" aria-live="polite">
      {uniqueMessages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          onActionClick={onSendMessage}
        />
      ))}
      {isLoading && <TypingIndicator />}
      <div ref={scrollEndRef} className="h-px" aria-hidden="true" />
    </div>
  );
};
