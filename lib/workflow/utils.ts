import { z } from "zod";

/**
 * HTTP error detection utilities
 */
export function isHttpError(error: unknown, statusCode: number): boolean {
  if (!(error instanceof Error)) return false;
  const patterns = [
    `HTTP ${statusCode}`,
    `${statusCode}:`,
    `code": ${statusCode}`,
    `"code":${statusCode}`
  ];
  return patterns.some((pattern) => error.message.includes(pattern));
}

export function isNotFoundError(error: unknown): boolean {
  return isHttpError(error, 404);
}

export function isConflictError(error: unknown): boolean {
  return isHttpError(error, 409);
}

export function isPreconditionFailedError(error: unknown): boolean {
  return isHttpError(error, 412);
}

export function getErrorStatusCode(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/HTTP (\d{3})|(\d{3}):|code":\s*(\d{3})/);
  if (match) {
    return parseInt(match[1] || match[2] || match[3], 10);
  }
  return null;
}

/**
 * Schema for empty 204 responses
 */
export const EmptyResponseSchema = z.object({});

/**
 * Find an item in a tree structure
 */
export function findInTree<T>(
  items: T[],
  predicate: (item: T) => boolean,
  getChildren: (item: T) => T[] | undefined
): T | undefined {
  for (const item of items) {
    if (predicate(item)) return item;
    const children = getChildren(item);
    if (children) {
      const found = findInTree(children, predicate, getChildren);
      if (found) return found;
    }
  }
  return undefined;
}
