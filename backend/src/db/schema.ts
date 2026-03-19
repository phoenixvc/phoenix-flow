import { pgTable, uuid, text, boolean, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high', 'critical']);
export const statusEnum = pgEnum('status', ['todo', 'inprogress', 'done']);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#f59e0b'),
  yamlWritebackEnabled: boolean('yaml_writeback_enabled').notNull().default(false),
  repoUrl: text('repo_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  priority: priorityEnum('priority').notNull().default('medium'),
  status: statusEnum('status').notNull().default('todo'),
  isAiTask: boolean('is_ai_task').notNull().default(false),
  sourceFile: text('source_file'),
  sourceLine: integer('source_line'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const checklistItems = pgTable('checklist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  done: boolean('done').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const agentMessages = pgTable('agent_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  fromAgent: text('from_agent').notNull(),
  message: text('message').notNull(),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const deepLinks = pgTable('deep_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
