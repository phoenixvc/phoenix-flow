import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export function checklistRouter(pool: Pool): Router {
  const router = Router({ mergeParams: true });

  router.post('/', async (req: Request, res: Response) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    try {
      const result = await pool.query(`
        INSERT INTO checklist_items (task_id, text, sort_order)
        VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM checklist_items WHERE task_id = $1))
        RETURNING *
      `, [req.params.id, text]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to add checklist item' });
    }
  });

  router.put('/:itemId', async (req: Request, res: Response) => {
    const { done, text } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (done !== undefined) { sets.push(`done = $${idx++}`); params.push(done); }
    if (text !== undefined) { sets.push(`text = $${idx++}`); params.push(text); }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.params.itemId);
    try {
      const result = await pool.query(
        `UPDATE checklist_items SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update checklist item' });
    }
  });

  router.delete('/:itemId', async (req: Request, res: Response) => {
    try {
      await pool.query('DELETE FROM checklist_items WHERE id = $1 AND task_id = $2', [req.params.itemId, req.params.id]);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete checklist item' });
    }
  });

  return router;
}
