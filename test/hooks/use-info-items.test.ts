import { expect, test } from "bun:test";
import { useInfoItems } from "@/hooks/use-info-items";

test("useInfoItems exports a function", () => {
  expect(typeof useInfoItems).toBe("function");
});
