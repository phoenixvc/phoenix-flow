# ai-cadence

![Version](https://img.shields.io/badge/version-0.0.1-blue) ![Status](https://img.shields.io/badge/status-active-green) ![Platform](https://img.shields.io/badge/platform-Railway-blueviolet)

> Human and agent shared task graph — React Kanban UI, MCP server, and bidirectional YAML sync for the phoenixvc org.
>
> **ai-cadence** is the project rhythm layer of the phoenixvc ecosystem. It gives humans and AI agents a shared view of work: a Portfolio → Project → Task hierarchy surfaced as a Kanban board, with an MCP server that lets agents read and write tasks directly from their tool calls. Work state syncs bidirectionally to YAML files in `org-meta`, making the project graph version-controlled and agent-accessible.
>
> ---
>
> ## What it does
>
> - **Kanban board** — React + Vite + Tailwind frontend with a 3-tier hierarchy: Portfolio → Project → Task. Full drag-and-drop, checklist support, and status tracking.
> - - **MCP server** — Express backend exposes an MCP (Model Context Protocol) server so AI agents in `cockpit`, `cognitive-mesh`, and `retort` projects can query and update tasks without leaving their tool loop.
>   - - **YAML sync** — Bidirectional sync between the Postgres task database and YAML files committed to `org-meta`. The task graph is always version-controlled.
>     - - **Cognitive-mesh routing** — Backend proxies task-routing decisions to `cognitive-mesh` (`POST /api/ai/route-task`) so agents can get AI-assisted triage.
>       - - **Railway deployment** — Deployed as a web service on Railway. Monorepo with separate `backend/` and `frontend/` packages.
>        
>         - ---
>
> ## Architecture
>
> ```
> frontend (React/Vite/Tailwind)
>          │
>          ▼
> backend (Express + MCP server)
>          │
>     ┌────┴────────────┐
>     │                 │
>  Postgres          cognitive-mesh
>  (task store)      (AI routing)
>     │
>     └──▶  org-meta (YAML sync)
> ```
>
> **Deployed on Railway.** MCP server accessible to agents via stdio or HTTP transport.
>
> ---
>
> ## Repository layout
>
> ```
> ai-cadence/
> ├── backend/                # Express API + MCP server
> │   ├── src/
> │   │   ├── db/schema.ts    # Drizzle ORM schema
> │   │   ├── mcp/server.ts   # MCP tool definitions
> │   │   └── routes/         # REST API routes
> │   └── package.json
> ├── frontend/               # React Kanban UI
> │   ├── src/
> │   │   ├── components/     # Board, Card, Column components
> │   │   └── hooks/          # Data fetching hooks
> │   └── package.json
> ├── railway.toml            # Railway deployment config
> └── README.md
> ```
>
> ---
>
> ## Prerequisites
>
> - Node.js 20+ / pnpm
> - - PostgreSQL (via Railway or local)
>   - - `GITHUB_TOKEN` (for YAML sync to org-meta)
>    
>     - ---
>
> ## Quick start
>
> ```bash
> # Backend
> cd backend
> pnpm install
> pnpm dev
>
> # Frontend
> cd frontend
> pnpm install
> pnpm dev
> ```
>
> Copy `.env.example` to `.env` and fill in:
> - `DATABASE_URL` — PostgreSQL connection string
> - - `GITHUB_TOKEN` — for org-meta YAML sync
>   - - `COGNITIVE_MESH_URL` — cognitive-mesh endpoint
>    
>     - ---
>
> ## MCP tools
>
> The MCP server exposes tools for agents:
>
> | Tool | Description |
> |---|---|
> | `list_projects` | List all projects in a portfolio |
> | `get_tasks` | Get tasks for a project with status filter |
> | `create_task` | Create a new task |
> | `update_task` | Update task status, assignee, or checklist |
> | `sync_to_yaml` | Trigger bidirectional YAML sync to org-meta |
>
> ---
>
> ## Ecosystem
>
> ai-cadence is the work visibility layer of the phoenixvc platform. It connects to:
>
> | Repo | Role |
> |---|---|
> | [`cockpit`](https://github.com/phoenixvc/cockpit) | Desktop ops tool — embeds ai-cadence board view and surfaces task counts in the operator dashboard |
> | [`cognitive-mesh`](https://github.com/phoenixvc/cognitive-mesh) | Agent orchestration — receives task routing requests from ai-cadence backend |
> | [`org-meta`](https://github.com/phoenixvc/org-meta) | Org registry — receives YAML task sync from ai-cadence; source of truth for version-controlled task state |
> | [`retort`](https://github.com/phoenixvc/retort) | Agent scaffold — retort-based projects can read their tasks from ai-cadence via MCP |
> | [`ai-flume`](https://github.com/phoenixvc/ai-flume) | AI data plane — ai-cadence backend AI calls route through ai-flume |
>
> ---
>
> ## Inspiration
>
> - [**linear.app**](https://linear.app) — project tracking UX and 3-tier hierarchy model (team → project → issue)
> - - [**plane.so**](https://plane.so) — open-source project management, bidirectional sync patterns
>  
>   - ---
>
> ## Name
>
> **ai-cadence** — cadence is the rhythm of work: the pace at which tasks move through a system, the beat of delivery, the pulse of a team. A Kanban board is fundamentally a cadence instrument — it makes the rhythm of work visible. The name sits naturally alongside `cockpit` (which operates the rhythm) and `ai-flume` (which carries the data). It replaced the more generic `phoenix-flow`, which described movement but not rhythm or intent.
>
> Previously named `phoenix-flow` (in `JustAGhosT` org). Renamed and transferred to `phoenixvc` to reflect its role as shared org infrastructure, not a personal project.
> 
