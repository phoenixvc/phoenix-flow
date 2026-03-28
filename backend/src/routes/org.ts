import { Router, Request, Response } from 'express';
import { callOrgTool } from '../mcp/orgClient.js';

const router = Router();

// GET /api/org/roadmap
router.get('/roadmap', async (_req: Request, res: Response) => {
  const result = await callOrgTool('get_org_roadmap');
  if (result.isError) return res.status(502).json({ error: result.content[0]?.text });
  try {
    res.json(JSON.parse(result.content[0].text));
  } catch {
    res.json({ raw: result.content[0].text });
  }
});

// GET /api/org/projects
router.get('/projects', async (_req: Request, res: Response) => {
  const result = await callOrgTool('list_projects');
  if (result.isError) return res.status(502).json({ error: result.content[0]?.text });
  try {
    res.json(JSON.parse(result.content[0].text));
  } catch {
    res.json({ raw: result.content[0].text });
  }
});

// GET /api/org/tasks?query=...
router.get('/tasks', async (req: Request, res: Response) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'query param required' });
  const result = await callOrgTool('search_org_tasks', { query: String(query) });
  if (result.isError) return res.status(502).json({ error: result.content[0]?.text });
  try {
    res.json(JSON.parse(result.content[0].text));
  } catch {
    res.json({ raw: result.content[0].text });
  }
});

// GET /api/org/health
router.get('/health', async (_req: Request, res: Response) => {
  const result = await callOrgTool('get_org_health');
  if (result.isError) return res.status(502).json({ error: result.content[0]?.text });
  try {
    res.json(JSON.parse(result.content[0].text));
  } catch {
    res.json({ raw: result.content[0].text });
  }
});

export { router as orgRouter };
