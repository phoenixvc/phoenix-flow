const AGENT_COLORS = [
  '#f59e0b', // amber
  '#a78bfa', // violet
  '#34d399', // emerald
  '#60a5fa', // blue
  '#f87171', // red
  '#fb923c', // orange
  '#a3e635', // lime
  '#38bdf8', // sky
];

export function agentColor(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

export function agentInitials(agentName: string): string {
  return agentName
    .split(/[\s-_]+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function truncateId(id: string, len = 8): string {
  return id.slice(0, len);
}
