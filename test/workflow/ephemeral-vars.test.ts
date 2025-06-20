import { filterEphemeralVars } from "@/components/workflow-context";
import { Var } from "@/types";

describe("Ephemeral variable filtering", () => {
  it("should remove ephemeral variables from persistence", () => {
    const vars = {
      [Var.GeneratedPassword]: "secret123",
      [Var.PrimaryDomain]: "example.com",
      [Var.VerificationToken]: "token123"
    } as const;

    const filtered = filterEphemeralVars(vars);

    expect(filtered[Var.GeneratedPassword]).toBeUndefined();
    expect(filtered[Var.VerificationToken]).toBeUndefined();
    expect(filtered[Var.PrimaryDomain]).toBe("example.com");
  });
});
