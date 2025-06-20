import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { defineStep } from "../step-builder";

export default defineStep(StepId.VerifyPrimaryDomain)
  .requires(Var.GoogleAccessToken)
  .provides(Var.IsDomainVerified, Var.PrimaryDomain)

  /**
   * GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains
   * Headers: { Authorization: Bearer {googleAccessToken} }
   *
   * Success response (200)
   * {
   *   "domains": [
   *     { "domainName": "example.com", "isPrimary": true, "verified": true }
   *   ]
   * }
   *
   * Success response (200) – unverified
   * {
   *   "domains": [
   *     { "domainName": "example.com", "isPrimary": true, "verified": false }
   *   ]
   * }
   *
   * Success response (200) – empty list
   * { "domains": [] }
   *
   * Error response (401)
   * { "error": { "code": 401, "message": "Invalid Credentials" } }
   */

  .check(
    async ({ google, markComplete, markIncomplete, markCheckFailed, log }) => {
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

        const { domains } = await google.get(
          ApiEndpoint.Google.Domains,
          DomainsResponse,
          { flatten: true }
        );
        // Extract: primaryDomain = domains.find(d => d.isPrimary)?.domainName

        const primary = domains.find((d) => d.isPrimary);

        if (primary?.verified) {
          log(LogLevel.Info, "Primary domain already verified");
          markComplete({
            isDomainVerified: "true",
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
            /**
             * POST https://www.googleapis.com/siteVerification/v1/token
             * Headers: { Authorization: Bearer {googleAccessToken} }
             * Body:
             * {
             *   "site": { "type": "INET_DOMAIN", "identifier": "{domain}" },
             *   "verificationMethod": "DNS_TXT"
             * }
             *
             * Success response (200)
             * { "token": "google-site-verification=abc" }
             *
             * Error response (401)
             * { "error": { "code": 401, "message": "Auth error" } }
             */
            const verificationData = await google.post(
              `${ApiEndpoint.Google.SiteVerification}/token`,
              TokenSchema,
              {
                site: { type: "INET_DOMAIN", identifier: primary.domainName },
                verificationMethod: "DNS_TXT"
              }
            );
            // Extract: verificationToken = verificationData.token

            markIncomplete("Domain verification pending", {
              isDomainVerified: "false",
              primaryDomain: primary.domainName,
              verificationToken: verificationData.token
            });
          } catch {
            markIncomplete("Domain not verified", {
              isDomainVerified: "false",
              primaryDomain: primary.domainName
            });
          }
        } else {
          markIncomplete("No primary domain found", {
            isDomainVerified: "false"
          });
        }
      } catch (error) {
        log(LogLevel.Error, "Failed to check domains", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Failed to check domains"
        );
      }
    }
  )
  .execute(
    async ({ google, checkData, output, markFailed, markPending, log }) => {
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
          /**
           * POST https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS_TXT
           * Headers: { Authorization: Bearer {googleAccessToken} }
           * Body:
           * {
           *   "site": { "type": "INET_DOMAIN", "identifier": "{domain}" },
           *   "verificationMethod": "DNS_TXT"
           * }
           *
           * Success response (200)
           * { "id": "{id}", "site": { "type": "INET_DOMAIN", "identifier": "{domain}" } }
           *
           * Error response (400)
           * { "error": { "code": 400, "message": "DNS record not found" } }
           */
          const verified = await google.post(
            `${ApiEndpoint.Google.SiteVerification}/webResource`,
            VerifySchema,
            {
              site: {
                type: "INET_DOMAIN",
                identifier: checkData.primaryDomain
              },
              verificationMethod: "DNS_TXT"
            }
          );
          // Extract: isDomainVerified = "true"

          log(LogLevel.Info, "Domain verified successfully", { verified });
          output({
            isDomainVerified: "true",
            primaryDomain: checkData.primaryDomain
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
    }
  )
  .undo(async ({ markReverted }) => {
    markReverted();
  })
  .build();
