# phoenix-flow

Human + agent shared task graph. Dark amber Kanban UI for humans, MCP server for agents — same database, two interfaces.

Part of the phoenixvc three-tier MCP hierarchy:
- phoenix-flow (this repo) — human Kanban + top-level MCP
- mcp-org — cross-repo aggregation
- project MCP x N — one per repo

## Stack
| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + @modelcontextprotocol/sdk |
| Database | PostgreSQL via drizzle-orm |
| Deploy | Railway (2 services + 1 PostgreSQL add-on) |

## Backend env vars
| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection string (Railway provides) |
| GITHUB_TOKEN | PAT with contents:read — for YAML sync from repos |
| MCP_SECRET | Bearer token agents send to /mcp — generate: openssl rand -hex 32 |
| ANTHROPIC_API_KEY | For AI action buttons (Break Down, Draft Desc, Suggest Priority) |
| COGNITIVE_MESH_API_URL | cognitive-mesh base URL (defaults to Azure Container Apps prod URL) |
| COGNITIVE_MESH_API_KEY | X-Api-Key for cognitive-mesh (from Key Vault `cognitive-mesh-api-key`) |
| PORT | Set automatically by Railway |

## Frontend env vars
| Variable | Description |
|---|---|
| VITE_API_BASE_URL | Backend Railway URL — must be set before first build (baked in at build time) |

## MCP server
Agents connect to POST /mcp with Authorization: Bearer MCP_SECRET.

Tools: list_projects, list_tasks, get_task, create_task, update_task, move_task, add_checklist_item, complete_checklist_item, log_agent_message, get_deep_link, search_tasks, sync_repo_yaml, get_yaml_source

## YAML sync
Links a project to a GitHub repo. Pulls .todo.yaml, .task.yaml, .roadmap.yaml via GitHub API using GITHUB_TOKEN. Upserts only — never deletes on re-sync. Write-back is opt-in per project.

Trigger: Sync button in UI or POST /api/projects/:id/sync-yaml. Webhook auto-sync optional — point a GitHub push webhook at that endpoint.

## Related
- phoenixvc/org-meta — roadmaps, YAML specs
- org-meta/mcp/build-plan.md — full MCP ecosystem build plan
- org-meta/mcp/claude_code_handoff.md — detailed spec for this app