import { describe, expect, it, spyOn } from "bun:test";
import { logUncaughtError } from "@/lib/workflow/core/errors";

describe("logUncaughtError", () => {
  it("redacts sensitive variables", () => {
    const spy = spyOn(console, "error").mockImplementation(() => {
      /* ignore error output in tests */
    });

    logUncaughtError(new Error("fail"), {
      stepId: "test",
      operation: "execute",
      vars: {
        googleAccessToken: "secret",
        plainVar: "value",
        somePassword: "pass",
      },
    });

    const output = spy.mock.calls
      .map((call: string[]) => call.join(" "))
      .join("\n");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("plainVar");

    spy.mockRestore();
  });
});
