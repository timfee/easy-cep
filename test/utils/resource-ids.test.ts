import { describe, expect, it } from "bun:test";
import { extractResourceId, ResourceTypes } from "@/lib/workflow/core/http";

describe("Resource ID utilities", () => {
  describe("extractResourceId", () => {
    it("extracts ID from simple resource name", () => {
      expect(
        extractResourceId(
          "inboundSsoAssignments/abc123",
          ResourceTypes.InboundSsoAssignments
        )
      ).toBe("abc123");
    });

    it("extracts ID from nested resource name", () => {
      expect(
        extractResourceId(
          "customers/C123/inboundSsoAssignments/abc123",
          ResourceTypes.InboundSsoAssignments
        )
      ).toBe("abc123");
    });

    it("returns input if already an ID", () => {
      expect(
        extractResourceId("abc123", ResourceTypes.InboundSsoAssignments)
      ).toBe("abc123");
    });

    it("handles IDs with special characters", () => {
      expect(
        extractResourceId(
          "inboundSsoAssignments/abc-123_456",
          ResourceTypes.InboundSsoAssignments
        )
      ).toBe("abc-123_456");
    });
  });
});
