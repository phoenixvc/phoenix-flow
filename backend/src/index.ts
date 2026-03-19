import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { runMigrations } from './db/migrate.js';
import { projectsRouter } from './routes/projects.js';
import { tasksRouter } from './routes/tasks.js';
import { agentsRouter } from './routes/agents.js';
import { checklistRouter } from './routes/checklist.js';
import { linksRouter } from './routes/links.js';
import { mcpRouter } from './mcp/server.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/projects', projectsRouter(pool));
app.use('/api/tasks', tasksRouter(pool));
app.use('/api/agent-messages', agentsRouter(pool));
app.use('/api/tasks/:id/checklist', checklistRouter(pool));
app.use('/api/deep-links', linksRouter(pool));
app.use('/mcp', mcpRouter(pool));

const PORT = process.env.PORT || 3001;

async function main() {
  await runMigrations(pool);
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}

main().catch(err => { console.error(err); process.exit(1); });

export { app, pool };
