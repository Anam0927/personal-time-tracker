import { z } from "zod";

export const logLevel = z.enum(["error", "warn", "info", "debug"]);
export type LogLevel = z.infer<typeof logLevel>;
