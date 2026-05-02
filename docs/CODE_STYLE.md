# Code Style

## TypeScript config

- `strict: true` with `noUncheckedIndexedAccess` and `noImplicitOverride`
- `verbatimModuleSyntax` — use `import type` for type-only imports
- Path alias `@/*` maps to `./src/*`
- No unused locals/params checks are **disabled** — focus on logic, not cleanup during iteration
- Target: ESNext, Module: Preserve (Bun-native)

## Linting & Formatting

- **Lint**: `oxlint` (`bun run lint` / `bun run lint:fix`)
- **Format**: `oxfmt` (`bun run fmt` / `bun run fmt:check`)
- Configuration in `.oxlintrc.json` and `.oxfmtrc.json`
- oxfmt has `semi: false` and `sortImports: true` — imports should be auto-sorted

## Imports

- Prefer `es-toolkit` over `lodash` for utility functions
- Use `date-fns` for date/time operations
- Use `zod` for runtime validation (v4)

## Naming

- Files: kebab-case (`client-service.ts`)
- Exports: PascalCase for classes/types/interfaces, camelCase for functions/variables
- Tests live alongside source files in `__tests__/` dirs or as `*.test.ts` files

## Project conventions

- Feature modules in `src/features/` own their domain logic
- Reusable infrastructure in `src/lib/`
- Apps (`src/apps/`) are thin entry points — they parse input and call features
- Domain types live inline in feature modules; shared reporting types in `src/types.ts`
- DB entity types are auto-generated in `src/lib/db/types.ts` — do not edit manually

## Error handling

- Use typed errors where possible (e.g., `CommanderBootstrapError` with `code` and `exitCode`)
- Top-level error handler in `src/main.ts` catches all unhandled errors
- Avoid bare `throw "string"` — always throw `Error` instances
