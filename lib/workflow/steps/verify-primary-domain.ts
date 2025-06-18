import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep } from "../create-step";

interface CheckData {
  isDomainVerified: boolean;
  primaryDomain?: string;
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
      } else {
        markIncomplete(
          primary ? "Primary domain not verified" : "No primary domain found",
          { isDomainVerified: false, primaryDomain: primary?.domainName }
        );
      }
    } catch (error) {
      log(LogLevel.Error, "Failed to check domains", { error });
      markCheckFailed(
        error instanceof Error ? error.message : "Failed to check domains"
      );
    }
  },

  async execute({ checkData, markSucceeded, markFailed, log }) {
    /**
     * Manual step – no API call. DNS TXT records must be configured
     * to verify the primary domain.
     */
    try {
      // This is a manual step - can't verify domain via API
      log(
        LogLevel.Info,
        "Domain verification requires manual DNS configuration"
      );

      markSucceeded({
        [Var.IsDomainVerified]: checkData.isDomainVerified,
        [Var.PrimaryDomain]: checkData.primaryDomain || ""
      });
    } catch (error) {
      log(LogLevel.Error, "Execute failed", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  },
  undo: async ({ markFailed }) => {
    markFailed("Cannot automatically unverify domain");
  }
});
