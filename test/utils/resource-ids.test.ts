import {
  buildResourceName,
  extractResourceId,
  ResourceTypes
} from "@/lib/workflow/utils/resource-ids";

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

  describe("buildResourceName", () => {
    it("builds simple resource name", () => {
      expect(
        buildResourceName(ResourceTypes.InboundSsoAssignments, "abc123")
      ).toBe("inboundSsoAssignments/abc123");
    });

    it("builds resource name with prefix", () => {
      expect(
        buildResourceName(
          ResourceTypes.InboundSsoAssignments,
          "abc123",
          "customers/C123"
        )
      ).toBe("customers/C123/inboundSsoAssignments/abc123");
    });
  });
});
