import type { ActiveSession } from "../db/repos/sessions"

/**
 * Contract for timer operations.
 * TODO(AA-379): Implement business rules for single active session and pause/resume semantics.
 */
export interface TimerEngine {
  getActiveSession(): Promise<ActiveSession | null>
  startSession(input: StartSessionInput): Promise<StartSessionResult>
  stopSession(): Promise<StopSessionResult>
  switchSession(input: StartSessionInput): Promise<SwitchSessionResult>
}

export interface StartSessionInput {
  clientId: number
  projectId: number
  note?: string
  tags?: string[]
  thresholdMinutes?: number
}

export interface StartSessionResult {
  createdSessionId: number
}

export interface StopSessionResult {
  stoppedSessionId: number
}

export interface SwitchSessionResult {
  stoppedSessionId: number
  startedSessionId: number
}

const notImplementedError = (methodName: string): Error => {
  return new Error(`TimerEngine.${methodName} is not implemented yet.`)
}

export class TimerEngineStub implements TimerEngine {
  async getActiveSession(): Promise<ActiveSession | null> {
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
