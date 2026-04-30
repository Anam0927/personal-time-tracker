import type { ReportScope } from "@/reporting/schemas"

import type { ActiveSessionSummary, ClientId, ProjectId, ReportResult, SessionId } from "../types"

/**
 * Persistence contract for SQLite-backed storage.
 * TODO(AA-379): Implement schema migration, query methods, and transactional writes.
 */
export interface PersistenceStore {
  ensureReady(): Promise<void>
  getActiveSession(): Promise<ActiveSessionSummary | null>
  createSession(command: CreateSessionCommand): Promise<{ sessionId: SessionId }>
  stopSession(command: StopSessionCommand): Promise<{ sessionId: SessionId }>
  readReport(scope: ReportScope): Promise<ReportResult>
}

export interface CreateSessionCommand {
  clientId: ClientId
  projectId: ProjectId
  note?: string
  tags?: string[]
  thresholdMinutes?: number
}

export interface StopSessionCommand {
  stoppedAtIso: string
}

const notImplementedError = (methodName: string): Error => {
  return new Error(`PersistenceStore.${methodName} is not implemented yet.`)
}

export class SqlitePersistenceStub implements PersistenceStore {
  constructor(private readonly databasePath: string) {}

  async ensureReady(): Promise<void> {
    if (!this.databasePath) {
      throw new Error("SqlitePersistenceStub requires a non-empty database path.")
    }

    // TODO(AA-379): Initialize Bun SQLite connection and apply migrations.
  }

  async getActiveSession(): Promise<ActiveSessionSummary | null> {
    // TODO(AA-379): Query current active session.
    return null
  }

  async createSession(_command: CreateSessionCommand): Promise<{ sessionId: SessionId }> {
    throw notImplementedError("createSession")
  }

  async stopSession(_command: StopSessionCommand): Promise<{ sessionId: SessionId }> {
    throw notImplementedError("stopSession")
  }

  async readReport(_scope: ReportScope): Promise<ReportResult> {
    throw notImplementedError("readReport")
  }
}
