import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

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
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const project = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
      if (!project.rows.length) return res.status(404).json({ error: 'Not found' });
      const tasks = await pool.query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at ASC', [req.params.id]);
      res.json({ ...project.rows[0], tasks: tasks.rows });
    } catch (err) {
      res.status(500).json({ error: 'Failed to get project' });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
      res.status(204).send();
    } catch (err) {
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

      // Parse owner/repo from GitHub URL
      const match = repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return res.status(400).json({ error: 'Invalid GitHub repo URL' });
      const [, owner, repo] = match;

      const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3.raw' };
      let upserted = 0;

      for (const filename of ['.todo.yaml', '.roadmap.yaml', '.task.yaml']) {
        const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filename}`, { headers });
        if (!fileRes.ok) continue;

        const content = await fileRes.text();
        const tasks = parseYamlTasks(content);

        for (const task of tasks) {
          await pool.query(`
            INSERT INTO tasks (project_id, title, description, priority, status, is_ai_task, source_file)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT DO NOTHING
          `, [req.params.id, task.title, task.description || null,
              mapPriority(task.priority), mapStatus(task.status),
              task.is_ai_task || false, filename]);
          upserted++;
        }
      }

      res.json({ synced: true, upserted });
    } catch (err) {
      res.status(500).json({ error: 'Sync failed', detail: String(err) });
    }
  });

  return router;
}

function parseYamlTasks(yaml: string): Array<Record<string, unknown>> {
  // Simple YAML task parser — handles the phoenixvc YAML format
  const tasks: Array<Record<string, unknown>> = [];
  const lines = yaml.split('\n');
  let current: Record<string, unknown> | null = null;

  for (const line of lines) {
    const titleMatch = line.match(/^\s+-\s+title:\s+"?(.+?)"?\s*$/);
    if (titleMatch) {
      if (current) tasks.push(current);
      current = { title: titleMatch[1] };
      continue;
    }
    if (!current) continue;
    const kvMatch = line.match(/^\s+(\w+):\s+"?(.+?)"?\s*$/);
    if (kvMatch) current[kvMatch[1]] = kvMatch[2];
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
