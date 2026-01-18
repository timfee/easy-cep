import { inspect } from "node:util";
import { HttpStatus } from "@/types";
import type { WorkflowVars } from "../variables";

/**
 * Base HTTP error with status metadata.
 */
export class HttpError extends Error {
  statusCode: number;
  statusText: string;
  responseBody?: unknown;

  constructor(statusCode: number, statusText: string, responseBody?: unknown) {
    super(`HTTP ${statusCode}: ${statusText}`);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.statusText = statusText;
    this.responseBody = responseBody;
  }
}

/**
 * 404 not found error.
 */
export class NotFoundError extends HttpError {
  constructor(message = "Resource not found", responseBody?: unknown) {
    super(HttpStatus.NotFound, message, responseBody);
    this.name = "NotFoundError";
  }
}

/**
 * 409 conflict error.
 */
export class ConflictError extends HttpError {
  constructor(message = "Resource conflict", responseBody?: unknown) {
    super(HttpStatus.Conflict, message, responseBody);
    this.name = "ConflictError";
  }
}

/**
 * 412 precondition failed error.
 */
export class PreconditionFailedError extends HttpError {
  constructor(message = "Precondition failed", responseBody?: unknown) {
    super(HttpStatus.PreconditionFailed, message, responseBody);
    this.name = "PreconditionFailedError";
  }
}

/**
 * 400 bad request error.
 */
export class BadRequestError extends HttpError {
  constructor(message = "Bad request", responseBody?: unknown) {
    super(HttpStatus.BadRequest, message, responseBody);
    this.name = "BadRequestError";
  }
}

/**
 * Type guard for HttpError with optional status filter.
 */
export function isHttpError(
  error: unknown,
  statusCode?: number
): error is HttpError {
  if (!(error instanceof HttpError)) {
    return false;
  }
  return statusCode === undefined || error.statusCode === statusCode;
}

/**
 * Type guard for NotFoundError.
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return (
    error instanceof NotFoundError || isHttpError(error, HttpStatus.NotFound)
  );
}

/**
 * Type guard for ConflictError.
 */
export function isConflictError(error: unknown): error is ConflictError {
  return (
    error instanceof ConflictError || isHttpError(error, HttpStatus.Conflict)
  );
}

/**
 * Type guard for PreconditionFailedError.
 */
export function isPreconditionFailedError(
  error: unknown
): error is PreconditionFailedError {
  return (
    error instanceof PreconditionFailedError ||
    isHttpError(error, HttpStatus.PreconditionFailed)
  );
}

/**
 * Type guard for BadRequestError.
 */
export function isBadRequestError(error: unknown): error is BadRequestError {
  return (
    error instanceof BadRequestError ||
    isHttpError(error, HttpStatus.BadRequest)
  );
}

/**
 * Log uncaught workflow errors with redacted variables.
 */
export function logUncaughtError(
  error: unknown,
  context: { stepId?: string; operation?: string; vars: Partial<WorkflowVars> }
) {
  console.error("\n**** UNCAUGHT ERROR *****");
  console.error(`Step: ${context.stepId || "unknown"}`);
  console.error(`Operation: ${context.operation || "unknown"}`);

  const sanitizedVars: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context.vars)) {
    const redacted =
      key.toLowerCase().includes("token") ||
      key.toLowerCase().includes("certificate") ||
      key.toLowerCase().includes("password");
    sanitizedVars[key] = redacted ? "[REDACTED]" : value;
  }

  console.error(
    "Variables:",
    inspect(sanitizedVars, { depth: 3, colors: true })
  );
  console.error("Error:", inspect(error, { depth: null, colors: true }));
  console.error("******** /UNCAUGHT ERROR ********\n");
}
