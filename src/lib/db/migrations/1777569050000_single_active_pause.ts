import { type Kysely } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex("idx_pause_events_single_active")
    .unique()
    .on("pause_events")
    .columns(["session_id"])
    // @ts-expect-error
    .where("resumed_at", "is", null)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_pause_events_single_active").ifExists().execute()
}
