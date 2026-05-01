export class NotFoundError extends Error {
  public readonly entityName: string
  public readonly id: number

  constructor(entityName: string, id: number) {
    super(`${entityName} with id ${id} not found`)
    this.name = "NotFoundError"
    this.entityName = entityName
    this.id = id
  }
}

export class ConstraintViolationError extends Error {
  public readonly entityName: string
  public readonly field: string

  constructor(entityName: string, field: string) {
    super(`${entityName} ${field} violates a unique constraint`)
    this.name = "ConstraintViolationError"
    this.entityName = entityName
    this.field = field
  }
}
