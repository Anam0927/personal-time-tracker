import { type Kysely } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex("idx_sessions_single_active")
    .unique()
    .on("sessions")
    .column("status")
    .where("status", "=", "active")
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_sessions_single_active").ifExists().execute()
}
