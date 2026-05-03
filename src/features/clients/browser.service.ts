import type { Kysely, Selectable } from "kysely"

import { ClientsRepositoryImpl } from "@/features/clients/repo.js"
import { ProjectsRepositoryImpl } from "@/features/projects/repo.js"
import type { DB } from "@/lib/db/types.js"
import type { Client, Project } from "@/lib/db/types.js"

export interface ClientNode {
  client: Selectable<Client>
  projects: Selectable<Project>[]
}

export interface ClientProjectTree {
  clients: ClientNode[]
}

export class BrowserService {
  private readonly clientsRepo: ClientsRepositoryImpl
  private readonly projectsRepo: ProjectsRepositoryImpl

  constructor(private readonly db: Kysely<DB>) {
    this.clientsRepo = new ClientsRepositoryImpl(db)
    this.projectsRepo = new ProjectsRepositoryImpl(db)
  }

  async getTree(opts?: { includeArchived?: boolean }): Promise<ClientProjectTree> {
    const clients = await this.clientsRepo.list(opts)

    // Single query for all projects, then group by clientId in memory
    const allProjects = await this.projectsRepo.list(opts)
    const projectsByClient = new Map<number, Selectable<Project>[]>()
    for (const project of allProjects) {
      if (project.clientId === null) {
        continue
      }
      const arr = projectsByClient.get(project.clientId) ?? []
      arr.push(project)
      projectsByClient.set(project.clientId, arr)
    }

    const clientNodes = clients.map((client) => ({
      client,
      projects: projectsByClient.get(Number(client.id)) ?? [],
    })) satisfies ClientNode[]

    return { clients: clientNodes }
  }
}
