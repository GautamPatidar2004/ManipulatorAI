import React, { useEffect, useState } from 'react';
import {
  Brain,
  X,
  Trash2,
  Edit2,
  Check,
  Plus,
  Shield,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../api/client';
import type { UserMemoryRecord } from '../../types/chat';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({ isOpen, onClose }) => {
  const [memories, setMemories] = useState<UserMemoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // New Fact Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState('education');

  // Clear confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadMemories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listMemories();
      setMemories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memory facts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // oxlint-disable-next-line react/set-state-in-effect
      void loadMemories();
    }
  }, [isOpen]);

  const handleStartEdit = (m: UserMemoryRecord) => {
    setEditingId(m.id);
    setEditValue(m.value);
  };

  const handleSaveEdit = async (m: UserMemoryRecord) => {
    if (!editValue.trim()) return;
    try {
      const updated = await api.updateMemory(m.id, { value: editValue.trim() });
      setMemories((prev) => prev.map((item) => (item.id === m.id ? updated : item)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update memory.');
    }
  };

  const handleDelete = async (memoryId: string) => {
    try {
      await api.deleteMemory(memoryId);
      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to forget memory.');
    }
  };

  const handleForgetAll = async () => {
    try {
      await api.forgetAllMemories();
      setMemories([]);
      setShowClearConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear all memories.');
    }
  };

  const handleAddFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    try {
      const created = await api.createMemory({
        key: newKey.trim(),
        value: newValue.trim(),
        category: newCategory,
      });
      setMemories((prev) => [created, ...prev]);
      setNewKey('');
      setNewValue('');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create memory fact.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="memory-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Brain size={18} />
            </div>
            <div>
              <h2 id="memory-modal-title" className="text-sm font-bold text-slate-900">
                Persistent Profile Memory
              </h2>
              <p className="text-[11px] text-slate-500">
                Contextual facts remembered across sessions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 px-5 overflow-y-auto space-y-3.5 flex-1">
          {/* Privacy Notice Banner */}
          <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2 text-xs text-slate-700">
            <Shield size={15} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              These facts are used to guide career discovery without repetitive questions. You maintain full ownership: you can correct or delete any fact below.
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Add Fact Toggle / Form */}
          {!showAddForm ? (
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs font-semibold text-slate-700">
                Active Facts ({memories.length})
              </span>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Fact</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleAddFact} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="font-semibold text-slate-800">Declare Context Fact</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Key (e.g. education_level)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="education">Education</option>
                  <option value="career_goals">Career Goals</option>
                  <option value="skills">Skills</option>
                  <option value="constraints">Constraints</option>
                  <option value="interests">Interests</option>
                  <option value="preferences">Preferences</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Value (e.g. 12th PCM, Software Engineering)"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded cursor-pointer"
                >
                  Save Fact
                </button>
              </div>
            </form>
          )}

          {/* Facts List */}
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading profile memory...</div>
          ) : memories.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              No persistent facts saved yet. CareerCompass AI automatically remembers education, target roles, and constraints as you chat.
            </div>
          ) : (
            <div className="space-y-2">
              {memories.map((m) => (
                <div
                  key={m.id}
                  className="p-3 bg-white border border-slate-200 rounded-xl text-xs hover:border-slate-300 transition-colors shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-slate-900 capitalize">
                      {m.key.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                        {m.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">v{m.version}</span>
                    </div>
                  </div>

                  {editingId === m.id ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(m)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                        title="Save correction"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                        title="Cancel"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-between gap-2 mt-1">
                      <p className="text-slate-700 font-medium leading-normal break-words">
                        {m.value}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(m)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                          title="Correct fact"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Forget fact"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 px-5 border-t border-slate-200 bg-slate-50/70 shrink-0 flex items-center justify-between text-xs">
          {memories.length > 0 && !showClearConfirm ? (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Forget All Memory</span>
            </button>
          ) : showClearConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Delete all facts?</span>
              <button
                type="button"
                onClick={handleForgetAll}
                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded text-[11px] cursor-pointer"
              >
                Yes, Forget
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="text-slate-500 hover:underline text-[11px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
