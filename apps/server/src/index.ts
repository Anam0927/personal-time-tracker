import { Elysia } from "elysia"
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker"

const app = new Elysia({
  adapter: CloudflareAdapter,
})
  .get("/", () => "Hello from Time Tracker API!")
  .get("/health", () => ({
    status: "ok",
    timestamp: Date.now(),
  }))

export default app.compile()
