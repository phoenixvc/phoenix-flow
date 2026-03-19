import { Router } from 'express';

const router = Router();

const COGMESH_URL = process.env.COGNITIVE_MESH_API_URL || 'https://cognitive-mesh-api.blackmoss-00f95c9e.southafricanorth.azurecontainerapps.io';
const COGMESH_KEY = process.env.COGNITIVE_MESH_API_KEY || 'dev-test-key';

/**
 * POST /api/ai/route-task
 * Calls cognitive-mesh /agency/route and returns the autonomy level + recommended engine.
 * Body: { taskType: string, ciaScore?: number, csiScore?: number }
 */
router.post('/route-task', async (req, res) => {
  try {
    const { taskType = 'General', ciaScore = 0.4, csiScore = 0.7 } = req.body ?? {};

    const upstream = await fetch(`${COGMESH_URL}/api/v1/cognitive/agency/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': COGMESH_KEY,
      },
      body: JSON.stringify({ taskType, ciaScore, csiScore }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('[ai/route-task] cognitive-mesh error', upstream.status, text);
      return res.status(502).json({ error: 'Upstream cognitive-mesh error', status: upstream.status });
    }

    const data = await upstream.json();
    return res.json(data);
  } catch (err) {
    console.error('[ai/route-task] fetch failed', err);
    return res.status(502).json({ error: 'Could not reach cognitive-mesh' });
  }
});

export { router as aiRouter };
