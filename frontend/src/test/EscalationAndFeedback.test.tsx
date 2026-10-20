import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageItem } from '../components/Chat/MessageItem';
import { api } from '../api/client';
import type { ChatMessage } from '../types/chat';

const mockAssistantMessage: ChatMessage = {
  id: 'msg_asst_1',
  sessionId: 'sess_1',
  role: 'assistant',
  content: 'Here is tailored guidance for your career transition to Cloud Engineering.',
  timestamp: '2026-10-10T12:00:00Z',
  status: 'ready',
};

const mockUserMessage: ChatMessage = {
  id: 'msg_user_1',
  sessionId: 'sess_1',
  role: 'user',
  content: 'I want to know about Cloud Engineering.',
  timestamp: '2026-10-10T11:59:00Z',
  status: 'ready',
};

describe('Message-Level Feedback & Escalation UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders feedback controls on assistant messages but not on user messages', () => {
    const { rerender } = render(<MessageItem message={mockUserMessage} />);
    expect(screen.queryByTitle('Mark as helpful')).toBeNull();
    expect(screen.queryByTitle('Mark as unhelpful')).toBeNull();

    rerender(<MessageItem message={mockAssistantMessage} />);
    expect(screen.getByTitle('Mark as helpful')).toBeDefined();
    expect(screen.getByTitle('Mark as unhelpful')).toBeDefined();
  });

  it('opens optional comment box when a rating is clicked', () => {
    render(<MessageItem message={mockAssistantMessage} />);

    // Click Helpful
    const helpfulBtn = screen.getByTitle('Mark as helpful');
    fireEvent.click(helpfulBtn);

    // Comment box and Send button should now be visible
    expect(screen.getByPlaceholderText(/Optional reason/i)).toBeDefined();
    expect(screen.getByText('Send')).toBeDefined();
  });

  it('submits helpful feedback successfully and prevents duplicates', async () => {
    const submitSpy = vi.spyOn(api, 'submitMessageFeedback').mockResolvedValue({
      id: 'fb_1',
      message_id: 'msg_asst_1',
      conversation_id: 'sess_1',
      user_id: 'default_user',
      rating: 'helpful',
      comment: 'Very clear guidance',
      created_at: '2026-10-10T12:01:00Z',
    });

    render(<MessageItem message={mockAssistantMessage} />);

    // Click helpful
    fireEvent.click(screen.getByTitle('Mark as helpful'));

    // Type optional comment
    const commentInput = screen.getByPlaceholderText(/Optional reason/i);
    fireEvent.change(commentInput, { target: { value: 'Very clear guidance' } });

    // Submit
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith('msg_asst_1', 'helpful', 'Very clear guidance');
      expect(screen.getByText('Thank you for your feedback!')).toBeDefined();
    });

    // Feedback buttons should no longer be interactive
    expect(screen.queryByTitle('Mark as helpful')).toBeNull();
  });

  it('displays error message if feedback submission fails', async () => {
    vi.spyOn(api, 'submitMessageFeedback').mockRejectedValue(new Error('Feedback already recorded.'));

    render(<MessageItem message={mockAssistantMessage} />);

    fireEvent.click(screen.getByTitle('Mark as unhelpful'));
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Feedback already recorded.')).toBeDefined();
    });
  });

  it('calls onActionClick when escalation quick reply is triggered', () => {
    const actionSpy = vi.fn();
    const escalationMsg: ChatMessage = {
      ...mockAssistantMessage,
      structured: {
        type: 'response',
        blocks: [
          {
            type: 'quick_replies',
            options: [
              {
                label: 'Talk to Human Counsellor',
                payload: 'escalation:accept',
                category: 'support',
              },
            ],
          },
        ],
      },
    };

    render(<MessageItem message={escalationMsg} onActionClick={actionSpy} />);

    const escButton = screen.getByText('Talk to Human Counsellor');
    fireEvent.click(escButton);

    expect(actionSpy).toHaveBeenCalledWith('escalation:accept');
  });
});
