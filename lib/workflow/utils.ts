import { LogLevel } from "@/types";
import { z } from "zod";
import { isNotFoundError } from "./errors";

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

export async function safeDelete<T>(
  deleteFn: () => Promise<T>,
  log: (level: LogLevel, message: string, data?: unknown) => void,
  resourceType: string
): Promise<void> {
  try {
    await deleteFn();
  } catch (error) {
    if (isNotFoundError(error)) {
      log(LogLevel.Info, `${resourceType} already deleted or not found`);
    } else {
      throw error;
    }
  }
}
