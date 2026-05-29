# Time Tracker

> A time tracking application with server, CLI, TUI, and daemon components.

## Local Development

### Prerequisites

- Node.js >= 22
- pnpm 11.5.0

### Getting Started

```bash
pnpm install
pnpm dev
```

This runs all apps in parallel via Turborepo.

### Apps

| App | Command | Description |
|-----|---------|-------------|
| `apps/server` | `pnpm --filter @time-tracker/server dev` | Cloudflare Workers API server (runs with `wrangler dev`) |
| `apps/cli` | `pnpm --filter @time-tracker/cli dev` | Interactive CLI (runs with `tsx watch`) |
| `apps/tui` | `pnpm --filter @time-tracker/tui dev` | Terminal UI (runs with `tsx watch`) |
| `apps/daemon` | `pnpm --filter @time-tracker/daemon dev` | Daemon process (runs with `tsx watch`) |

### Running Individual Apps

```bash
# Server
pnpm --filter @time-tracker/server dev

# CLI
pnpm --filter @time-tracker/cli dev

# TUI
pnpm --filter @time-tracker/tui dev

# Daemon
pnpm --filter @time-tracker/daemon dev
```
