import { expect, test } from "bun:test";
import { useMultiSelect } from "@/hooks/use-multi-select";

test("useMultiSelect exports a function", () => {
  expect(typeof useMultiSelect).toBe("function");
});
