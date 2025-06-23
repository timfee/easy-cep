import { WorkflowVars } from "@/types";
import { inspect } from "node:util";
import { HttpStatus } from "../http-constants";

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
    super(HttpStatus.NotFound, message, responseBody);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Resource conflict", responseBody?: unknown) {
    super(HttpStatus.Conflict, message, responseBody);
    this.name = "ConflictError";
  }
}

export class PreconditionFailedError extends HttpError {
  constructor(message = "Precondition failed", responseBody?: unknown) {
    super(HttpStatus.PreconditionFailed, message, responseBody);
    this.name = "PreconditionFailedError";
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad request", responseBody?: unknown) {
    super(HttpStatus.BadRequest, message, responseBody);
    this.name = "BadRequestError";
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
  return (
    error instanceof NotFoundError || isHttpError(error, HttpStatus.NotFound)
  );
}

export function isConflictError(error: unknown): error is ConflictError {
  return (
    error instanceof ConflictError || isHttpError(error, HttpStatus.Conflict)
  );
}

export function isPreconditionFailedError(
  error: unknown
): error is PreconditionFailedError {
  return (
    error instanceof PreconditionFailedError
    || isHttpError(error, HttpStatus.PreconditionFailed)
  );
}

export function isBadRequestError(error: unknown): error is BadRequestError {
  return (
    error instanceof BadRequestError
    || isHttpError(error, HttpStatus.BadRequest)
  );
}

export function logUncaughtError(
  error: unknown,
  context: { stepId?: string; operation?: string; vars: Partial<WorkflowVars> }
) {
  console.error("\n**** UNCAUGHT ERROR *****");
  console.error(`Step: ${context.stepId || "unknown"}`);
  console.error(`Operation: ${context.operation || "unknown"}`);

  const sanitizedVars = Object.entries(context.vars).reduce(
    (acc, [key, value]) => {
      if (
        key.toLowerCase().includes("token")
        || key.toLowerCase().includes("certificate")
        || key.toLowerCase().includes("password")
      ) {
        acc[key] = "[REDACTED]";
      } else {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, unknown>
  );

  console.error(
    "Variables:",
    inspect(sanitizedVars, { depth: 3, colors: true })
  );
  console.error("Error:", inspect(error, { depth: null, colors: true }));
  console.error("******** /UNCAUGHT ERROR ********\n");
}
