import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.transaction().execute(async (trx) => {
    // 1. clients
    await trx.schema
      .createTable("clients")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("name", "text", (col) => col.notNull().unique())
      .addColumn("archived", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .execute()

    // 2. projects
    await trx.schema
      .createTable("projects")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("client_id", "integer", (col) => col.references("clients.id").onDelete("set null"))
      .addColumn("name", "text", (col) => col.notNull().unique())
      .addColumn("description", "text")
      .addColumn("color", "text")
      .addColumn("archived", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .execute()

    // 3. sessions (CHECK constraint via addCheckConstraint)
    await trx.schema
      .createTable("sessions")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("project_id", "integer", (col) =>
        col.references("projects.id").onDelete("set null"),
      )
      .addColumn("note", "text")
      .addColumn("started_at", "text", (col) => col.notNull())
      .addColumn("ended_at", "text")
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("threshold_minutes", "integer")
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .addCheckConstraint("chk_sessions_status", sql`status IN ('active', 'paused', 'completed')`)
      .execute()

    // 4. tags
    await trx.schema
      .createTable("tags")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("name", "text", (col) => col.notNull().unique())
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .execute()

    // 5. session_tags (composite PK via addPrimaryKeyConstraint)
    await trx.schema
      .createTable("session_tags")
      .addColumn("session_id", "integer", (col) =>
        col.notNull().references("sessions.id").onDelete("cascade"),
      )
      .addColumn("tag_id", "integer", (col) =>
        col.notNull().references("tags.id").onDelete("cascade"),
      )
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .addPrimaryKeyConstraint("pk_session_tags", ["session_id", "tag_id"])
      .execute()

    // 6. pause_events
    await trx.schema
      .createTable("pause_events")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("session_id", "integer", (col) =>
        col.notNull().references("sessions.id").onDelete("cascade"),
      )
      .addColumn("paused_at", "text", (col) => col.notNull())
      .addColumn("resumed_at", "text")
      .addColumn("reason", "text")
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .execute()

    // 7. notification_events
    await trx.schema
      .createTable("notification_events")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("session_id", "integer", (col) =>
        col.notNull().references("sessions.id").onDelete("cascade"),
      )
      .addColumn("threshold_minutes", "integer", (col) => col.notNull())
      .addColumn("threshold_reached_at", "text", (col) => col.notNull())
      .addColumn("notification_sent_at", "text")
      .addColumn("notification_type", "text")
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .execute()

    // 8. app_state
    await trx.schema
      .createTable("app_state")
      .addColumn("key", "text", (col) => col.primaryKey().notNull())
      .addColumn("value", "text")
      .addColumn("updated_at", "text", (col) => col.notNull())
      .execute()

    // Indices (7)
    await trx.schema
      .createIndex("idx_sessions_project")
      .on("sessions")
      .column("project_id")
      .execute()

    await trx.schema
      .createIndex("idx_sessions_started")
      .on("sessions")
      .column("started_at")
      .execute()

    await trx.schema.createIndex("idx_sessions_status").on("sessions").column("status").execute()

    await trx.schema
      .createIndex("idx_session_tags_session")
      .on("session_tags")
      .column("session_id")
      .execute()

    await trx.schema
      .createIndex("idx_session_tags_tag")
      .on("session_tags")
      .column("tag_id")
      .execute()

    await trx.schema
      .createIndex("idx_pause_events_session")
      .on("pause_events")
      .column("session_id")
      .execute()

    await trx.schema
      .createIndex("idx_notification_events_session")
      .on("notification_events")
      .column("session_id")
      .execute()

    // Triggers (2)
    await sql`
      CREATE TRIGGER trg_clients_updated_at
      AFTER UPDATE ON clients
      BEGIN
        UPDATE clients SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `.execute(trx)

    await sql`
      CREATE TRIGGER trg_projects_updated_at
      AFTER UPDATE ON projects
      BEGIN
        UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `.execute(trx)
  })
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.transaction().execute(async (trx) => {
    // Drop triggers
    await sql`DROP TRIGGER IF EXISTS trg_clients_updated_at`.execute(trx)
    await sql`DROP TRIGGER IF EXISTS trg_projects_updated_at`.execute(trx)

    // Drop indices
    await trx.schema.dropIndex("idx_sessions_project").ifExists().execute()
    await trx.schema.dropIndex("idx_sessions_started").ifExists().execute()
    await trx.schema.dropIndex("idx_sessions_status").ifExists().execute()
    await trx.schema.dropIndex("idx_session_tags_session").ifExists().execute()
    await trx.schema.dropIndex("idx_session_tags_tag").ifExists().execute()
    await trx.schema.dropIndex("idx_pause_events_session").ifExists().execute()
    await trx.schema.dropIndex("idx_notification_events_session").ifExists().execute()

    // Drop tables in reverse dependency order
    await trx.schema.dropTable("notification_events").ifExists().execute()
    await trx.schema.dropTable("pause_events").ifExists().execute()
    await trx.schema.dropTable("session_tags").ifExists().execute()
    await trx.schema.dropTable("tags").ifExists().execute()
    await trx.schema.dropTable("sessions").ifExists().execute()
    await trx.schema.dropTable("projects").ifExists().execute()
    await trx.schema.dropTable("clients").ifExists().execute()
    await trx.schema.dropTable("app_state").ifExists().execute()
  })
}
