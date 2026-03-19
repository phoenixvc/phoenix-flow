import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export function linksRouter(pool: Pool): Router {
  const router = Router();

  router.get('/:slug', async (req: Request, res: Response) => {
    try {
      const result = await pool.query('SELECT * FROM deep_links WHERE slug = $1', [req.params.slug]);
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[links:GET /:slug] Failed to resolve link', { slug: req.params.slug, err: String(err) });
      res.status(500).json({ error: 'Failed to resolve link' });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    const { resourceType, resourceId, slug } = req.body;
    if (!resourceType || !resourceId) return res.status(400).json({ error: 'resourceType and resourceId required' });
    const finalSlug = slug || `${resourceType}-${resourceId.slice(0, 8)}`;
    try {
      // DO NOTHING on conflict — never overwrite an existing link's target
      const result = await pool.query(`
        INSERT INTO deep_links (resource_type, resource_id, slug)
        VALUES ($1, $2, $3)
        ON CONFLICT (slug) DO NOTHING
        RETURNING *
      `, [resourceType, resourceId, finalSlug]);

      if (!result.rows.length) {
        // Slug already exists — return the existing link
        const existing = await pool.query('SELECT * FROM deep_links WHERE slug = $1', [finalSlug]);
        return res.status(200).json(existing.rows[0]);
      }
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('[links:POST /] Failed to create deep link', { resourceType, resourceId, err: String(err) });
      res.status(500).json({ error: 'Failed to create deep link' });
    }
  });

  return router;
}
