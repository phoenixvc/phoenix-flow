import React, { useState } from 'react';
import { agentColor, agentInitials, truncateId } from '../utils';

interface Props {
  agentId: string;
  agentName: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AgentIdentityBadge({ agentId, agentName, size = 'md' }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const color = agentColor(agentId);
  const initials = agentInitials(agentName);

  const sizeClasses = {
    sm: { avatar: 'w-4 h-4 text-[8px]', text: 'text-xs', gap: 'gap-1' },
    md: { avatar: 'w-5 h-5 text-[10px]', text: 'text-xs', gap: 'gap-1.5' },
    lg: { avatar: 'w-7 h-7 text-xs', text: 'text-sm', gap: 'gap-2' },
  }[size];

  return (
    <div
      className={`relative inline-flex items-center ${sizeClasses.gap} cursor-default`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`${sizeClasses.avatar} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
        style={{ backgroundColor: color, color: '#080808' }}
      >
        {initials || '?'}
      </div>
      <span className={`${sizeClasses.text} text-zinc-300 leading-none`}>{agentName}</span>
      <span className={`${sizeClasses.text} font-mono text-zinc-500 leading-none`}>{truncateId(agentId)}</span>

      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-1.5 z-50 bg-[#1f1f1f] border border-[#2a2a2a] rounded px-2.5 py-1.5 shadow-lg whitespace-nowrap">
          <div className="text-xs text-zinc-400 mb-0.5">Agent ID</div>
          <div className="font-mono text-xs text-amber-400">{agentId}</div>
        </div>
      )}
    </div>
  );
}
