import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep } from "../create-step";

interface CheckData {
  isDomainVerified: boolean;
  primaryDomain?: string;
  verificationToken?: string;
  verificationMethod?: string;
}

export default createStep<CheckData>({
  id: StepId.VerifyPrimaryDomain,
  requires: [Var.GoogleAccessToken],
  provides: [Var.IsDomainVerified, Var.PrimaryDomain],

  /**
   * GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains
   *
   * Completed step example response
   *
   * 200
   * {
   *   "domains": [
   *     {
   *       "domainName": "cep-netnew.cc",
   *       "isPrimary": true,
   *       "verified": true
   *     }
   *   ]
   * }
   *
   * Incomplete step example response
   *
   * 200
   * { "domains": [] }
   */

  async check({
    fetchGoogle,
    markComplete,
    markIncomplete,
    markCheckFailed,
    log
  }) {
    try {
      const DomainsResponse = z.object({
        domains: z.array(
          z.object({
            domainName: z.string(),
            isPrimary: z.boolean(),
            verified: z.boolean()
          })
        )
      });

      const { domains } = await fetchGoogle(
        ApiEndpoint.Google.Domains,
        DomainsResponse,
        { flatten: true }
      );

      const primary = domains.find((d) => d.isPrimary);

      if (primary?.verified) {
        log(LogLevel.Info, "Primary domain already verified");
        markComplete({
          isDomainVerified: true,
          primaryDomain: primary.domainName
        });
        return;
      }

      if (primary) {
        const TokenSchema = z.object({
          method: z.string(),
          type: z.string(),
          site: z.object({ type: z.string(), identifier: z.string() }),
          token: z.string()
        });

        try {
          const verificationData = await fetchGoogle(
            `${ApiEndpoint.Google.SiteVerification}/token`,
            TokenSchema,
            {
              method: "POST",
              body: JSON.stringify({
                site: { type: "INET_DOMAIN", identifier: primary.domainName },
                verificationMethod: "DNS_TXT"
              })
            }
          );

          markIncomplete("Domain verification pending", {
            isDomainVerified: false,
            primaryDomain: primary.domainName,
            verificationToken: verificationData.token,
            verificationMethod: "DNS_TXT"
          });
        } catch {
          markIncomplete("Domain not verified", {
            isDomainVerified: false,
            primaryDomain: primary.domainName
          });
        }
      } else {
        markIncomplete("No primary domain found", { isDomainVerified: false });
      }
    } catch (error) {
      log(LogLevel.Error, "Failed to check domains", { error });
      markCheckFailed(
        error instanceof Error ? error.message : "Failed to check domains"
      );
    }
  },

  async execute({
    fetchGoogle,
    checkData,
    markSucceeded,
    markFailed,
    markPending,
    log
  }) {
    try {
      if (!checkData.primaryDomain) {
        markFailed("No primary domain to verify");
        return;
      }

      const VerifySchema = z.object({
        id: z.string(),
        site: z.object({ type: z.string(), identifier: z.string() })
      });

      try {
        const verified = await fetchGoogle(
          `${ApiEndpoint.Google.SiteVerification}/webResource`,
          VerifySchema,
          {
            method: "POST",
            body: JSON.stringify({
              site: {
                type: "INET_DOMAIN",
                identifier: checkData.primaryDomain
              },
              verificationMethod: "DNS_TXT"
            })
          }
        );

        log(LogLevel.Info, "Domain verified successfully", { verified });
        markSucceeded({
          [Var.IsDomainVerified]: true,
          [Var.PrimaryDomain]: checkData.primaryDomain
        });
      } catch {
        if (checkData.verificationToken) {
          markPending(
            `Add TXT record to DNS: ${checkData.verificationToken}\n`
              + `Record name: @ or ${checkData.primaryDomain}\n`
              + `This step will retry automatically once DNS propagates.`
          );
        } else {
          markFailed(
            "Unable to verify domain - no verification token available"
          );
        }
      }
    } catch (error) {
      log(LogLevel.Error, "Execute failed", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  },
  undo: async ({ markReverted }) => {
    markReverted();
  }
});
