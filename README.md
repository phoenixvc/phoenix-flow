# phoenix-flow

![Version](https://img.shields.io/badge/version-0.1.0-blue) ![Status](https://img.shields.io/badge/status-active-green) ![Platform](https://img.shields.io/badge/platform-Railway-blueviolet)

> Human and agent shared task graph — React Kanban UI, MCP server, and bidirectional YAML sync for the phoenixvc org.

**phoenix-flow** is the work visibility layer of the phoenixvc ecosystem. It gives humans and AI agents a shared view of work: a Portfolio → Project → Task hierarchy surfaced as a Kanban board, with an MCP server that lets agents read and write tasks directly from their tool calls. Work state syncs bidirectionally to YAML files in `org-meta`, making the project graph version-controlled and agent-accessible.

---

## What it does

- **Kanban board** — React + Vite + Tailwind frontend with a 3-tier hierarchy: Portfolio → Project → Task. Drag-and-drop, checklist support, and status tracking.
- **MCP server** — Express backend exposes an MCP (Model Context Protocol) server so AI agents in `deck`, `cognitive-mesh`, and `retort` projects can query and update tasks without leaving their tool loop.
- **YAML sync** — Bidirectional sync between the Postgres task database and YAML files committed to `org-meta`. The task graph is always version-controlled.
- **Org context passthrough** — Backend proxies org-level data (roadmap, projects, tasks) from `mcp-org` so agents get full org context via a single MCP endpoint.
- **Railway deployment** — Deployed as a web service on Railway. Monorepo with separate `backend/` and `frontend/` packages.

---

## Architecture

```
frontend (React/Vite/Tailwind)
         │
         ▼
backend (Express + MCP server)
         │
    ┌────┴─────────────────┐
    │                      │
 Postgres              mcp-org
 (task store)          (org context — roadmap, projects)
    │
    └──▶  org-meta (YAML sync)
```

Deployed on Railway. MCP server accessible to agents via HTTP transport.

---

## Repository layout

```
phoenix-flow/
├── backend/                # Express API + MCP server
│   ├── src/
│   │   ├── db/schema.ts    # Drizzle ORM schema
│   │   ├── mcp/server.ts   # MCP tool definitions
│   │   ├── mcp/orgClient.ts# mcp-org JSON-RPC client
│   │   └── routes/         # REST API routes (tasks, org)
│   └── package.json
├── frontend/               # React Kanban UI
│   ├── src/
│   │   ├── components/     # Board, Card, Column components
│   │   └── hooks/          # Data fetching hooks
│   └── package.json
├── railway.toml            # Railway deployment config
└── README.md
```

---

## Prerequisites

- Node.js 22+ / npm
- PostgreSQL (via Railway or local)
- `MCP_ORG_URL` + `MCP_ORG_SECRET` for org context passthrough

---

## Quick start

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` — PostgreSQL connection string
- `MCP_ORG_URL` — mcp-org endpoint (default: Railway deployment)
- `MCP_ORG_SECRET` — shared secret for mcp-org auth

---

## MCP tools

The MCP server exposes tools for agents:

| Tool | Description |
|---|---|
| `list_projects` | List all projects in a portfolio |
| `get_tasks` | Get tasks for a project with status filter |
| `create_task` | Create a new task |
| `update_task` | Update task status, assignee, or checklist |
| `sync_to_yaml` | Trigger bidirectional YAML sync to org-meta |
| `get_org_roadmap` | Passthrough — fetch org roadmap from mcp-org |
| `list_org_projects` | Passthrough — list all org projects from mcp-org |
| `search_org_tasks` | Passthrough — search org tasks from mcp-org |
| `get_org_health` | Passthrough — org health check from mcp-org |

---

## Ecosystem

phoenix-flow is the work visibility layer of the phoenixvc platform. It connects to:

| Repo | Role |
|---|---|
| [`deck`](https://github.com/phoenixvc/deck) | Desktop ops tool — embeds phoenix-flow board view and surfaces task counts in the operator dashboard |
| [`mcp-org`](https://github.com/phoenixvc/mcp-org) | Org MCP server — phoenix-flow proxies org context (roadmap, projects) from mcp-org to its own MCP clients |
| [`org-meta`](https://github.com/phoenixvc/org-meta) | Org registry — receives YAML task sync from phoenix-flow; source of truth for version-controlled task state |
| [`cognitive-mesh`](https://github.com/phoenixvc/cognitive-mesh) | Agent orchestration — receives task routing requests from phoenix-flow backend |
| [`retort`](https://github.com/phoenixvc/retort) | Agent scaffold — retort-based projects can read their tasks from phoenix-flow via MCP |
| [`sluice`](https://github.com/phoenixvc/sluice) | AI gateway — phoenix-flow backend AI calls route through sluice |

---

## Inspiration

- [**linear.app**](https://linear.app) — project tracking UX and 3-tier hierarchy model (team → project → issue)
- [**plane.so**](https://plane.so) — open-source project management, bidirectional sync patterns
