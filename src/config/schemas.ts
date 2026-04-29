import { logLevel } from "@/logging/schemas";
import z from "zod";

const remindersConfigSchema = z.object({
  repeatIntervalInMinutes: z.int().positive().default(5),
});

const trackingConfigSchema = z.object({
  shortSleepThresholdInMinutes: z.int().positive().default(5),
  defaultThresholdInMinutes: z.int().positive().optional(),
  reminders: remindersConfigSchema.prefault({}),
});

const loggingConfigSchema = z.object({
  level: logLevel.default("info"),
  retentionPeriodInDays: z.int().positive().default(7),
});

export const configSchema = z
  .object({
    tracking: trackingConfigSchema.prefault({}),
    logging: loggingConfigSchema.prefault({}),
  })
  .prefault({});
export type Config = z.infer<typeof configSchema>;
