/**
 * Domain types for reporting only. Entity types live in src/db/types.ts
 */

export interface TimeTotals {
  totalMinutes: number
}

export interface ReportRow {
  label: string
  totalMinutes: number
}

export interface ReportResult {
  rows: ReportRow[]
  totals: TimeTotals
}
