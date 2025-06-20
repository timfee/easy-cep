export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public statusText: string,
    public responseBody?: unknown
  ) {
    super(`HTTP ${statusCode}: ${statusText}`);
    this.name = "HttpError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Resource not found", responseBody?: unknown) {
    super(404, message, responseBody);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Resource conflict", responseBody?: unknown) {
    super(409, message, responseBody);
    this.name = "ConflictError";
  }
}

export class PreconditionFailedError extends HttpError {
  constructor(message = "Precondition failed", responseBody?: unknown) {
    super(412, message, responseBody);
    this.name = "PreconditionFailedError";
  }
}

export function isHttpError(
  error: unknown,
  statusCode?: number
): error is HttpError {
  if (!(error instanceof HttpError)) return false;
  return statusCode === undefined || error.statusCode === statusCode;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError || isHttpError(error, 404);
}

export function isConflictError(error: unknown): error is ConflictError {
  return error instanceof ConflictError || isHttpError(error, 409);
}

export function isPreconditionFailedError(
  error: unknown
): error is PreconditionFailedError {
  return error instanceof PreconditionFailedError || isHttpError(error, 412);
}
