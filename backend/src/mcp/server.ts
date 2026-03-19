import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response, Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';

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
    // Fail closed: if MCP_SECRET is not configured, reject all requests
    const secret = process.env.MCP_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'MCP_SECRET not configured — endpoint disabled' });
    }
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const server = new McpServer({ name: 'phoenix-flow', version: '1.0.0' });

    server.tool('list_projects', {}, async () => {
      try {
        const rows = await pool.query('SELECT * FROM projects ORDER BY created_at ASC');
        return { content: [{ type: 'text', text: JSON.stringify(rows.rows, null, 2) }] };
      } catch (err) { return mcpError('list_projects', err); }
    });

    server.tool('list_tasks', {
      projectId: z.string().optional(),
      status: z.enum(['todo', 'inprogress', 'done']).optional(),
      search: z.string().optional(),
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

    server.tool('get_task', { taskId: z.string() }, async ({ taskId }) => {
      try {
        const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        const notFound = requireRows('get_task', task.rows, 'Task');
        if ('isError' in notFound) return notFound;
        const checklist = await pool.query('SELECT * FROM checklist_items WHERE task_id = $1 ORDER BY sort_order ASC', [taskId]);
        const messages = await pool.query('SELECT * FROM agent_messages WHERE task_id = $1 ORDER BY created_at ASC', [taskId]);
        return { content: [{ type: 'text', text: JSON.stringify({ ...task.rows[0], checklistItems: checklist.rows, agentMessages: messages.rows }, null, 2) }] };
      } catch (err) { return mcpError('get_task', err, { taskId }); }
    });

    server.tool('create_task', {
      projectId: z.string(),
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      isAiTask: z.boolean().optional(),
      agentId: z.string().optional(),
      agentName: z.string().optional(),
    }, async ({ projectId, title, description, priority, isAiTask, agentId, agentName }) => {
      try {
        const result = await pool.query(`
          INSERT INTO tasks (project_id, title, description, priority, is_ai_task, agent_id, agent_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `, [projectId, title, description || null, priority || 'medium', isAiTask || false, agentId || null, agentName || null]);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows[0], null, 2) }] };
      } catch (err) { return mcpError('create_task', err, { projectId, title }); }
    });

    server.tool('update_task', {
      taskId: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      status: z.enum(['todo', 'inprogress', 'done']).optional(),
      agentId: z.string().optional(),
      agentName: z.string().optional(),
    }, async ({ taskId, ...fields }) => {
      try {
        const colMap: Record<string, string> = {
          title: 'title', description: 'description', priority: 'priority',
          status: 'status', agentId: 'agent_id', agentName: 'agent_name',
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

    server.tool('move_task', {
      taskId: z.string(),
      status: z.enum(['todo', 'inprogress', 'done']),
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

    server.tool('add_checklist_item', { taskId: z.string(), text: z.string() }, async ({ taskId, text }) => {
      try {
        const result = await pool.query(`
          INSERT INTO checklist_items (task_id, text, sort_order)
          VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM checklist_items WHERE task_id = $1))
          RETURNING *
        `, [taskId, text]);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows[0], null, 2) }] };
      } catch (err) { return mcpError('add_checklist_item', err, { taskId }); }
    });

    server.tool('complete_checklist_item', { itemId: z.string() }, async ({ itemId }) => {
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

    server.tool('log_agent_message', {
      fromAgent: z.string(),
      message: z.string(),
      agentId: z.string().optional(),
      taskId: z.string().optional(),
      projectId: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
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

    server.tool('get_deep_link', { resourceType: z.string(), resourceId: z.string() }, async ({ resourceType, resourceId }) => {
      try {
        const slug = `${resourceType}-${resourceId.slice(0, 8)}`;
        await pool.query(`
          INSERT INTO deep_links (resource_type, resource_id, slug) VALUES ($1, $2, $3)
          ON CONFLICT (slug) DO NOTHING
        `, [resourceType, resourceId, slug]);
        return { content: [{ type: 'text', text: JSON.stringify({ slug, url: `/link/${slug}` }) }] };
      } catch (err) { return mcpError('get_deep_link', err, { resourceType, resourceId }); }
    });

    server.tool('search_tasks', { query: z.string(), projectId: z.string().optional() }, async ({ query, projectId }) => {
      try {
        const params: unknown[] = [`%${query}%`];
        const projectFilter = projectId ? `AND project_id = $2` : '';
        if (projectId) params.push(projectId);
        const result = await pool.query(
          `SELECT * FROM tasks WHERE title ILIKE $1 ${projectFilter} ORDER BY created_at DESC LIMIT 20`,
          params
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      } catch (err) { return mcpError('search_tasks', err, { query, projectId }); }
    });

    server.tool('sync_repo_yaml', { projectId: z.string() }, async ({ projectId }) => {
      return { content: [{ type: 'text', text: `Trigger sync via POST /api/projects/${projectId}/sync-yaml` }] };
    });

    server.tool('get_yaml_source', { projectId: z.string() }, async ({ projectId }) => {
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
