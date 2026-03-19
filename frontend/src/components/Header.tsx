import React from 'react';
import type { Project } from '../types';

interface Props {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  search: string;
  onSearch: (q: string) => void;
  onSync: () => void;
  syncing: boolean;
}

export function Header({ projects, selectedProjectId, onSelectProject, search, onSearch, onSync, syncing }: Props) {
  const selected = projects.find(p => p.id === selectedProjectId);

  return (
    <header className="h-12 border-b border-[#1a1a1a] flex items-center gap-3 px-4 bg-[#080808] flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <span className="text-amber-500 text-lg">🔥</span>
        <span className="text-sm font-semibold text-zinc-200 tracking-tight">phoenix-flow</span>
      </div>

      <div className="w-px h-4 bg-[#2a2a2a]" />

      {/* Project selector */}
      <select
        value={selectedProjectId || ''}
        onChange={e => onSelectProject(e.target.value)}
        className="bg-transparent text-sm text-zinc-400 outline-none border-none cursor-pointer"
      >
        <option value="" disabled>Select project</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Search */}
      <div className="flex-1 max-w-xs ml-2">
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search tasks…"
          className="w-full bg-[#111] border border-[#1f1f1f] rounded-md text-xs text-zinc-300 placeholder-zinc-600 px-3 py-1.5 outline-none focus:border-amber-500/30"
        />
      </div>

      <div className="flex-1" />

      {/* Sync button */}
      {selectedProjectId && (
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-amber-400 px-2 py-1.5 rounded hover:bg-amber-500/5 transition-colors disabled:opacity-40"
        >
          <span className={syncing ? 'animate-spin' : ''}>⟳</span>
          {syncing ? 'Syncing…' : 'Sync YAML'}
        </button>
      )}
    </header>
  );
}
