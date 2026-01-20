import { describe, expect, jest, test } from "bun:test";

import type { StepCheckContext } from "@/types";

import configureMicrosoftSso from "@/lib/workflow/steps/configure-microsoft-sso";
import { Var } from "@/lib/workflow/variables";

const getMockMicrosoftResponse = (url: string, start: string, future: string) =>
  url.includes("organization")
    ? { value: [{ id: "tenant-123" }] }
    : {
        id: "sp-123",
        appId: "app-123",
        displayName: "Test App",
        preferredSingleSignOnMode: "saml",
        samlSingleSignOnSettings: { relayState: null },
        keyCredentials: [
          {
            key: "cert-key",
            startDateTime: start,
            endDateTime: future,
            usage: "Verify",
          },
        ],
      };

describe("ConfigureMicrosoftSso Step", () => {
  const mockMarkComplete = jest.fn();
  const mockMarkIncomplete = jest.fn();
  const mockMarkCheckFailed = jest.fn((...args) =>
    console.log("CheckFailed:", ...args)
  );
  const mockLog = jest.fn((...args) => console.log("Log:", ...args));

  const baseVars = {
    [Var.MsGraphToken]: "fake-token",
    [Var.SsoServicePrincipalId]: "sp-123",
    [Var.SsoAppId]: "app-123",
    [Var.EntityId]: "entity-123",
    [Var.AcsUrl]: "https://acs.url",
  };

  const createMockContext = (fetchMicrosoftImpl: unknown) => ({
    vars: baseVars,
    fetchMicrosoft: fetchMicrosoftImpl,
    fetchGoogle: jest.fn(),
    markComplete: mockMarkComplete,
    markIncomplete: mockMarkIncomplete,
    markCheckFailed: mockMarkCheckFailed,
    markStale: jest.fn(),
    log: mockLog,
  });

  test("check should mark incomplete if SSO mode is not saml", async () => {
    const fetchMicrosoft = jest.fn().mockResolvedValue({
      id: "sp-123",
      appId: "app-123",
      displayName: "Test App",
      preferredSingleSignOnMode: "password",
      samlSingleSignOnSettings: null,
    });

    await configureMicrosoftSso.check(
      createMockContext(fetchMicrosoft) as unknown as StepCheckContext<unknown>
    );

    expect(mockMarkIncomplete).toHaveBeenCalledWith(
      "Microsoft SSO not configured",
      {}
    );
  });

  test("check should mark complete if configured and certificate active", async () => {
    const now = new Date();
    // Ensure start time is slightly in the past to be active
    const start = new Date(now.getTime() - 1000);
    const future = new Date(now.getTime() + 100_000);

    const fetchMicrosoft = jest
      .fn()
      .mockImplementation((url: string) =>
        getMockMicrosoftResponse(url, start.toISOString(), future.toISOString())
      );

    await configureMicrosoftSso.check(
      createMockContext(fetchMicrosoft) as unknown as StepCheckContext<unknown>
    );

    expect(mockMarkComplete).toHaveBeenCalledWith({
      msSigningCertificate: "cert-key",
      msSsoEntityId: "https://sts.windows.net/tenant-123/",
      msSsoLoginUrl: "https://login.microsoftonline.com/tenant-123/saml2",
    });
  });

  test("check should mark incomplete if certificate is expired", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 100_000);

    const fetchMicrosoft = jest.fn().mockImplementation(() => ({
      id: "sp-123",
      appId: "app-123",
      displayName: "Test App",
      preferredSingleSignOnMode: "saml",
      samlSingleSignOnSettings: { relayState: null },
      keyCredentials: [
        {
          key: "cert-key",
          startDateTime: past.toISOString(),
          endDateTime: past.toISOString(),
          usage: "Verify",
        },
      ],
    }));

    await configureMicrosoftSso.check(
      createMockContext(fetchMicrosoft) as unknown as StepCheckContext<unknown>
    );

    expect(mockMarkIncomplete).toHaveBeenCalled();
  });
});
