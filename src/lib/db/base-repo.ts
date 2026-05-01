import type { Kysely, Transaction } from "kysely"

import type { DB } from "./types"

export abstract class BaseRepository {
  constructor(protected readonly db: Kysely<DB> | Transaction<DB>) {}
}
