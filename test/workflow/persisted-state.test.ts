import {
  parsePersistedState,
  prepareStateForPersistence
} from "@/lib/workflow/schemas/persisted-state";
import { Var } from "@/types";

describe("Persisted state validation", () => {
  it("should parse valid state", () => {
    const input = {
      vars: {
        [Var.PrimaryDomain]: "example.com",
        [Var.IsDomainVerified]: "true"
      },
      status: {
        "verify-primary-domain": {
          status: "complete",
          summary: "Domain verified"
        }
      }
    } as const;

    const result = parsePersistedState(input);
    expect(result).toEqual(input);
  });

  it("should filter out ephemeral variables", () => {
    const input = {
      vars: {
        [Var.PrimaryDomain]: "example.com",
        [Var.GeneratedPassword]: "secret123",
        [Var.VerificationToken]: "token123"
      },
      status: {}
    } as const;

    const result = parsePersistedState(input);
    expect(result?.vars).toEqual({
      [Var.PrimaryDomain]: "example.com",
      [Var.GeneratedPassword]: "secret123"
    });
  });

  it("should return null for invalid data", () => {
    const invalid = { vars: { invalidVar: "value" } };

    const result = parsePersistedState(invalid);
    expect(result).toBeNull();
  });

  it("should prepare state for persistence", () => {
    const vars = {
      [Var.PrimaryDomain]: "example.com",
      [Var.GeneratedPassword]: "secret123"
    };
    const status = {};

    const json = prepareStateForPersistence(vars, status);
    const parsed = JSON.parse(json);

    expect(parsed.vars[Var.GeneratedPassword]).toBe("secret123");
    expect(parsed.vars[Var.PrimaryDomain]).toBe("example.com");
  });
});
