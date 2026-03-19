import React from 'react';
import type { Task } from '../types';
import { AgentIdentityBadge } from './AgentIdentityBadge';

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

interface Props {
  task: Task;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

export function TaskCard({ task, onClick, onDragStart }: Props) {
  const checklistTotal = task.checklist_total ?? 0;
  const checklistDone = task.checklist_done ?? 0;
  const hasChecklist = checklistTotal > 0;
  const progress = hasChecklist ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-lg p-3 cursor-pointer
        hover:border-amber-500/30 hover:bg-[#0f0f0f] transition-all duration-150
        active:scale-[0.98] group"
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />
        <p className="text-sm text-zinc-200 leading-snug flex-1">{task.title}</p>
        {task.is_ai_task && (
          <span className="text-[10px] font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5 flex-shrink-0">
            🤖 AI
          </span>
        )}
      </div>

      {/* Agent identity */}
      {task.agent_id && task.agent_name && (
        <div className="mb-2">
          <AgentIdentityBadge agentId={task.agent_id} agentName={task.agent_name} size="sm" />
        </div>
      )}

      {/* Checklist progress */}
      {hasChecklist && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-600">{checklistDone}/{checklistTotal} done</span>
          </div>
          <div className="h-0.5 bg-[#1f1f1f] rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      {(task.agent_message_count ?? 0) > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-zinc-600">
          <span>💬</span>
          <span>{task.agent_message_count} agent {task.agent_message_count === 1 ? 'message' : 'messages'}</span>
        </div>
      )}
    </div>
  );
}
