import type { ActiveSessionSummary, ClientId, ProjectId, SessionId } from "../types"

/**
 * Contract for timer operations.
 * TODO(AA-379): Implement business rules for single active session and pause/resume semantics.
 */
export interface TimerEngine {
  getActiveSession(): Promise<ActiveSessionSummary | null>
  startSession(input: StartSessionInput): Promise<StartSessionResult>
  stopSession(): Promise<StopSessionResult>
  switchSession(input: StartSessionInput): Promise<SwitchSessionResult>
}

export interface StartSessionInput {
  clientId: ClientId
  projectId: ProjectId
  note?: string
  tags?: string[]
  thresholdMinutes?: number
}

export interface StartSessionResult {
  createdSessionId: SessionId
}

export interface StopSessionResult {
  stoppedSessionId: SessionId
}

export interface SwitchSessionResult {
  stoppedSessionId: SessionId
  startedSessionId: SessionId
}

const notImplementedError = (methodName: string): Error => {
  return new Error(`TimerEngine.${methodName} is not implemented yet.`)
}

export class TimerEngineStub implements TimerEngine {
  async getActiveSession(): Promise<ActiveSessionSummary | null> {
    // TODO(AA-379): Read current active session from persistence.
    return null
  }

  async startSession(_input: StartSessionInput): Promise<StartSessionResult> {
    throw notImplementedError("startSession")
  }

  async stopSession(): Promise<StopSessionResult> {
    throw notImplementedError("stopSession")
  }

  async switchSession(_input: StartSessionInput): Promise<SwitchSessionResult> {
    throw notImplementedError("switchSession")
  }
}
