import React, { useEffect, useRef, useState } from 'react';
import type { AgentMessage } from '../types';
import { agentColor, agentInitials, formatRelativeTime, truncateId } from '../utils';
import * as api from '../api';

interface Props {
  taskId: string;
  initialMessages?: AgentMessage[];
}

const POLL_INTERVAL_MS = 10_000;
const MAX_CONSECUTIVE_FAILURES = 3;

export function AgentActivityLog({ taskId, initialMessages = [] }: Props) {
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const failureCount = useRef(0);

  useEffect(() => {
    // Reset failure count when taskId changes; AbortController prevents stale updates
    failureCount.current = 0;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await api.getAgentMessages({ taskId });
        if (!cancelled) {
          setMessages(data);
          failureCount.current = 0;
        }
      } catch (err) {
        failureCount.current++;
        if (failureCount.current <= MAX_CONSECUTIVE_FAILURES) {
          console.warn('[AgentActivityLog] Poll failed', { taskId, attempt: failureCount.current, err: String(err) });
        }
        // Stop logging after threshold to avoid console spam; polling continues silently
      }
    };

    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [taskId]);

  if (!messages.length) {
    return (
      <div className="text-zinc-600 text-sm py-3 text-center">
        No agent activity yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map(msg => {
        const id = msg.agent_id || msg.from_agent;
        const color = agentColor(id);
        const initials = agentInitials(msg.from_agent);

        return (
          <div key={msg.id} className="flex gap-2.5 group">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
              style={{ backgroundColor: color, color: '#080808' }}
            >
              {initials || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-xs font-medium text-zinc-200">{msg.from_agent}</span>
                {msg.agent_id && (
                  <span className="font-mono text-[10px] text-zinc-600">{truncateId(msg.agent_id)}</span>
                )}
                <span className="text-[10px] text-zinc-600">{formatRelativeTime(msg.created_at)}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed break-words">{msg.message}</p>
              {msg.metadata && (
                <details className="mt-1">
                  <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-400">metadata</summary>
                  <pre className="text-[10px] text-zinc-500 bg-[#0a0a0a] rounded p-2 mt-1 overflow-x-auto">
                    {typeof msg.metadata === 'string' ? msg.metadata : JSON.stringify(msg.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
