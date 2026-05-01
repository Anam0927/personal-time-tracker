import { mkdirSync, existsSync } from "node:fs"
import * as path from "node:path"

import { xdgData } from "xdg-basedir"

const MODULE_NAME = "time-tracker"

export function getDbDir(): string {
  if (!xdgData) {
    throw new Error("XDG_DATA_HOME is not set. Cannot determine database directory.")
  }
  return path.join(xdgData, MODULE_NAME)
}

export function getDbPath(): string {
  return path.join(getDbDir(), "db.sqlite")
}

export function ensureDbDir(): string {
  const dir = getDbDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}
