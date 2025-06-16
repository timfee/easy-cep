import { LogLevel, StepId, StepOutcome, Var } from "@/types";
import { createStep } from "../create-step";

export default createStep({
  id: StepId.VerifyPrimaryDomain,
  requires: [Var.GoogleAccessToken],
  provides: [Var.CustomerId, Var.PrimaryDomain, Var.IsDomainVerified],

  async check(vars, ctx) {
    const res = await ctx.fetch(
      "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains",
      {
        headers: { Authorization: `Bearer ${vars[Var.GoogleAccessToken]}` }
      }
    );

    const json: {
      domains?: {
        domainName?: string;
        customerId?: string;
        isPrimary?: boolean;
        verified?: boolean;
      }[];
    } = await res.json();

    const primary = json.domains?.find((d) => d.isPrimary);
    let summary = "No primary domain";
    if (primary) {
      if (primary.verified) {
        summary = "Primary domain verified";
      } else {
        summary = "Primary domain not verified";
      }
    }

    return {
      isComplete: primary?.verified === true,
      summary,
      data: primary
        ? {
            primaryDomain: primary.domainName,
            customerId: primary.customerId,
            isDomainVerified: primary.verified
          }
        : undefined
    };
  },

  async execute(vars, ctx, checkResult) {
    const data = checkResult.data ?? {};
    const domainName =
      typeof data["primaryDomain"] === "string" ? data["primaryDomain"] : "";
    const customerId =
      typeof data["customerId"] === "string" ? data["customerId"] : "";
    const verified =
      typeof data["isDomainVerified"] === "boolean"
        ? data["isDomainVerified"]
        : false;

    if (verified) {
      ctx.log(LogLevel.Info, "Domain already verified");
      return {
        status: StepOutcome.Skipped,
        output: {
          [Var.PrimaryDomain]: domainName,
          [Var.CustomerId]: customerId,
          [Var.IsDomainVerified]: verified
        }
      };
    }

    ctx.log(LogLevel.Info, "Adding primary domain");
    const res = await ctx.fetch(
      "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vars[Var.GoogleAccessToken]}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ domainName })
      }
    );

    if (res.status === 409) {
      ctx.log(LogLevel.Info, "Domain already exists");
    }

    return {
      status: StepOutcome.Succeeded,
      output: {
        [Var.PrimaryDomain]: domainName,
        [Var.CustomerId]: customerId,
        [Var.IsDomainVerified]: verified
      }
    };
  }
});

/**
Check Response:
HTTP/1.1 200 OK
{
  "kind": "admin#directory#domains",
  "domains": [
    {
      "domainName": "cep-netnew.cc",
      "isPrimary": true,
      "verified": true
    }
  ]
}

Execute Response (409 Conflict when already added):
HTTP/1.1 409 Conflict
{
  "error": {
    "code": 409,
    "message": "Domain is already set up.",
    "errors": [
      { "message": "Domain is already set up.", "reason": "duplicate" }
    ]
  }
}
*/
