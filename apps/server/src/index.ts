import { Elysia } from "elysia"
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker"
import { jwt } from "@elysiajs/jwt"
import { env } from "./env"
import { db } from "./db"
import { users } from "./db/schema"

// Get JWT secret from env at module init
const JWT_SECRET = env.JWT_SECRET

const app = new Elysia({
  adapter: CloudflareAdapter,
})
  .use(
    jwt({
      name: "jwt",
      secret: JWT_SECRET,
    }),
  )
  .get("/", () => "Hello from Time Tracker API!")
  .get("/health", () => ({
    status: "ok",
    timestamp: Date.now(),
  }))
  // --- JWT routes ---
  // SPIKE TODO: This endpoint is unauthenticated — anyone can mint tokens.
  // Add authentication (API key, OAuth, etc.) before production.
  .post("/auth/sign/:name", async ({ jwt, params: { name }, set }) => {
    const token = await jwt.sign({ name })
    set.status = 201
    return { token }
  })
  .get("/auth/verify", async ({ jwt, set, request }) => {
    const header = request.headers.get("Authorization")
    if (!header?.startsWith("Bearer ")) {
      set.status = 401
      return { valid: false, error: "Missing or invalid Authorization header" }
    }
    const token = header.slice(7)
    const payload = await jwt.verify(token)
    if (!payload) {
      set.status = 401
      return { valid: false, error: "Invalid or expired token" }
    }
    return { valid: true, payload }
  })
  // --- DB check route ---
  .get("/db-check", async ({ set }) => {
    try {
      const result = await db.select().from(users).limit(1)
      return { status: "connected", rowCount: result.length }
    } catch (err) {
      set.status = 503
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      }
    }
  })

export default app.compile()
