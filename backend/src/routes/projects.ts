import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

const FETCH_TIMEOUT_MS = 10_000;

export function projectsRouter(pool: Pool): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT p.*, COUNT(t.id) AS task_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at ASC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('[projects:GET /] Failed to list projects', { err: String(err) });
      res.status(500).json({ error: 'Failed to list projects' });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    const { name, color, repoUrl } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
      const result = await pool.query(
        `INSERT INTO projects (name, color, repo_url) VALUES ($1, $2, $3) RETURNING *`,
        [name, color || '#f59e0b', repoUrl || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('[projects:POST /] Failed to create project', { name, err: String(err) });
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const project = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
      if (!project.rows.length) return res.status(404).json({ error: 'Not found' });
      const tasks = await pool.query(
        'SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at ASC',
        [req.params.id]
      );
      res.json({ ...project.rows[0], tasks: tasks.rows });
    } catch (err) {
      console.error('[projects:GET /:id] Failed to get project', { id: req.params.id, err: String(err) });
      res.status(500).json({ error: 'Failed to get project' });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.status(204).send();
    } catch (err) {
      console.error('[projects:DELETE /:id] Failed to delete project', { id: req.params.id, err: String(err) });
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  router.post('/:id/sync-yaml', async (req: Request, res: Response) => {
    try {
      const project = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
      if (!project.rows.length) return res.status(404).json({ error: 'Not found' });

      const { repo_url } = project.rows[0];
      if (!repo_url) return res.status(400).json({ error: 'No repo_url configured' });

      const token = process.env.GITHUB_TOKEN;
      if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

      const match = repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return res.status(400).json({ error: 'Invalid GitHub repo URL' });
      const [, owner, repo] = match;

      const headers = {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3.raw',
      };

      let upserted = 0;
      const skipped: string[] = [];

      for (const filename of ['.todo.yaml', '.roadmap.yaml', '.task.yaml']) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        let fileRes: Response;
        try {
          // @ts-expect-error — fetch signal type compatibility
          fileRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`,
            { headers, signal: controller.signal }
          );
        } catch (fetchErr) {
          clearTimeout(timeout);
          const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError';
          console.warn(`[sync-yaml] fetch ${isAbort ? 'timed out' : 'failed'}`, { filename, owner, repo, err: String(fetchErr) });
          skipped.push(`${filename}: ${isAbort ? 'timeout' : 'network error'}`);
          continue;
        }
        clearTimeout(timeout);

        if (!fileRes.ok) {
          console.warn('[sync-yaml] GitHub returned non-OK', { filename, status: fileRes.status, owner, repo });
          skipped.push(`${filename}: HTTP ${fileRes.status}`);
          continue;
        }

        const content = await (fileRes as unknown as globalThis.Response).text();
        const tasks = parseYamlTasks(content);

        for (const task of tasks) {
          try {
            await pool.query(`
              INSERT INTO tasks (project_id, title, description, priority, status, is_ai_task, source_file)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [req.params.id, task.title, task.description || null,
                mapPriority(task.priority), mapStatus(task.status),
                task.is_ai_task || false, filename]);
            upserted++;
          } catch (insertErr) {
            console.warn('[sync-yaml] Failed to insert task', { title: task.title, err: String(insertErr) });
          }
        }
      }

      res.json({ synced: true, upserted, skipped: skipped.length ? skipped : undefined });
    } catch (err) {
      console.error('[projects:POST /:id/sync-yaml] Sync failed', { id: req.params.id, err: String(err) });
      res.status(500).json({ error: 'Sync failed' });
    }
  });

  return router;
}

function parseYamlTasks(yaml: string): Array<Record<string, string | boolean>> {
  const ALLOWED_KEYS = new Set(['title', 'description', 'priority', 'status', 'is_ai_task', 'notes', 'tags']);
  const tasks: Array<Record<string, string | boolean>> = [];
  const lines = yaml.split('\n');
  let current: Record<string, string | boolean> | null = null;

  for (const line of lines) {
    const titleMatch = line.match(/^\s+-\s+title:\s+"?(.+?)"?\s*$/);
    if (titleMatch) {
      if (current) tasks.push(current);
      current = { title: titleMatch[1] };
      continue;
    }
    if (!current) continue;
    const kvMatch = line.match(/^\s+(\w+):\s+"?(.+?)"?\s*$/);
    if (kvMatch) {
      const key = kvMatch[1];
      // Only allow known safe keys — prevent prototype pollution
      if (ALLOWED_KEYS.has(key)) {
        current[key] = kvMatch[2];
      }
    }
  }
  if (current) tasks.push(current);
  return tasks;
}

function mapPriority(p: unknown): string {
  if (p === 'critical') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'medium';
}

function mapStatus(s: unknown): string {
  if (s === 'inprogress' || s === 'in_progress') return 'inprogress';
  if (s === 'done') return 'done';
  return 'todo';
}
