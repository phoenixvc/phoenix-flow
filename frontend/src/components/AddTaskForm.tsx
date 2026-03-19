import React, { useState, useEffect, useRef } from 'react';
import type { Priority, Status } from '../types';

interface Props {
  status: Status;
  projectId: string;
  onSubmit: (data: { title: string; priority: Priority; isAiTask: boolean }) => Promise<void>;
  onCancel: () => void;
}

export function AddTaskForm({ status, projectId, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [isAiTask, setIsAiTask] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ title: title.trim(), priority, isAiTask });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#0d0d0d] border border-amber-500/30 rounded-lg p-3 space-y-2">
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Task title…"
        className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none"
      />
      <div className="flex items-center gap-2">
        <select
          value={priority}
          onChange={e => setPriority(e.target.value as Priority)}
          className="bg-[#111] border border-[#2a2a2a] rounded text-xs text-zinc-400 px-2 py-1 outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAiTask}
            onChange={e => setIsAiTask(e.target.checked)}
            className="accent-violet-500"
          />
          🤖 AI task
        </label>
        <div className="flex-1" />
        <button type="button" onClick={onCancel} className="text-xs text-zinc-600 hover:text-zinc-400 px-2 py-1">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || loading}
          className="text-xs bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-medium px-3 py-1 rounded transition-colors"
        >
          {loading ? '…' : 'Add'}
        </button>
      </div>
    </form>
  );
}
