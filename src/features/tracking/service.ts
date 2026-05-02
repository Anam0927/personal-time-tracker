import type { Kysely, Selectable } from "kysely"

import { ClientsRepositoryImpl } from "@/features/clients/repo"
import { ProjectsRepositoryImpl } from "@/features/projects/repo"
import { ConstraintViolationError } from "@/lib/db/errors"
import type { Client, DB, Project, Tag } from "@/lib/db/types"

import type { PauseEventsRepository } from "./pause-events.repo"
import { PauseEventsRepositoryImpl } from "./pause-events.repo"
import type { ActiveSession } from "./sessions.repo"
import { SessionsRepositoryImpl } from "./sessions.repo"
import type { SessionStatus, TransitionResult } from "./state-machine"
import type { TagsRepository } from "./tags.repo"
import { TagsRepositoryImpl } from "./tags.repo"

class TagResolutionError extends Error {
  constructor(public readonly tagNames: string[]) {
    super("Tag resolution failed")
    this.name = "TagResolutionError"
  }
}

export type StartResult =
  | {
      variant: "started"
      sessionId: number
      clientName: string
      projectName: string
      tags: string[]
    }
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
  | { variant: "tagResolutionFailed"; errors: string[] }

type TransitionFailedResult = {
  variant: "transitionFailed"
  from: SessionStatus
  to: SessionStatus
  reason: string
}

export type StopResult =
  | { variant: "stopped"; sessionId: number; elapsedMinutes: number }
  | { variant: "noActive" }
  | TransitionFailedResult

export type SwitchResult =
  | {
      variant: "switched"
      completedSessionId: number
      newSessionId: number
      clientName: string
      projectName: string
      tags: string[]
    }
  | { variant: "noActiveToSwitch" }
  | TransitionFailedResult
  | { variant: "clientNotFound"; name: string }
  | { variant: "projectNotFound"; name: string; clientName: string }
  | { variant: "clientArchived"; name: string }
  | { variant: "projectArchived"; name: string }
  | { variant: "tagResolutionFailed"; errors: string[] }

export type UpdateTagsResult =
  | { variant: "updated"; tags: string[] }
  | { variant: "sessionNotFound" }
  | { variant: "tagResolutionFailed"; errors: string[] }

export interface TimerService {
  start(params: {
    clientName: string
    projectName: string
    note?: string
    thresholdMinutes?: number
    tags?: string[]
  }): Promise<StartResult>

  stop(): Promise<StopResult>

  switch(params: {
    clientName: string
    projectName: string
    note?: string
    tags?: string[]
  }): Promise<SwitchResult>

  updateTags(sessionId: number, tagNames: string[]): Promise<UpdateTagsResult>
}

export class TimerServiceImpl implements TimerService {
  private readonly sessionsRepo: SessionsRepositoryImpl
  private readonly clientsRepo: ClientsRepositoryImpl
  private readonly projectsRepo: ProjectsRepositoryImpl

  constructor(private readonly db: Kysely<DB>) {
    this.sessionsRepo = new SessionsRepositoryImpl(this.db)
    this.clientsRepo = new ClientsRepositoryImpl(this.db)
    this.projectsRepo = new ProjectsRepositoryImpl(this.db)
  }

