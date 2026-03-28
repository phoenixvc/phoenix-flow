import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { runMigrations } from './db/migrate.js';
import { projectsRouter } from './routes/projects.js';
import { tasksRouter } from './routes/tasks.js';
import { agentsRouter } from './routes/agents.js';
import { checklistRouter } from './routes/checklist.js';
import { linksRouter } from './routes/links.js';
import { aiRouter } from './routes/ai.js';
import { orgRouter } from './routes/org.js';
import { mcpRouter } from './mcp/server.js';
import { verifyMystiraJwt } from './middleware/auth.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();

const corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin && process.env.NODE_ENV === 'production') {
  console.error('[startup] CORS_ORIGIN is not set in production — defaulting to wildcard. Set CORS_ORIGIN to restrict access.');
}
app.use(cors({ origin: corsOrigin || '*' }));
app.use(express.json());

// Public routes — no auth
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// MCP routes use their own Bearer secret — untouched
app.use('/mcp', mcpRouter(pool));

// JWT auth — enabled when REQUIRE_AUTH=true (default: off until Mystira Identity is wired)
if (process.env.REQUIRE_AUTH === 'true') {
  app.use('/api', verifyMystiraJwt);
} else {
  console.warn('[startup] REQUIRE_AUTH is not set — API routes are unauthenticated');
}
app.use('/api/projects', projectsRouter(pool));
app.use('/api/tasks', tasksRouter(pool));
app.use('/api/agent-messages', agentsRouter(pool));
app.use('/api/tasks/:id/checklist', checklistRouter(pool));
app.use('/api/deep-links', linksRouter(pool));
app.use('/api/ai', aiRouter);
app.use('/api/org', orgRouter);

const PORT = process.env.PORT || 3001;

async function main() {
  await runMigrations(pool);
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}

main().catch(err => { console.error(err); process.exit(1); });

export { app, pool };
