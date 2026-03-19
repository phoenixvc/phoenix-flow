import React, { useState, useEffect, useRef } from 'react';
import type { Task, Priority, ChecklistItem } from '../types';
import { AgentActivityLog } from './AgentActivityLog';
import { AgentIdentityBadge } from './AgentIdentityBadge';
import { AIActions } from './AIActions';
import * as api from '../api';
import { truncateId } from '../utils';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-green-400', medium: 'text-amber-400', high: 'text-orange-400', critical: 'text-red-400',
};

interface Props {
  task: Task;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Task>) => Promise<void>;
}

export function TaskDetail({ task: initialTask, onClose, onUpdate }: Props) {
  const [task, setTask] = useState<Task>(initialTask);
  const [loading, setLoading] = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Load full task detail
  useEffect(() => {
    api.getTask(initialTask.id).then(t => setTask(t)).catch(() => {});
  }, [initialTask.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (editTitle) titleInputRef.current?.focus();
  }, [editTitle]);

  const save = async (updates: Partial<Task>) => {
    const merged = { ...task, ...updates };
    setTask(merged);
    await onUpdate(task.id, updates);
  };

  const handleTitleBlur = async () => {
    setEditTitle(false);
    if (title !== task.title) await save({ title });
  };

  const handleDescriptionBlur = async () => {
    if (description !== (task.description || '')) await save({ description });
  };

  const handleToggleChecklist = async (item: ChecklistItem) => {
    const updated = !item.done;
    await api.toggleChecklistItem(task.id, item.id, updated);
    setTask(t => ({
      ...t,
      checklistItems: t.checklistItems?.map(ci => ci.id === item.id ? { ...ci, done: updated } : ci),
    }));
  };

  const handleAddChecklist = async (text: string) => {
    if (!text.trim()) return;
    const item = await api.addChecklistItem(task.id, text.trim());
    setTask(t => ({ ...t, checklistItems: [...(t.checklistItems || []), item] }));
    setNewChecklistItem('');
  };

  const checklist = task.checklistItems || [];
  const messages = task.agentMessages || [];
  const total = checklist.length;
  const done = checklist.filter(c => c.done).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-[#1a1a1a]">
          <div className="flex-1 min-w-0">
            {editTitle ? (
              <input
                ref={titleInputRef}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={e => { if (e.key === 'Enter') handleTitleBlur(); }}
                className="w-full text-lg font-medium text-zinc-100 bg-transparent border-b border-amber-500/50 outline-none pb-0.5"
              />
            ) : (
              <h2
                className="text-lg font-medium text-zinc-100 cursor-text hover:text-amber-400 transition-colors"
                onClick={() => setEditTitle(true)}
              >
                {task.title}
              </h2>
            )}
            {task.is_ai_task && (
              <span className="inline-block mt-1 text-[10px] font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5">
                🤖 AI Task
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 text-xl leading-none mt-0.5">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={task.priority}
              onChange={e => save({ priority: e.target.value as Priority })}
              className={`bg-[#111] border border-[#2a2a2a] rounded text-xs px-2 py-1 outline-none ${PRIORITY_COLORS[task.priority]}`}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select
              value={task.status}
              onChange={e => save({ status: e.target.value as Task['status'] })}
              className="bg-[#111] border border-[#2a2a2a] rounded text-xs text-zinc-400 px-2 py-1 outline-none"
            >
              <option value="todo">Todo</option>
              <option value="inprogress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Agent ownership */}
          {task.agent_id && task.agent_name && (
            <div className="bg-[#111] border border-[#1f1f1f] rounded-lg p-3">
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Owned by agent</div>
              <AgentIdentityBadge agentId={task.agent_id} agentName={task.agent_name} size="md" />
            </div>
          )}

          {/* Description */}
          <div>
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Description</div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add a description…"
              rows={3}
              className="w-full bg-[#111] border border-[#1f1f1f] rounded-lg text-sm text-zinc-300 placeholder-zinc-700 px-3 py-2 outline-none focus:border-amber-500/30 resize-none"
            />
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
                Checklist {total > 0 && <span className="text-zinc-500">{done}/{total}</span>}
              </div>
              {total > 0 && (
                <div className="h-0.5 w-24 bg-[#1f1f1f] rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.round(done/total*100)}%` }} />
                </div>
              )}
            </div>
            <div className="space-y-1.5 mb-2">
              {checklist.map(item => (
                <label key={item.id} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => handleToggleChecklist(item)}
                    className="accent-amber-500"
                  />
                  <span className={`text-sm ${item.done ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>{item.text}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newChecklistItem}
                onChange={e => setNewChecklistItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddChecklist(newChecklistItem); }}
                placeholder="Add item…"
                className="flex-1 bg-[#111] border border-[#1f1f1f] rounded text-xs text-zinc-400 placeholder-zinc-700 px-2.5 py-1.5 outline-none focus:border-amber-500/30"
              />
              <button
                onClick={() => handleAddChecklist(newChecklistItem)}
                className="text-xs text-amber-500 hover:text-amber-400 px-2"
              >+</button>
            </div>
          </div>

          {/* AI Actions */}
          <AIActions
            task={task}
            onChecklistAdd={text => handleAddChecklist(text)}
            onDescriptionUpdate={desc => { setDescription(desc); save({ description: desc }); }}
            onPriorityUpdate={priority => save({ priority })}
          />

          {/* Agent Activity Log */}
          <div>
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3">Agent Activity</div>
            <AgentActivityLog taskId={task.id} initialMessages={messages} />
          </div>
        </div>
      </div>
    </div>
  );
}
