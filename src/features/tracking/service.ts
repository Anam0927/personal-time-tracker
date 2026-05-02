import type { Selectable } from "kysely"

import type { ClientsRepository } from "@/features/clients/repo"
import type { ProjectsRepository } from "@/features/projects/repo"
import type { Client, Project } from "@/lib/db/types"

import type { PauseEventsRepository } from "./pause-events.repo"
import type { ActiveSession, SessionsRepository } from "./sessions.repo"

export type StartResult =
  | { variant: "started"; sessionId: number; clientName: string; projectName: string }
  | { variant: "sameActive"; session: ActiveSession }
  | {
      variant: "conflict"
      activeSession: ActiveSession
      requestedClient: string
      requestedProject: string
    }
  | { variant: "clientNotFound"; name: string }
  | { variant: "projectNotFound"; name: string; clientName: string }
  | { variant: "clientArchived"; name: string }
  | { variant: "projectArchived"; name: string }

export type StopResult =
  | { variant: "stopped"; sessionId: number; elapsedMinutes: number }
  | { variant: "noActive" }

export type SwitchResult =
  | {
      variant: "switched"
      completedSessionId: number
      newSessionId: number
      clientName: string
      projectName: string
    }
  | { variant: "noActiveToSwitch" }
  | { variant: "clientNotFound"; name: string }
  | { variant: "projectNotFound"; name: string; clientName: string }
  | { variant: "clientArchived"; name: string }
  | { variant: "projectArchived"; name: string }

export interface TimerService {
  start(params: {
    clientName: string
    projectName: string
    note?: string
    thresholdMinutes?: number
  }): Promise<StartResult>

  stop(): Promise<StopResult>

  switch(params: { clientName: string; projectName: string; note?: string }): Promise<SwitchResult>
}

export class TimerServiceImpl implements TimerService {
  constructor(
    private readonly sessionsRepo: SessionsRepository,
    private readonly pauseEventsRepo: PauseEventsRepository,
    private readonly clientsRepo: ClientsRepository,
    private readonly projectsRepo: ProjectsRepository,
  ) {}

  async start(params: {
    clientName: string
    projectName: string
    note?: string
    thresholdMinutes?: number
  }): Promise<StartResult> {
    const resolved = await this.resolveClientProject(params.clientName, params.projectName)
    if (!resolved.ok) {
      return resolved
    }

    const active = await this.sessionsRepo.getActive()
    if (
      active &&
      active.projectName === params.projectName &&
      active.clientName === params.clientName
    ) {
      return {
        variant: "sameActive",
        session: active,
      }
    }

    if (active) {
      return {
        variant: "conflict",
        activeSession: active,
        requestedClient: params.clientName,
        requestedProject: params.projectName,
      }
    }

    const session = await this.sessionsRepo.create({
      status: "active",
      startedAt: new Date().toISOString(),
      projectId: resolved.project.id,
      note: params.note ?? null,
      thresholdMinutes: params.thresholdMinutes ?? null,
    })

    return {
      variant: "started",
      sessionId: session.id,
      clientName: resolved.client.name,
      projectName: resolved.project.name,
    }
  }

  async stop(): Promise<StopResult> {
    const active = await this.sessionsRepo.getActive()
    if (!active) {
      return { variant: "noActive" }
    }

    await this.completeSession(active)

    return {
      variant: "stopped",
      sessionId: active.id,
      elapsedMinutes: active.elapsedMinutes,
    }
  }

  async switch(params: {
    clientName: string
    projectName: string
    note?: string
  }): Promise<SwitchResult> {
    const resolved = await this.resolveClientProject(params.clientName, params.projectName)
    if (!resolved.ok) {
      return resolved
    }

    const active = await this.sessionsRepo.getActive()
    if (!active) {
      return { variant: "noActiveToSwitch" }
    }

    await this.completeSession(active)

    const session = await this.sessionsRepo.create({
      status: "active",
      startedAt: new Date().toISOString(),
      projectId: resolved.project.id,
      note: params.note ?? null,
    })

    return {
      variant: "switched",
      completedSessionId: active.id,
      newSessionId: session.id,
      clientName: resolved.client.name,
      projectName: resolved.project.name,
    }
  }

  private async resolveClientProject(
    clientName: string,
    projectName: string,
  ): Promise<
    | { ok: true; client: Selectable<Client>; project: Selectable<Project> }
    | { ok: false; variant: "clientNotFound"; name: string }
    | { ok: false; variant: "clientArchived"; name: string }
    | { ok: false; variant: "projectNotFound"; name: string; clientName: string }
    | { ok: false; variant: "projectArchived"; name: string }
  > {
    const client = await this.clientsRepo.getByName(clientName)
    if (!client) {
      return { ok: false, variant: "clientNotFound", name: clientName }
    }
    if (client.archived) {
      return { ok: false, variant: "clientArchived", name: clientName }
    }

    const project = await this.projectsRepo.getByName(projectName)
    if (!project) {
      return { ok: false, variant: "projectNotFound", name: projectName, clientName }
    }
    if (project.archived) {
      return { ok: false, variant: "projectArchived", name: projectName }
    }

    return { ok: true, client, project }
  }

  private async completeSession(session: ActiveSession): Promise<void> {
    if (session.status === "paused") {
      const activePause = await this.pauseEventsRepo.getActivePause(session.id)
      if (activePause) {
        await this.pauseEventsRepo.resume(activePause.id)
      }
    }
    await this.sessionsRepo.complete({ sessionId: session.id, endedAt: new Date().toISOString() })
  }
}
