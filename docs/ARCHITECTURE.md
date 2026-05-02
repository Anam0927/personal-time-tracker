# Architecture

## Overview

time-tracker is a single-entry-point Bun application. The entry point `index.ts` imports and runs `src/main.ts`, which parses CLI arguments, initializes infrastructure (DB, config, logger), and dispatches to the appropriate app.

## Layers

```
index.ts          → src/main.ts
                      ├── apps/cli/     — non-interactive CLI commands
                      ├── apps/tui/     — interactive terminal UI (Ink + React)
                      └── apps/system/  — system-level operations (suspend/resume)
```

```
src/features/     — business logic grouped by domain
  ├── clients/    — client CRUD
  ├── projects/   — project CRUD
  ├── reporting/  — report generation
  └── tracking/   — time entry lifecycle (start, stop, status, notifications)
```

```
src/lib/          — shared infrastructure
  ├── config/     — config loading (cosmiconfig)
  ├── db/         — Kysely + SQLite (kysely-bun-sqlite), migrations
  └── logging/    — structured logging (pino)
```

## Request flow

1. `Bun.argv` parsed by Commander-based args-parser in `apps/cli/lib/args-parser.ts`
2. DB initialized and migrations run automatically
3. If `tui` command: launches InkTuiApp (requires TTY)
4. Otherwise: loads config, creates logger, runs CliApp with the parsed command
5. Errors: Commander bootstrap errors exit with their exit code; other errors print message and exit code 2

## Database

- SQLite via `kysely-bun-sqlite`
- Migrations via `kysely-ctl`
- Generated types in `src/lib/db/types.ts` via `kysely-codegen`
- Run `bun run db:migrate` to apply, `bun run db:codegen` to regenerate types

## Key patterns

- **Repository pattern** — All data access goes through `*RepositoryImpl` classes extending `BaseRepository`. Domain errors (`NotFoundError`, `ConstraintViolationError`) are thrown instead of leaking SQLite details.
- **Config priority chain** — CLI `--config` arg > project config (cosmiconfig) > global XDG config (`$XDG_CONFIG_HOME/time-tracker/config.json`) > Zod prefault defaults.
- **DB-level constraints** — Partial unique indexes enforce single active session and single active pause per session at the database level.
- **Stub pattern** — Not-yet-implemented services (`ReportingServiceStub`, `OmarchySystemIntegrationStub`) define their interfaces upfront with `TODO(AA-379)` markers.

## CLI vs TUI

| Aspect       | CLI                       | TUI                  |
| ------------ | ------------------------- | -------------------- |
| Entry        | `CliApp`                  | `InkTuiApp`          |
| Tech         | Commander                 | Ink + React          |
| Requires TTY | No                        | Yes                  |
| Use case     | Scripting, quick commands | Interactive sessions |

## Testing

- Framework: Bun test runner (`bun run test`)
- Test files: `src/**/*.test.ts`, test helpers in `src/tests/`
- Mocks in `src/tests/mocks/`
