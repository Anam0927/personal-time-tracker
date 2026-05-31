# Deployment Guide

This document describes how to deploy and manage the `time-tracker-server` Cloudflare Worker.

## Prerequisites

- Authenticated with Cloudflare (`wrangler login`)
- Access to the Cloudflare account where the Worker is deployed

## Environment Variables

| Variable       | Source | Description                                    |
| -------------- | ------ | ---------------------------------------------- |
| `DATABASE_URL` | Secret | PostgreSQL connection string (Neon)            |
| `JWT_SECRET`   | Secret | Secret key used for signing and verifying JWTs |

### Local Development

For local development, secrets are stored in `.env` (listed in `.gitignore`):

```
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
```

Wrangler reads this file automatically when running `pnpm run dev`.

## Managing Production Secrets

Secrets are set directly on the Cloudflare Worker using `pnpm exec wrangler secret put`. They are **never** committed to version control.

### Set a Secret

```bash
# Interactive prompt (recommended)
pnpm exec wrangler secret put DATABASE_URL

# From a file (useful for CI)
pnpm exec wrangler secret put DATABASE_URL < ./path/to/secret.txt
```

```bash
pnpm exec wrangler secret put JWT_SECRET
```

### List Secrets

```bash
pnpm exec wrangler secret list
```

### Delete a Secret

```bash
pnpm exec wrangler secret delete DATABASE_URL
```

> **Security:** Never pass secret values as command arguments. Always use the interactive prompt or pipe from a secure file.

## Deploying

### Production Deploy

```bash
pnpm exec wrangler deploy
```

This deploys the Worker using the configuration in `wrangler.jsonc`. Secrets that have been set via `wrangler secret put` are automatically included.

### Dry Run (Validate Without Deploying)

```bash
pnpm exec wrangler deploy --dry-run
```

### Source Maps & Source Code Visibility

> **Note:** `upload_source_maps: true` is set in `wrangler.jsonc`. While useful for debugging errors in production, source maps make the original source code accessible via the Cloudflare Dashboard. Anyone with dashboard access to the Worker can view the full source. Be mindful of this if the Worker contains proprietary logic or non-public configuration.

## Regenerating TypeScript Types

After changing `wrangler.jsonc`, regenerate the TypeScript type declarations:

```bash
pnpm exec wrangler types
```

This updates `worker-configuration.d.ts` with the correct `Env` interface bindings.

## Observability

The Worker has observability enabled via the `wrangler.jsonc` config:

```jsonc
"observability": {
  "enabled": true
}
```

View live logs with:

```bash
pnpm exec wrangler tail
```

## Troubleshooting

| Issue                           | Solution                                                                   |
| ------------------------------- | -------------------------------------------------------------------------- |
| `wrangler: command not found`   | Make sure you are in apps/server and running the command using `pnpm exec` |
| Auth errors                     | Run `pnpm exec wrangler login`                                             |
| Type errors after config change | Run `pnpm exec wrangler types` to regenerate bindings                      |
| Missing environment variable    | Check `pnpm exec wrangler secret list` for production                      |
