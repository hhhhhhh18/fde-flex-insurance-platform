/** Typed application errors mapped to HTTP responses by the route wrapper. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(404, "NOT_FOUND", `${entity} ${id} was not found.`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, "CONFLICT", message, details);
  }
}

export class InputError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, "INVALID_INPUT", message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, details?: unknown) {
    super(403, "FORBIDDEN", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Acting role is not recognised.") {
    super(401, "UNAUTHORIZED", message);
  }
}
