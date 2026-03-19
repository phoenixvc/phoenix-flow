import React, { useState } from 'react';
import type { Project } from '../types';

interface Props {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (data: { name: string; color: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const PRESET_COLORS = ['#f59e0b', '#a78bfa', '#34d399', '#60a5fa', '#f87171', '#fb923c'];

export function Sidebar({ projects, selectedId, onSelect, onCreate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#f59e0b');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate({ name: name.trim(), color });
      setName('');
      setAdding(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="w-52 flex-shrink-0 border-r border-[#1a1a1a] bg-[#080808] flex flex-col">
      <div className="px-3 pt-4 pb-2">
        <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">Projects</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {projects.map(p => (
          <div
            key={p.id}
            className={`flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer group transition-colors
              ${selectedId === p.id ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#111]'}`}
            onClick={() => onSelect(p.id)}
          >
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-sm flex-1 truncate">{p.name}</span>
            {p.task_count !== undefined && (
              <span className="text-[10px] text-zinc-700">{p.task_count}</span>
            )}
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-[#1a1a1a]">
        {adding ? (
          <form onSubmit={handleCreate} className="space-y-2">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Project name"
              className="w-full bg-[#111] border border-[#2a2a2a] rounded text-xs text-zinc-300 placeholder-zinc-600 px-2 py-1.5 outline-none focus:border-amber-500/40"
            />
            <div className="flex gap-1">
              {PRESET_COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setAdding(false)} className="flex-1 text-xs text-zinc-600 hover:text-zinc-400 py-1">Cancel</button>
              <button type="submit" disabled={!name.trim() || loading} className="flex-1 text-xs bg-amber-500 disabled:opacity-40 text-black font-medium py-1 rounded">
                {loading ? '…' : 'Create'}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full text-xs text-zinc-600 hover:text-zinc-400 py-1.5 flex items-center justify-center gap-1.5 hover:bg-[#111] rounded transition-colors"
          >
            <span>+</span> New project
          </button>
        )}
      </div>
    </aside>
  );
}
