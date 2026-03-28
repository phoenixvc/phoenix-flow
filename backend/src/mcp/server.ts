// @ts-nocheck — McpServer generic inference in SDK 1.27.1 exhausts tsc heap.
// Tracked: upgrade-mcp-sdk-1.28 in .todo.yaml
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response, Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { callOrgTool } from './orgClient.js';

function mcpError(tool: string, err: unknown, context: Record<string, unknown> = {}) {
  console.error(`[MCP:${tool}] Error`, { ...context, err: String(err) });
  return { content: [{ type: 'text' as const, text: `Tool error: ${String(err)}` }], isError: true };
}

function requireRows<T>(tool: string, rows: T[], label = 'Resource'): T | { isError: true; content: { type: 'text'; text: string }[] } {
  if (!rows.length) {
    console.warn(`[MCP:${tool}] ${label} not found`);
    return { isError: true, content: [{ type: 'text' as const, text: `${label} not found` }] };
  }
  return rows[0];
}

export function mcpRouter(pool: Pool): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const secret = process.env.MCP_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'MCP_SECRET not configured — endpoint disabled' });
    }
    if (req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const server = new McpServer({ name: 'phoenix-flow', version: '1.0.0' });

    server.registerTool('list_projects', {
      description: 'List all projects',
      inputSchema: z.object({}),
    }, async () => {
      try {
        const rows = await pool.query('SELECT * FROM projects ORDER BY created_at ASC');
        return { content: [{ type: 'text', text: JSON.stringify(rows.rows, null, 2) }] };
      } catch (err) { return mcpError('list_projects', err); }
    });

    server.registerTool('list_tasks', {
      description: 'List tasks with optional filters',
      inputSchema: z.object({
        projectId: z.string().optional(),
        status: z.enum(['todo', 'inprogress', 'done']).optional(),
        search: z.string().optional(),
      }),
    }, async ({ projectId, status, search }) => {
      try {
        const conditions: string[] = [];
        const params: unknown[] = [];
        let idx = 1;
        if (projectId) { conditions.push(`project_id = $${idx++}`); params.push(projectId); }
        if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
        if (search) { conditions.push(`title ILIKE $${idx++}`); params.push(`%${search}%`); }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const rows = await pool.query(`SELECT * FROM tasks ${where} ORDER BY created_at ASC`, params);
        return { content: [{ type: 'text', text: JSON.stringify(rows.rows, null, 2) }] };
      } catch (err) { return mcpError('list_tasks', err, { projectId, status, search }); }
    });

    server.registerTool('get_task', {
      description: 'Get a single task with its checklist and agent messages',
      inputSchema: z.object({ taskId: z.string() }),
    }, async ({ taskId }) => {
      try {
        const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        const notFound = requireRows('get_task', task.rows, 'Task');
        if ('isError' in notFound) return notFound;
        const checklist = await pool.query('SELECT * FROM checklist_items WHERE task_id = $1 ORDER BY sort_order ASC', [taskId]);
        const messages = await pool.query('SELECT * FROM agent_messages WHERE task_id = $1 ORDER BY created_at ASC', [taskId]);
        return { content: [{ type: 'text', text: JSON.stringify({ ...task.rows[0], checklistItems: checklist.rows, agentMessages: messages.rows }, null, 2) }] };
      } catch (err) { return mcpError('get_task', err, { taskId }); }
    });

    server.registerTool('create_task', {
      description: 'Create a new task in a project',
      inputSchema: z.object({
        projectId: z.string(),
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        isAiTask: z.boolean().optional(),
        agentId: z.string().optional(),
        agentName: z.string().optional(),
        controlledBy: z.string().optional(),
        context: z.string().optional(),
        traceId: z.string().optional(),
        triggeredBy: z.string().optional(),
      }),
    }, async ({ projectId, title, description, priority, isAiTask, agentId, agentName,
                controlledBy, context, traceId, triggeredBy }) => {
      try {
        const result = await pool.query(`
          INSERT INTO tasks (project_id, title, description, priority, is_ai_task, agent_id, agent_name,
                             controlled_by, context, trace_id, triggered_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
        `, [projectId, title, description || null, priority || 'medium', isAiTask || false,
            agentId || null, agentName || null,
            controlledBy || null, context || null, traceId || null, triggeredBy || null]);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows[0], null, 2) }] };
      } catch (err) { return mcpError('create_task', err, { projectId, title }); }
    });

    server.registerTool('update_task', {
      description: 'Update fields on an existing task',
      inputSchema: z.object({
        taskId: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        status: z.enum(['todo', 'inprogress', 'done']).optional(),
        agentId: z.string().optional(),
        agentName: z.string().optional(),
        controlledBy: z.string().optional(),
        context: z.string().optional(),
        traceId: z.string().optional(),
        triggeredBy: z.string().optional(),
      }),
    }, async ({ taskId, ...fields }) => {
      try {
        const colMap: Record<string, string> = {
          title: 'title', description: 'description', priority: 'priority',
          status: 'status', agentId: 'agent_id', agentName: 'agent_name',
          controlledBy: 'controlled_by', context: 'context', traceId: 'trace_id', triggeredBy: 'triggered_by',
        };
        const sets: string[] = [];
        const params: unknown[] = [];
        let idx = 1;
        for (const [key, col] of Object.entries(colMap)) {
          if (key in fields && (fields as Record<string, unknown>)[key] !== undefined) {
            sets.push(`${col} = $${idx++}`);
            params.push((fields as Record<string, unknown>)[key]);
          }
        }
        if (!sets.length) return { content: [{ type: 'text', text: 'No fields to update' }], isError: true };
        sets.push('updated_at = now()');
        params.push(taskId);
        const result = await pool.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
        const notFound = requireRows('update_task', result.rows, 'Task');
        if ('isError' in notFound) return notFound;
        return { content: [{ type: 'text', text: JSON.stringify(result.rows[0], null, 2) }] };
      } catch (err) { return mcpError('update_task', err, { taskId }); }
    });

    server.registerTool('move_task', {
      description: 'Move a task to a different status column',
      inputSchema: z.object({
        taskId: z.string(),
        status: z.enum(['todo', 'inprogress', 'done']),
      }),
    }, async ({ taskId, status }) => {
      try {
        const result = await pool.query(
          'UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
          [status, taskId]
        );
        const notFound = requireRows('move_task', result.rows, 'Task');
        if ('isError' in notFound) return notFound;
        return { content: [{ type: 'text', text: JSON.stringify(result.rows[0], null, 2) }] };
      } catch (err) { return mcpError('move_task', err, { taskId, status }); }
    });

    server.registerTool('add_checklist_item', {
      description: 'Add a checklist item to a task',
      inputSchema: z.object({ taskId: z.string(), text: z.string() }),
    }, async ({ taskId, text }) => {
      try {
        const result = await pool.query(`
          INSERT INTO checklist_items (task_id, text, sort_order)
          VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM checklist_items WHERE task_id = $1))
          RETURNING *
        `, [taskId, text]);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows[0], null, 2) }] };
      } catch (err) { return mcpError('add_checklist_item', err, { taskId }); }
    });

    server.registerTool('complete_checklist_item', {
      description: 'Mark a checklist item as done',
      inputSchema: z.object({ itemId: z.string() }),
    }, async ({ itemId }) => {
      try {
        const result = await pool.query(
          'UPDATE checklist_items SET done = true WHERE id = $1 RETURNING *',
          [itemId]
        );
        const notFound = requireRows('complete_checklist_item', result.rows, 'Checklist item');
        if ('isError' in notFound) return notFound;
        return { content: [{ type: 'text', text: JSON.stringify(result.rows[0], null, 2) }] };
      } catch (err) { return mcpError('complete_checklist_item', err, { itemId }); }
    });

    server.registerTool('log_agent_message', {
      description: 'Log an agent interaction to the audit trail',
      inputSchema: z.object({
        fromAgent: z.string(),
        message: z.string(),
        agentId: z.string().optional(),
        taskId: z.string().optional(),
        projectId: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    }, async ({ fromAgent, message, agentId, taskId, projectId, metadata }) => {
      try {
        const result = await pool.query(`
          INSERT INTO agent_messages (from_agent, agent_id, message, task_id, project_id, metadata)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [fromAgent, agentId || null, message, taskId || null, projectId || null,
            metadata ? JSON.stringify(metadata) : null]);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows[0], null, 2) }] };
      } catch (err) { return mcpError('log_agent_message', err, { fromAgent, taskId }); }
    });

    server.registerTool('get_deep_link', {
      description: 'Get or create a short slug deep link for a resource',
      inputSchema: z.object({ resourceType: z.string(), resourceId: z.string() }),
    }, async ({ resourceType, resourceId }) => {
      try {
        const slug = `${resourceType}-${resourceId.slice(0, 8)}`;
        await pool.query(`
          INSERT INTO deep_links (resource_type, resource_id, slug) VALUES ($1, $2, $3)
          ON CONFLICT (slug) DO NOTHING
        `, [resourceType, resourceId, slug]);
        return { content: [{ type: 'text', text: JSON.stringify({ slug, url: `/link/${slug}` }) }] };
      } catch (err) { return mcpError('get_deep_link', err, { resourceType, resourceId }); }
    });

    server.registerTool('search_tasks', {
      description: 'Search tasks by title across a project or all projects',
      inputSchema: z.object({ query: z.string(), projectId: z.string().optional() }),
    }, async ({ query, projectId }) => {
      try {
        const params: unknown[] = [`%${query}%`];
        const projectFilter = projectId ? `AND project_id = $2` : '';
        if (projectId) params.push(projectId);
        const result = await pool.query(
          `SELECT * FROM tasks WHERE (title ILIKE $1 OR context ILIKE $1) ${projectFilter} ORDER BY created_at DESC LIMIT 20`,
          params
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      } catch (err) { return mcpError('search_tasks', err, { query, projectId }); }
    });

    server.registerTool('sync_repo_yaml', {
      description: 'Trigger a YAML sync for a project (delegates to REST endpoint)',
      inputSchema: z.object({ projectId: z.string() }),
    }, async ({ projectId }) => {
      return { content: [{ type: 'text', text: `Trigger sync via POST /api/projects/${projectId}/sync-yaml` }] };
    });

    // --- Org-level passthrough tools (delegate to mcp-org) ---

    server.registerTool('get_org_roadmap', {
      description: 'Get the org-level roadmap from mcp-org',
      inputSchema: z.object({ status: z.string().optional() }),
    }, async (args) => callOrgTool('get_org_roadmap', args));

    server.registerTool('list_org_projects', {
      description: 'List all projects registered in the org',
      inputSchema: z.object({}),
    }, async () => callOrgTool('list_projects'));

    server.registerTool('search_org_tasks', {
      description: 'Search tasks across all projects in the org',
      inputSchema: z.object({ query: z.string(), projectId: z.string().optional() }),
    }, async (args) => callOrgTool('search_org_tasks', args));

    server.registerTool('get_org_health', {
      description: 'Get org health summary — task counts, sync status, stale projects',
      inputSchema: z.object({}),
    }, async () => callOrgTool('get_org_health'));

    server.registerTool('get_yaml_source', {
      description: 'Get the repo URL for a project\'s YAML source',
      inputSchema: z.object({ projectId: z.string() }),
    }, async ({ projectId }) => {
      try {
        const result = await pool.query('SELECT repo_url FROM projects WHERE id = $1', [projectId]);
        if (!result.rows.length) {
          return { content: [{ type: 'text', text: `Project ${projectId} not found` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ projectId, repoUrl: result.rows[0].repo_url }) }] };
      } catch (err) { return mcpError('get_yaml_source', err, { projectId }); }
    });

    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('[MCP] Unhandled error in MCP request handler', { err: String(err) });
      if (!res.headersSent) {
        res.status(500).json({ error: 'MCP handler failed' });
      }
    }
  });

  return router;
}
