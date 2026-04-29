/**
 * Shared domain types for the v1 scaffold.
 * TODO(AA-379): Expand with concrete persistence model and validation boundaries.
 */

export type SessionId = string;
export type ClientId = string;
export type ProjectId = string;

export type SessionStatus = "active" | "paused" | "stopped";

export interface ActiveSessionSummary {
  id: SessionId;
  clientId: ClientId;
  projectId: ProjectId;
  startedAtIso: string;
  status: SessionStatus;
}

export interface TimeTotals {
  totalMinutes: number;
}

export interface ReportRow {
  label: string;
  totalMinutes: number;
}

export interface ReportResult {
  rows: ReportRow[];
  totals: TimeTotals;
}
