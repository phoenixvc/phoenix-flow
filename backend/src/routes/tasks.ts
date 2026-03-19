import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

const VALID_STATUSES = new Set(['todo', 'inprogress', 'done']);
const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);

export function tasksRouter(pool: Pool): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const { projectId, status, search } = req.query;

    if (status && !VALID_STATUSES.has(status as string)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (projectId) { conditions.push(`t.project_id = $${idx++}`); params.push(projectId); }
    if (status) { conditions.push(`t.status = $${idx++}`); params.push(status); }
    if (search) { conditions.push(`t.title ILIKE $${idx++}`); params.push(`%${search}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
      const result = await pool.query(`
        SELECT t.*,
          COUNT(ci.id) AS checklist_total,
          COUNT(ci.id) FILTER (WHERE ci.done) AS checklist_done,
          COUNT(am.id) AS agent_message_count
        FROM tasks t
        LEFT JOIN checklist_items ci ON ci.task_id = t.id
        LEFT JOIN agent_messages am ON am.task_id = t.id
        ${where}
        GROUP BY t.id
        ORDER BY t.created_at ASC
      `, params);
      res.json(result.rows);
    } catch (err) {
      console.error('[tasks:GET /] Failed to list tasks', { projectId, status, err: String(err) });
      res.status(500).json({ error: 'Failed to list tasks' });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    const { projectId, title, description, priority, status, isAiTask, agentId, agentName } = req.body;
    if (!projectId || !title) return res.status(400).json({ error: 'projectId and title required' });

    if (priority && !VALID_PRIORITIES.has(priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }
    if (status && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const createdByUser = req.user?.sub || null;

    try {
      const result = await pool.query(`
        INSERT INTO tasks (project_id, title, description, priority, status, is_ai_task, agent_id, agent_name, created_by_user)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [projectId, title, description || null, priority || 'medium', status || 'todo',
          isAiTask || false, agentId || null, agentName || null, createdByUser]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('[tasks:POST /] Failed to create task', { projectId, title, err: String(err) });
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
      if (!task.rows.length) return res.status(404).json({ error: 'Not found' });
      const checklist = await pool.query('SELECT * FROM checklist_items WHERE task_id = $1 ORDER BY sort_order ASC', [req.params.id]);
      const messages = await pool.query('SELECT * FROM agent_messages WHERE task_id = $1 ORDER BY created_at ASC', [req.params.id]);
      res.json({ ...task.rows[0], checklistItems: checklist.rows, agentMessages: messages.rows });
    } catch (err) {
      console.error('[tasks:GET /:id] Failed to get task', { id: req.params.id, err: String(err) });
      res.status(500).json({ error: 'Failed to get task' });
    }
  });

  router.put('/:id', async (req: Request, res: Response) => {
    const body = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.priority && !VALID_PRIORITIES.has(body.priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }
    if (body.status && !VALID_STATUSES.has(body.status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const colMap: Record<string, string> = {
      title: 'title', description: 'description', priority: 'priority',
      status: 'status', isAiTask: 'is_ai_task', agentId: 'agent_id', agentName: 'agent_name'
    };

    for (const [key, col] of Object.entries(colMap)) {
      if (key in body) { sets.push(`${col} = $${idx++}`); params.push(body[key]); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

    sets.push(`updated_at = now()`);
    params.push(req.params.id);

    try {
      const result = await pool.query(
        `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[tasks:PUT /:id] Failed to update task', { id: req.params.id, err: String(err) });
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.status(204).send();
    } catch (err) {
      console.error('[tasks:DELETE /:id] Failed to delete task', { id: req.params.id, err: String(err) });
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  router.post('/:id/move', async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    try {
      const result = await pool.query(
        'UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
        [status, req.params.id]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[tasks:POST /:id/move] Failed to move task', { id: req.params.id, status, err: String(err) });
      res.status(500).json({ error: 'Failed to move task' });
    }
  });

  return router;
}
