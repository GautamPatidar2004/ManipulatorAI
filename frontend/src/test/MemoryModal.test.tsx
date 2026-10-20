import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryModal } from '../components/Memory/MemoryModal';
import { api } from '../api/client';
import type { UserMemoryRecord } from '../types/chat';

const mockMemories: UserMemoryRecord[] = [
  {
    id: 'mem_1',
    user_id: 'default_user',
    key: 'education_level',
    value: '12th Standard Science (PCM)',
    category: 'education',
    source: 'extracted_conversation',
    confidence: 0.95,
    version: 1,
    is_active: true,
    created_at: '2026-10-10T12:00:00Z',
    updated_at: '2026-10-10T12:00:00Z',
  },
  {
    id: 'mem_2',
    user_id: 'default_user',
    key: 'target_role',
    value: 'Cloud DevOps Engineer',
    category: 'career_goals',
    source: 'extracted_conversation',
    confidence: 0.92,
    version: 2,
    is_active: true,
    created_at: '2026-10-10T12:00:00Z',
    updated_at: '2026-10-10T12:15:00Z',
  },
];

describe('MemoryModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<MemoryModal isOpen={false} onClose={() => {}} />);
    expect(screen.queryByText('Persistent Profile Memory')).toBeNull();
  });

  it('renders and loads memory facts when opened', async () => {
    vi.spyOn(api, 'listMemories').mockResolvedValue(mockMemories);

    render(<MemoryModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('Persistent Profile Memory')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText('12th Standard Science (PCM)')).toBeDefined();
      expect(screen.getByText('Cloud DevOps Engineer')).toBeDefined();
    });
  });

  it('shows empty state when no memories are saved', async () => {
    vi.spyOn(api, 'listMemories').mockResolvedValue([]);

    render(<MemoryModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/No persistent facts saved yet/i)).toBeDefined();
    });
  });

  it('allows inline editing of a memory fact', async () => {
    vi.spyOn(api, 'listMemories').mockResolvedValue(mockMemories);
    const updateSpy = vi.spyOn(api, 'updateMemory').mockResolvedValue({
      ...mockMemories[0],
      value: '12th Science CBSE 94%',
      version: 2,
    });

    render(<MemoryModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('12th Standard Science (PCM)')).toBeDefined();
    });

    // Click edit button for the first memory
    const editButtons = screen.getAllByTitle('Correct fact');
    fireEvent.click(editButtons[0]);

    // Input field should now be present
    const editInput = screen.getByDisplayValue('12th Standard Science (PCM)');
    fireEvent.change(editInput, { target: { value: '12th Science CBSE 94%' } });

    // Click save button
    const saveButton = screen.getByTitle('Save correction');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('mem_1', { value: '12th Science CBSE 94%' });
      expect(screen.getByText('12th Science CBSE 94%')).toBeDefined();
    });
  });

  it('allows deleting/forgetting an individual fact', async () => {
    vi.spyOn(api, 'listMemories').mockResolvedValue(mockMemories);
    const deleteSpy = vi.spyOn(api, 'deleteMemory').mockResolvedValue(undefined);

    render(<MemoryModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('12th Standard Science (PCM)')).toBeDefined();
    });

    // Click delete button
    const deleteButtons = screen.getAllByTitle('Forget fact');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('mem_1');
      expect(screen.queryByText('12th Standard Science (PCM)')).toBeNull();
    });
  });

  it('supports forget all memories with confirmation', async () => {
    vi.spyOn(api, 'listMemories').mockResolvedValue(mockMemories);
    const forgetAllSpy = vi.spyOn(api, 'forgetAllMemories').mockResolvedValue({
      forgotten_count: 2,
      message: 'Cleared',
      user_id: 'default_user',
    });

    render(<MemoryModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('12th Standard Science (PCM)')).toBeDefined();
    });

    // Click "Forget All Memory"
    const clearButton = screen.getByText('Forget All Memory');
    fireEvent.click(clearButton);

    // Confirmation text appears
    expect(screen.getByText('Delete all facts?')).toBeDefined();

    // Confirm action
    const confirmButton = screen.getByText('Yes, Forget');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(forgetAllSpy).toHaveBeenCalled();
      expect(screen.getByText(/No persistent facts saved yet/i)).toBeDefined();
    });
  });
});