  async start(params: {
    clientName: string
    projectName: string
    note?: string
    thresholdMinutes?: number
    tags?: string[]
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

    try {
      return await this.db.transaction().execute(async (tx) => {
        const sessionsRepo = new SessionsRepositoryImpl(tx)
        const tagsRepo = new TagsRepositoryImpl(tx)

        const session = await sessionsRepo.create({
          status: "active",
          startedAt: new Date().toISOString(),
          projectId: resolved.project.id,
          note: params.note ?? null,
          thresholdMinutes: params.thresholdMinutes ?? null,
        })

        const tagNames = await this.associateTagsWithSession(
          params.tags ?? [],
          session.id,
          tagsRepo,
        )

        return {
          variant: "started" as const,
          sessionId: session.id,
          clientName: resolved.client.name,
          projectName: resolved.project.name,
          tags: tagNames,
        }
      })
    } catch (error) {
      if (error instanceof TagResolutionError) {
        return { variant: "tagResolutionFailed", errors: error.tagNames }
      }
      throw error
    }
  }

  async stop(): Promise<StopResult> {
    const active = await this.sessionsRepo.getActive()
    if (!active) {
      return { variant: "noActive" }
    }

    return await this.db.transaction().execute(async (tx) => {
      const sessionsRepo = new SessionsRepositoryImpl(tx)
      const pauseEventsRepo = new PauseEventsRepositoryImpl(tx)

      const result = await sessionsRepo.transition({
        sessionId: active.id,
        from: active.status,
        to: "completed",
      })

      if (result.variant !== "transitioned") {
        return this.toTransitionFailed(result, active.status, "completed")
      }

      await this.resolveActivePause(active, pauseEventsRepo)

      return {
        variant: "stopped",
        sessionId: active.id,
        elapsedMinutes: active.elapsedMinutes,
      }
    })
  }

  async switch(params: {
    clientName: string
    projectName: string
    note?: string
    tags?: string[]
  }): Promise<SwitchResult> {
    const resolved = await this.resolveClientProject(params.clientName, params.projectName)
    if (!resolved.ok) {
      return resolved
    }

    const active = await this.sessionsRepo.getActive()
    if (!active) {
      return { variant: "noActiveToSwitch" }
    }

    try {
      return await this.db.transaction().execute(async (tx) => {
        const sessionsRepo = new SessionsRepositoryImpl(tx)
        const pauseEventsRepo = new PauseEventsRepositoryImpl(tx)
        const tagsRepo = new TagsRepositoryImpl(tx)

        const transitionResult = await sessionsRepo.transition({
          sessionId: active.id,
          from: active.status,
          to: "completed",
        })

        if (transitionResult.variant !== "transitioned") {
          return this.toTransitionFailed(transitionResult, active.status, "completed")
        }

        await this.resolveActivePause(active, pauseEventsRepo)

        const session = await sessionsRepo.create({
          status: "active",
          startedAt: new Date().toISOString(),
          projectId: resolved.project.id,
          note: params.note ?? null,
        })

        const tagNames = await this.associateTagsWithSession(
          params.tags ?? [],
          session.id,
          tagsRepo,
        )

        return {
          variant: "switched" as const,
          completedSessionId: active.id,
          newSessionId: session.id,
          clientName: resolved.client.name,
          projectName: resolved.project.name,
          tags: tagNames,
        }
      })
    } catch (error) {
      if (error instanceof TagResolutionError) {
        return { variant: "tagResolutionFailed", errors: error.tagNames }
      }
      throw error
    }
  }

  async updateTags(sessionId: number, tagNames: string[]): Promise<UpdateTagsResult> {
    const session = await this.sessionsRepo.getById(sessionId)
    if (!session) {
      return { variant: "sessionNotFound" }
    }

    try {
      return await this.db.transaction().execute(async (tx) => {
        const tagsRepo = new TagsRepositoryImpl(tx)

        await tagsRepo.removeAllSessionTags(sessionId)
        const resolvedTags = await this.associateTagsWithSession(tagNames, sessionId, tagsRepo)

        return { variant: "updated" as const, tags: resolvedTags }
      })
    } catch (error) {
      if (error instanceof TagResolutionError) {
        return { variant: "tagResolutionFailed", errors: error.tagNames }
      }
      throw error
    }
  }

  private async resolveTags(
    tagNames: string[],
    tagsRepo: TagsRepository,
  ): Promise<Selectable<Tag>[]> {
    const uniqueNames = [...new Set(tagNames)]
    const resolved: Selectable<Tag>[] = []

    for (const name of uniqueNames) {
      let tag = await tagsRepo.getByName(name)
      if (!tag) {
        try {
          tag = await tagsRepo.create(name)
        } catch (error) {
          if (error instanceof ConstraintViolationError) {
            tag = await tagsRepo.getByName(name)
            if (!tag) throw new TagResolutionError([name])
          } else {
            throw error
          }
        }
      }
      resolved.push(tag)
    }

    return resolved
  }

  private async associateTagsWithSession(
    tagNames: string[],
    sessionId: number,
    tagsRepo: TagsRepository,
  ): Promise<string[]> {
    if (!tagNames || tagNames.length === 0) return []
    const tags = await this.resolveTags(tagNames, tagsRepo)
    await Promise.all(
      tags.map((t) =>
        tagsRepo.addToSession({
          tagId: t.id,
          sessionId,
        }),
      ),
    )
    return tags.map((t) => t.name)
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

  private toTransitionFailed(
    result: TransitionResult,
    from: SessionStatus,
    to: SessionStatus,
  ): TransitionFailedResult {
    if (result.variant === "invalidTransition") {
      return {
        variant: "transitionFailed",
        from: result.from,
        to: result.to,
        reason: `Invalid transition from ${result.from} to ${result.to}`,
      }
    }
    if (result.variant === "staleState") {
      return {
        variant: "transitionFailed",
        from: result.expected,
        to,
        reason: `Expected status ${result.expected} but actual is ${result.actual}`,
      }
    }
    return {
      variant: "transitionFailed",
      from,
      to,
      reason: "Session not found",
    }
  }

  private async resolveActivePause(
    session: ActiveSession,
    pauseEventsRepo: PauseEventsRepository,
  ): Promise<void> {
    if (session.status !== "paused") return

    const activePause = await pauseEventsRepo.getActivePause(session.id)
    if (activePause) await pauseEventsRepo.resume(activePause.id)
  }
}
