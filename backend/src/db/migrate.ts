import { Pool } from 'pg';

export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE status AS ENUM ('todo', 'inprogress', 'done');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#f59e0b',
        yaml_writeback_enabled BOOLEAN NOT NULL DEFAULT false,
        repo_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        priority priority NOT NULL DEFAULT 'medium',
        status status NOT NULL DEFAULT 'todo',
        is_ai_task BOOLEAN NOT NULL DEFAULT false,
        source_file TEXT,
        source_line INTEGER,
        agent_id TEXT,
        agent_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS checklist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        done BOOLEAN NOT NULL DEFAULT false,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS agent_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
        project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
        from_agent TEXT NOT NULL,
        agent_id TEXT,
        message TEXT NOT NULL,
        metadata TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS deep_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_type TEXT NOT NULL,
        resource_id UUID NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Additive column migrations — safe to re-run
    await client.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS agent_id TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS agent_name TEXT;
      ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS agent_id TEXT;
    `);

    await client.query('COMMIT');
    console.log('[migrate] All migrations applied successfully');
  } catch (err) {
    console.error('[migrate] Migration failed — rolling back', { err: String(err) });
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
