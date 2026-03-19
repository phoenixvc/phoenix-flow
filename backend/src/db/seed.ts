/**
 * Seed script — populates the database with demo data for local dev and Railway staging.
 * Safe to re-run: skips if projects already exist.
 *
 * Usage:
 *   npx tsx src/db/seed.ts
 *   npm run db:seed
 */
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Skip if already seeded
    const { rows } = await client.query('SELECT COUNT(*) FROM projects');
    if (parseInt(rows[0].count, 10) > 0) {
      console.log('[seed] Database already seeded — skipping');
      await client.query('ROLLBACK');
      return;
    }

    // ── Projects ──────────────────────────────────────────────────────────────
    const projectResult = await client.query<{ id: string }>(`
      INSERT INTO projects (name, color, repo_url, yaml_writeback_enabled) VALUES
        ('phoenix-flow',     '#f59e0b', 'https://github.com/JustAGhosT/phoenix-flow',         false),
        ('cognitive-mesh',   '#a78bfa', 'https://github.com/phoenixvc/cognitive-mesh',         false),
        ('mystira-workspace','#34d399', 'https://github.com/phoenixvc/mystira-workspace',       false)
      RETURNING id
    `);
    const [pfId, cmId, myId] = projectResult.rows.map(r => r.id);

    // ── Tasks — phoenix-flow ──────────────────────────────────────────────────
    const pfTasks = await client.query<{ id: string }>(`
      INSERT INTO tasks (project_id, title, description, priority, status, is_ai_task) VALUES
        ($1, 'Wire DATABASE_URL via Railway shared variable',
             'Link Postgres add-on to backend service so DATABASE_URL injects automatically.',
             'high', 'done', false),
        ($1, 'Dependabot: bump esbuild moderate vuln',
             'Dependabot flagged a moderate vulnerability on esbuild. Review and merge PR #1.',
             'medium', 'todo', false),
        ($1, 'Add /api/ai/breakdown endpoint',
             'Implement the Anthropic-backed task breakdown route that AIActions.tsx already calls.',
             'medium', 'todo', true),
        ($1, 'Add /api/ai/suggest-priority endpoint',
             'AI-suggested priority based on task title and description.',
             'low', 'todo', true),
        ($1, 'Add /api/ai/draft-description endpoint',
             'AI-drafted task description from title.',
             'low', 'todo', true),
        ($1, 'Seed Railway DATABASE_URL as shared variable',
             'Replace hardcoded internal URL in backend env with a Railway shared variable reference.',
             'medium', 'inprogress', false)
      RETURNING id
    `, [pfId]);

    // ── Tasks — cognitive-mesh ────────────────────────────────────────────────
    const cmTasks = await client.query<{ id: string }>(`
      INSERT INTO tasks (project_id, title, description, priority, status, is_ai_task) VALUES
        ($1, 'Tag and push v8 image to ACR',
             'Build Dockerfile.api with CIA 2.0 engine and push as v8 + vlatest to myssharedacr.',
             'high', 'done', false),
        ($1, 'Expose /agency/route/computed endpoint',
             'Wire ICognitiveAssessmentPort into the computed endpoint so callers can pass raw CIA metrics.',
             'medium', 'todo', false),
        ($1, 'Implement Fluency 2.0 computation engine',
             'Formula: (OS+IC+FL+CT+ER+CF+FS)/7 × FTM × WIP × CLM. Deferred until CIA is stable.',
             'low', 'todo', false),
        ($1, 'Provision AKS cluster via Terraform',
             'The deploy pipeline expects AKS but the IaC does not provision it. Add AKS module.',
             'high', 'todo', false)
      RETURNING id
    `, [cmId]);

    // ── Tasks — mystira-workspace ─────────────────────────────────────────────
    await client.query(`
      INSERT INTO tasks (project_id, title, description, priority, status, is_ai_task) VALUES
        ($1, 'Fix CS1061 UseEnvironment missing using',
             'Added Microsoft.AspNetCore.Hosting using to StreamingIntegrationTests.cs — PR #825.',
             'high', 'done', false),
        ($1, 'Review feat/agent-enhancements PR',
             'PR #825 is open. Needs review and merge to unblock CI.',
             'high', 'inprogress', false),
        ($1, 'Onboard mystira to AgentKit Forge',
             'Create onboarding ticket at phoenixvc/agentkit-forge.',
             'low', 'todo', false)
    `, [myId]);

    // ── Checklist items ───────────────────────────────────────────────────────
    const dbTask = pfTasks.rows[5]; // "Seed Railway DATABASE_URL" task
    await client.query(`
      INSERT INTO checklist_items (task_id, text, sort_order) VALUES
        ($1, 'Go to Railway project → backend service → Variables', 1),
        ($1, 'Add reference: DATABASE_URL = ${{Postgres.DATABASE_URL}}',    2),
        ($1, 'Remove hardcoded postgresql:// connection string',            3),
        ($1, 'Redeploy and confirm /health still returns ok',               4)
    `, [dbTask.id]);

    const acrTask = cmTasks.rows[0]; // "Tag and push v8" task
    await client.query(`
      INSERT INTO checklist_items (task_id, text, sort_order) VALUES
        ($1, 'az acr build --registry myssharedacr --image cognitive-mesh/api:v8 ...', 1),
        ($1, 'Verify tag appears in az acr repository show-tags',                       2),
        ($1, 'Confirm container app is running vlatest (or pin to v8)',                 3)
    `, [acrTask.id]);

    // ── Agent messages ────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO agent_messages (project_id, from_agent, message) VALUES
        ($1, 'claude-sonnet-4-6',
         'Deployment complete. Backend live at https://backend-production-59d03.up.railway.app. Frontend live at https://frontend-production-6256b.up.railway.app.'),
        ($2, 'claude-sonnet-4-6',
         'CIA 2.0 engine implemented and registered. v8 image pushed to ACR. /api/v1/cognitive/agency/route is fully operational.')
    `, [pfId, cmId]);

    await client.query('COMMIT');
    console.log('[seed] Database seeded successfully');
    console.log(`  Projects: phoenix-flow, cognitive-mesh, mystira-workspace`);
    console.log(`  Tasks: ${pfTasks.rowCount! + cmTasks.rowCount! + 3} total`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] Seeding failed — rolled back', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
