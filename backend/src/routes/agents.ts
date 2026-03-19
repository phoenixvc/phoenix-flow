import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export function agentsRouter(pool: Pool): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const { taskId, projectId } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (taskId) { conditions.push(`task_id = $${idx++}`); params.push(taskId); }
    if (projectId) { conditions.push(`project_id = $${idx++}`); params.push(projectId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
      const result = await pool.query(
        `SELECT * FROM agent_messages ${where} ORDER BY created_at ASC`,
        params
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to list agent messages' });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    const { fromAgent, agentId, message, taskId, projectId, metadata } = req.body;
    if (!fromAgent || !message) return res.status(400).json({ error: 'fromAgent and message required' });
    try {
      const result = await pool.query(`
        INSERT INTO agent_messages (from_agent, agent_id, message, task_id, project_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [fromAgent, agentId || null, message, taskId || null, projectId || null, metadata ? JSON.stringify(metadata) : null]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to log agent message' });
    }
  });

  return router;
}
