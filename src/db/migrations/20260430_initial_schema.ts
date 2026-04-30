import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx.schema
      .createTable("projects")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("name", "text", (col) => col.notNull().unique())
      .addColumn("description", "text")
      .addColumn("color", "text")
      .addColumn("archived", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .execute()

    await trx.schema
      .createTable("time_entries")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("project_id", "integer", (col) =>
        col.references("projects.id").onDelete("set null"),
      )
      .addColumn("description", "text", (col) => col.notNull())
      .addColumn("started_at", "text", (col) => col.notNull())
      .addColumn("ended_at", "text")
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .execute()

    await trx.schema
      .createTable("tags")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("name", "text", (col) => col.notNull().unique())
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .execute()

    await trx.schema
      .createTable("entry_tags")
      .addColumn("time_entry_id", "integer", (col) =>
        col.notNull().references("time_entries.id").onDelete("cascade"),
      )
      .addColumn("tag_id", "integer", (col) =>
        col.notNull().references("tags.id").onDelete("cascade"),
      )
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .execute()

    await trx.schema
      .createIndex("idx_time_entries_project_id")
      .on("time_entries")
      .column("project_id")
      .execute()

    await trx.schema
      .createIndex("idx_time_entries_started_at")
      .on("time_entries")
      .column("started_at")
      .execute()

    await trx.schema
      .createIndex("idx_time_entries_ended_at")
      .on("time_entries")
      .column("ended_at")
      .execute()

    await trx.schema
      .createIndex("idx_entry_tags_time_entry_id")
      .on("entry_tags")
      .column("time_entry_id")
      .execute()

    await trx.schema
      .createIndex("idx_entry_tags_tag_id")
      .on("entry_tags")
      .column("tag_id")
      .execute()

    await sql`
      CREATE TRIGGER update_projects_updated_at
      AFTER UPDATE ON projects
      BEGIN
        UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `.execute(trx)
  })
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await sql`DROP TRIGGER IF EXISTS update_projects_updated_at`.execute(trx)

    await trx.schema.dropIndex("idx_entry_tags_tag_id").ifExists().execute()
    await trx.schema.dropIndex("idx_entry_tags_time_entry_id").ifExists().execute()
    await trx.schema.dropIndex("idx_time_entries_ended_at").ifExists().execute()
    await trx.schema.dropIndex("idx_time_entries_started_at").ifExists().execute()
    await trx.schema.dropIndex("idx_time_entries_project_id").ifExists().execute()

    await trx.schema.dropTable("entry_tags").ifExists().execute()
    await trx.schema.dropTable("time_entries").ifExists().execute()
    await trx.schema.dropTable("tags").ifExists().execute()
    await trx.schema.dropTable("projects").ifExists().execute()
  })
}
