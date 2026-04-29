import z from "zod";

export const reportScope = z.enum(["today", "week", "client", "project"]);
export type ReportScope = z.infer<typeof reportScope>;
