import type { ReportResult } from "../types"
import type { ReportScope } from "./schemas"

/**
 * Reporting service boundary.
 * TODO(AA-379): Compose report queries and formatting for CLI/TUI consumption.
 */
export interface ReportingService {
  generate(scope: ReportScope): Promise<ReportResult>
}

const notImplementedError = (methodName: string): Error => {
  return new Error(`ReportingService.${methodName} is not implemented yet.`)
}

export class ReportingServiceStub implements ReportingService {
  async generate(_scope: ReportScope): Promise<ReportResult> {
    throw notImplementedError("generate")
  }
}
