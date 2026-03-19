import { useState, useEffect, useCallback } from 'react';
import type { Task, Status, Priority } from '../types';
import * as api from '../api';

interface UseTasksParams {
  projectId?: string;
  search?: string;
}

export function useTasks({ projectId, search }: UseTasksParams = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTasks({ projectId, search });
      setTasks(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [projectId, search]);

  useEffect(() => { fetch(); }, [fetch]);

  const createTask = useCallback(async (data: Parameters<typeof api.createTask>[0]) => {
    setMutationError(null);
    try {
      const t = await api.createTask(data);
      setTasks(prev => [...prev, t]);
      return t;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create task';
      setMutationError(msg);
      throw e;
    }
  }, []);

  const updateTask = useCallback(async (id: string, data: Parameters<typeof api.updateTask>[1]) => {
    setMutationError(null);
    try {
      const t = await api.updateTask(id, data);
      setTasks(prev => prev.map(task => task.id === id ? { ...task, ...t } : task));
      return t;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update task';
      setMutationError(msg);
      throw e;
    }
  }, []);

  const moveTask = useCallback(async (id: string, status: Status) => {
    setMutationError(null);
    try {
      const t = await api.moveTask(id, status);
      setTasks(prev => prev.map(task => task.id === id ? { ...task, status } : task));
      return t;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to move task';
      setMutationError(msg);
      throw e;
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setMutationError(null);
    try {
      await api.deleteTask(id);
      setTasks(prev => prev.filter(task => task.id !== id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete task';
      setMutationError(msg);
      throw e;
    }
  }, []);

  return { tasks, loading, error, mutationError, createTask, updateTask, moveTask, deleteTask, refetch: fetch };
}
