import React, { useState } from 'react';
import type { Task, Priority } from '../types';

type ActionState = 'idle' | 'loading' | 'success' | 'error';

interface ActionResult {
  breakdown?: string[];
  description?: string;
  priority?: Priority;
  message?: string;
}

interface Props {
  task: Task;
  onChecklistAdd?: (text: string) => void;
  onDescriptionUpdate?: (desc: string) => void;
  onPriorityUpdate?: (priority: Priority) => void;
}

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function callAI(endpoint: string, body: object): Promise<ActionResult> {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 404) throw new Error('AI features not yet available');
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}

function ActionButton({
  label,
  icon,
  state,
  onClick,
  resultPreview,
}: {
  label: string;
  icon: string;
  state: ActionState;
  onClick: () => void;
  resultPreview?: string;
}) {
  const isLoading = state === 'loading';
  const isSuccess = state === 'success';
  const isError = state === 'error';

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={onClick}
        disabled={isLoading}
        className={`
          relative flex items-center gap-2 px-3 py-2 rounded text-xs font-medium
          transition-all duration-150 border
          ${isLoading
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-not-allowed'
            : isSuccess
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : isError
            ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/15'
            : 'bg-[#111] border-[#2a2a2a] text-zinc-400 hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/5'
          }
        `}
      >
        {isLoading ? (
          <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
        ) : (
          <span className="text-base leading-none">{icon}</span>
        )}
        <span>{isLoading ? 'Working…' : isSuccess ? 'Done' : isError ? 'Try again' : label}</span>
        {isLoading && (
          <span className="absolute inset-0 rounded ring-1 ring-amber-500/20 animate-pulse pointer-events-none" />
        )}
      </button>
      {resultPreview && (
        <div className={`text-[10px] px-2 py-1 rounded bg-[#0a0a0a] border border-[#1a1a1a] leading-relaxed
          ${isSuccess ? 'text-emerald-400' : 'text-zinc-500'}`}>
          {resultPreview}
        </div>
      )}
    </div>
  );
}

export function AIActions({ task, onChecklistAdd, onDescriptionUpdate, onPriorityUpdate }: Props) {
  const [breakdownState, setBreakdownState] = useState<ActionState>('idle');
  const [draftState, setDraftState] = useState<ActionState>('idle');
  const [priorityState, setPriorityState] = useState<ActionState>('idle');

  const [breakdownPreview, setBreakdownPreview] = useState('');
  const [draftPreview, setDraftPreview] = useState('');
  const [priorityPreview, setPriorityPreview] = useState('');

  const reset = (setter: (s: ActionState) => void) => {
    setTimeout(() => setter('idle'), 3000);
  };

  const handleBreakdown = async () => {
    setBreakdownState('loading');
    setBreakdownPreview('');
    try {
      const result = await callAI('/api/ai/breakdown', { taskId: task.id, title: task.title, description: task.description });
      const subtasks = result.breakdown || [];
      setBreakdownPreview(`Generated ${subtasks.length} subtasks`);
      subtasks.forEach(text => onChecklistAdd?.(text));
      setBreakdownState('success');
    } catch (e) {
      setBreakdownPreview(e instanceof Error ? e.message : 'Error');
      setBreakdownState('error');
    } finally {
      reset(setBreakdownState);
    }
  };

  const handleDraft = async () => {
    setDraftState('loading');
    setDraftPreview('');
    try {
      const result = await callAI('/api/ai/draft-description', { taskId: task.id, title: task.title });
      if (result.description) {
        onDescriptionUpdate?.(result.description);
        setDraftPreview(result.description.slice(0, 80) + (result.description.length > 80 ? '…' : ''));
      }
      setDraftState('success');
    } catch (e) {
      setDraftPreview(e instanceof Error ? e.message : 'Error');
      setDraftState('error');
    } finally {
      reset(setDraftState);
    }
  };

  const handlePriority = async () => {
    setPriorityState('loading');
    setPriorityPreview('');
    try {
      const result = await callAI('/api/ai/suggest-priority', { taskId: task.id, title: task.title, description: task.description });
      if (result.priority) {
        onPriorityUpdate?.(result.priority);
        setPriorityPreview(`Suggested: ${result.priority}`);
      }
      setPriorityState('success');
    } catch (e) {
      setPriorityPreview(e instanceof Error ? e.message : 'Error');
      setPriorityState('error');
    } finally {
      reset(setPriorityState);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">AI Actions</span>
        <div className="flex-1 h-px bg-[#1f1f1f]" />
        <span className="text-[10px] text-zinc-700">claude-sonnet-4-6</span>
      </div>
      <ActionButton
        label="Break Down"
        icon="🧩"
        state={breakdownState}
        onClick={handleBreakdown}
        resultPreview={breakdownPreview}
      />
      <ActionButton
        label="Draft Desc"
        icon="✍️"
        state={draftState}
        onClick={handleDraft}
        resultPreview={draftPreview}
      />
      <ActionButton
        label="Suggest Priority"
        icon="🎯"
        state={priorityState}
        onClick={handlePriority}
        resultPreview={priorityPreview}
      />
    </div>
  );
}
