# Deployment Guide

This document describes how to deploy and manage the `time-tracker-server` Cloudflare Worker.

## Prerequisites

- Authenticated with Cloudflare (`wrangler login`)
- Access to the Cloudflare account where the Worker is deployed

## Environment Variables

| Variable       | Source | Description                                                                                                  |
| -------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL` | Secret | PostgreSQL connection URL (validated as a proper URL with `postgresql` protocol, e.g., `postgresql://...`)   |
| `JWT_SECRET`   | Secret | Secret key used for signing and verifying JWTs                                                               |
| `PAIRING_CODE` | Secret | Device pairing code — two groups of 4 uppercase alphanumeric chars separated by a hyphen (e.g., `AB12-CD34`) |
| `WORKERS_URL`  | Secret | Base URL of the deployed worker (e.g., `https://worker.example.com`)                                         |

### Local Development

For local development, secrets are stored in `.env` (listed in `.gitignore`):

```
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
PAIRING_CODE="ABCD-1234"
WORKERS_URL="http://localhost:8787"
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
pnpm exec wrangler secret put PAIRING_CODE
pnpm exec wrangler secret put WORKERS_URL
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

## Validation

All environment variables are validated at runtime using zod. The worker will fail to start with a descriptive error if:

- A required variable is missing
- A variable has an invalid value (e.g., `JWT_SECRET` is shorter than 32 characters, `PAIRING_CODE` does not match `XXXX-XXXX` format with uppercase alphanumeric groups, `DATABASE_URL` is not a valid PostgreSQL URL, `WORKERS_URL` is not a valid URL)

## Troubleshooting

| Issue                           | Solution                                                                   |
| ------------------------------- | -------------------------------------------------------------------------- |
| `wrangler: command not found`   | Make sure you are in apps/server and running the command using `pnpm exec` |
| Auth errors                     | Run `pnpm exec wrangler login`                                             |
| Type errors after config change | Run `pnpm exec wrangler types` to regenerate bindings                      |
| Missing environment variable    | Check `pnpm exec wrangler secret list` for production                      |
