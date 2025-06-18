import { z } from "zod";

/**
 * Check if an error is a 409 Conflict error
 */
export function isConflictError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("409");
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
