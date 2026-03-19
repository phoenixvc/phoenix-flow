import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../types';
import * as api from '../api';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createProject = useCallback(async (data: { name: string; color?: string; repoUrl?: string }) => {
    const p = await api.createProject(data);
    setProjects(prev => [...prev, p]);
    return p;
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await api.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  const syncYaml = useCallback(async (projectId: string) => {
    const result = await api.syncYaml(projectId);
    await fetch();
    return result;
  }, [fetch]);

  return { projects, loading, error, createProject, deleteProject, syncYaml, refetch: fetch };
}
