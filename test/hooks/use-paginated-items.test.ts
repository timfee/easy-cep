import { expect, test } from "bun:test";
import { usePaginatedItems } from "@/hooks/use-paginated-items";

test("usePaginatedItems exports a function", () => {
  expect(typeof usePaginatedItems).toBe("function");
});
