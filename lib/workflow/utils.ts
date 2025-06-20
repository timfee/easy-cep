import { z } from "zod";

// Re-export error utilities from errors.ts
export {
  isConflictError,
  isHttpError,
  isNotFoundError,
  isPreconditionFailedError
} from "./errors";

export const EmptyResponseSchema = z.object({});

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
