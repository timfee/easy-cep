import { logUncaughtError } from "@/lib/workflow/utils/error-reporter";
import { jest } from "@jest/globals";

describe("logUncaughtError", () => {
  it("redacts sensitive variables", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    logUncaughtError(new Error("fail"), {
      stepId: "test",
      operation: "execute",
      vars: {
        googleAccessToken: "secret",
        plainVar: "value",
        somePassword: "pass"
      } as any
    });

    const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("plainVar");

    spy.mockRestore();
  });
});
