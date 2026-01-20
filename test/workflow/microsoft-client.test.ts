import { describe, expect, it } from "bun:test";

import { MicrosoftClient } from "@/lib/workflow/http/microsoft-client";
import type  { HttpClient } from "@/lib/workflow/types/http-client";

const sampleResponse = {
  preferredSingleSignOnMode: "saml",
  samlSingleSignOnSettings: { relayState: "" },
};

describe("MicrosoftClient getPartial", () => {
  it("parses partial service principal responses", async () => {
    const client: HttpClient = {
      request: (_url, schema) => Promise.resolve(schema.parse(sampleResponse)),
    };

    const ms = new MicrosoftClient(client);
    const result = await ms.servicePrincipals.getPartial("id").get();
    expect(result).toEqual(sampleResponse);
  });
});
