import React, { useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { KanbanBoard } from './components/KanbanBoard';
import { useProjects } from './hooks/useProjects';
import { useTasks } from './hooks/useTasks';
import type { Status, Priority } from './types';

export default function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { projects, loading: projectsLoading, createProject, deleteProject, syncYaml } = useProjects();
  const { tasks, createTask, updateTask, moveTask } = useTasks({ projectId: selectedProjectId || undefined, search: search || undefined });

  // Auto-select first project
  React.useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const handleSync = async () => {
    if (!selectedProjectId) return;
    setSyncing(true);
    try {
      await syncYaml(selectedProjectId);
    } finally {
      setSyncing(false);
    }
  };

  if (projectsLoading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-amber-500 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#080808] flex flex-col overflow-hidden">
      <Header
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        search={search}
        onSearch={setSearch}
        onSync={handleSync}
        syncing={syncing}
      />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <Sidebar
            projects={projects}
            selectedId={selectedProjectId}
            onSelect={setSelectedProjectId}
            onCreate={createProject}
            onDelete={deleteProject}
          />
        )}
        <main className="flex-1 overflow-hidden flex flex-col">
          <KanbanBoard
            tasks={tasks}
            projectId={selectedProjectId}
            onCreateTask={async ({ title, priority, isAiTask, status }) => {
              if (!selectedProjectId) return;
              await createTask({ projectId: selectedProjectId, title, priority, isAiTask, status });
            }}
            onUpdateTask={updateTask}
            onMoveTask={moveTask}
          />
        </main>
      </div>
    </div>
  );
}
