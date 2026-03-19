import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../types';
import * as api from '../api';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

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
    setMutationError(null);
    try {
      const p = await api.createProject(data);
      setProjects(prev => [...prev, p]);
      return p;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create project';
      setMutationError(msg);
      throw e;
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    setMutationError(null);
    try {
      await api.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete project';
      setMutationError(msg);
      throw e;
    }
  }, []);

  const syncYaml = useCallback(async (projectId: string) => {
    setMutationError(null);
    try {
      const result = await api.syncYaml(projectId);
      await fetch();
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to sync YAML';
      setMutationError(msg);
      throw e;
    }
  }, [fetch]);

  return { projects, loading, error, mutationError, createProject, deleteProject, syncYaml, refetch: fetch };
}
