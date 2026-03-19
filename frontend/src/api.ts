import type { Project, Task, ChecklistItem, AgentMessage, DeepLink, Priority, Status } from './types';
import { getAuthHeaders } from './auth';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Projects
export const getProjects = () => req<Project[]>('/api/projects');
export const createProject = (data: { name: string; color?: string; repoUrl?: string }) =>
  req<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) });
export const deleteProject = (id: string) =>
  req<void>(`/api/projects/${id}`, { method: 'DELETE' });
export const syncYaml = (projectId: string) =>
  req<{ synced: boolean; upserted: number }>(`/api/projects/${projectId}/sync-yaml`, { method: 'POST' });

// Tasks
export const getTasks = (params: { projectId?: string; status?: Status; search?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.projectId) qs.set('projectId', params.projectId);
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  return req<Task[]>(`/api/tasks?${qs}`);
};
export const getTask = (id: string) => req<Task>(`/api/tasks/${id}`);
export const createTask = (data: {
  projectId: string; title: string; description?: string;
  priority?: Priority; status?: Status; isAiTask?: boolean;
  agentId?: string; agentName?: string;
}) => req<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) });
export const updateTask = (id: string, data: Partial<{
  title: string; description: string; priority: Priority;
  status: Status; isAiTask: boolean; agentId: string; agentName: string;
}>) => req<Task>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const moveTask = (id: string, status: Status) =>
  req<Task>(`/api/tasks/${id}/move`, { method: 'POST', body: JSON.stringify({ status }) });
export const deleteTask = (id: string) =>
  req<void>(`/api/tasks/${id}`, { method: 'DELETE' });

// Checklist
export const addChecklistItem = (taskId: string, text: string) =>
  req<ChecklistItem>(`/api/tasks/${taskId}/checklist`, { method: 'POST', body: JSON.stringify({ text }) });
export const toggleChecklistItem = (taskId: string, itemId: string, done: boolean) =>
  req<ChecklistItem>(`/api/tasks/${taskId}/checklist/${itemId}`, { method: 'PUT', body: JSON.stringify({ done }) });
export const deleteChecklistItem = (taskId: string, itemId: string) =>
  req<void>(`/api/tasks/${taskId}/checklist/${itemId}`, { method: 'DELETE' });

// Agent messages
export const getAgentMessages = (params: { taskId?: string; projectId?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.taskId) qs.set('taskId', params.taskId);
  if (params.projectId) qs.set('projectId', params.projectId);
  return req<AgentMessage[]>(`/api/agent-messages?${qs}`);
};
export const logAgentMessage = (data: {
  fromAgent: string; message: string; agentId?: string;
  taskId?: string; projectId?: string; metadata?: Record<string, unknown>;
}) => req<AgentMessage>('/api/agent-messages', { method: 'POST', body: JSON.stringify(data) });

// Deep links
export const createDeepLink = (data: { resourceType: string; resourceId: string; slug?: string }) =>
  req<DeepLink>('/api/deep-links', { method: 'POST', body: JSON.stringify(data) });
export const resolveDeepLink = (slug: string) => req<DeepLink>(`/api/deep-links/${slug}`);
