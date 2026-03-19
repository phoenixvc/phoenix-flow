export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Status = 'todo' | 'inprogress' | 'done';

export interface Project {
  id: string;
  name: string;
  color: string;
  yaml_writeback_enabled: boolean;
  repo_url: string | null;
  created_at: string;
  task_count?: number;
}

export interface ChecklistItem {
  id: string;
  task_id: string;
  text: string;
  done: boolean;
  sort_order: number;
  created_at: string;
}

export interface AgentMessage {
  id: string;
  task_id: string | null;
  project_id: string | null;
  from_agent: string;
  agent_id: string | null;
  message: string;
  metadata: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: Status;
  is_ai_task: boolean;
  source_file: string | null;
  source_line: number | null;
  agent_id: string | null;
  agent_name: string | null;
  created_at: string;
  updated_at: string;
  // aggregated fields from list query
  checklist_total?: number;
  checklist_done?: number;
  agent_message_count?: number;
  // detail fields
  checklistItems?: ChecklistItem[];
  agentMessages?: AgentMessage[];
}

export interface DeepLink {
  id: string;
  resource_type: string;
  resource_id: string;
  slug: string;
  created_at: string;
}
