import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import { env as cfEnv } from "cloudflare:workers"

const schema = {
  DATABASE_URL: z.url({
    protocol: /^postgresql$/,
  }),
  JWT_SECRET: z.string().min(32),
  PAIRING_CODE: z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/),
  WORKERS_URL: z.url(),
}

const runtimeEnv = { ...cfEnv }

export const env = createEnv({
  server: schema,
  runtimeEnv,
})

export type AppEnv = typeof env
