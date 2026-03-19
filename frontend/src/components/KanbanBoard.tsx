import React, { useState } from 'react';
import type { Task, Status, Priority } from '../types';
import { TaskCard } from './TaskCard';
import { TaskDetail } from './TaskDetail';
import { AddTaskForm } from './AddTaskForm';

const COLUMNS: { status: Status; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'inprogress', label: 'In Progress' },
  { status: 'done', label: 'Done' },
];

interface Props {
  tasks: Task[];
  projectId: string | null;
  onCreateTask: (data: { title: string; priority: Priority; isAiTask: boolean; status: Status }) => Promise<void>;
  onUpdateTask: (id: string, data: Partial<Task>) => Promise<void>;
  onMoveTask: (id: string, status: Status) => Promise<void>;
}

export function KanbanBoard({ tasks, projectId, onCreateTask, onUpdateTask, onMoveTask }: Props) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [addingTo, setAddingTo] = useState<Status | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Status | null>(null);

  const byStatus = (status: Status) => tasks.filter(t => t.status === status);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    setDraggingId(taskId);
  };

  const handleDrop = async (e: React.DragEvent, status: Status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    setDragOverStatus(null);
    if (!taskId) { setDraggingId(null); return; }
    try {
      await onMoveTask(taskId, status);
    } catch (err) {
      console.error('[KanbanBoard] Failed to move task', { taskId, status, err: String(err) });
    } finally {
      setDraggingId(null);
    }
  };

  const handleDragOver = (e: React.DragEvent, status: Status) => {
    e.preventDefault();
    setDragOverStatus(status);
  };

  if (!projectId) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-700">
        <div className="text-center">
          <div className="text-4xl mb-3">🔥</div>
          <p className="text-sm">Select a project to view the board</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
        {COLUMNS.map(({ status, label }) => {
          const columnTasks = byStatus(status);
          const isDragTarget = dragOverStatus === status;

          return (
            <div
              key={status}
              className={`flex flex-col w-72 flex-shrink-0 rounded-xl border transition-colors duration-150
                ${isDragTarget ? 'border-amber-500/30 bg-amber-500/5' : 'border-[#1a1a1a] bg-[#090909]'}`}
              onDrop={e => handleDrop(e, status)}
              onDragOver={e => handleDragOver(e, status)}
              onDragLeave={() => setDragOverStatus(null)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-400">{label}</span>
                  <span className="text-[10px] text-zinc-700 bg-[#111] border border-[#1f1f1f] rounded-full px-1.5 py-0.5">
                    {columnTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => setAddingTo(addingTo === status ? null : status)}
                  className="text-zinc-600 hover:text-amber-500 text-sm transition-colors w-6 h-6 flex items-center justify-center rounded hover:bg-amber-500/10"
                >
                  +
                </button>
              </div>

              {/* Add form */}
              {addingTo === status && (
                <div className="px-2 pb-2">
                  <AddTaskForm
                    status={status}
                    projectId={projectId}
                    onSubmit={async ({ title, priority, isAiTask }) => {
                      await onCreateTask({ title, priority, isAiTask, status });
                      setAddingTo(null);
                    }}
                    onCancel={() => setAddingTo(null)}
                  />
                </div>
              )}

              {/* Task cards */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                {columnTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => setSelectedTask(task)}
                    onDragStart={e => handleDragStart(e, task.id)}
                  />
                ))}
                {columnTasks.length === 0 && !isDragTarget && (
                  <div className="text-center py-8 text-zinc-800 text-xs">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (id, data) => {
            await onUpdateTask(id, data);
            setSelectedTask(prev => prev ? { ...prev, ...data } : null);
          }}
        />
      )}
    </>
  );
}
