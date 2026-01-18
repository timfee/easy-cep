import { StepId } from "@/lib/workflow/step-ids";
import { Var } from "@/lib/workflow/variables";
import { LogLevel } from "@/types";
import { defineStep } from "../step-builder";

export default defineStep(StepId.VerifyPrimaryDomain)
  .requires(Var.GoogleAccessToken)
  .provides(Var.IsDomainVerified, Var.PrimaryDomain)

  .check(
    async ({ google, markComplete, markIncomplete, markCheckFailed, log }) => {
      try {
        const { domains } = (await google.domains.get()) as {
          domains: Array<{
            domainName: string;
            isPrimary: boolean;
            verified: boolean;
          }>;
        };

        const primary = domains.find((domain) => domain.isPrimary);

        if (primary?.verified) {
          log(LogLevel.Info, "Primary domain already verified");
          markComplete({
            isDomainVerified: "true",
            primaryDomain: primary.domainName,
          });
          return;
        }

        if (primary) {
          try {
            const verificationData = (await google.siteVerification
              .getToken()
              .post({
                site: { type: "INET_DOMAIN", identifier: primary.domainName },
                verificationMethod: "DNS_TXT",
              })) as { token: string };

            log(LogLevel.Info, "Domain verification pending");

            markIncomplete("Domain verification pending", {
              isDomainVerified: "false",
              primaryDomain: primary.domainName,
              verificationToken: verificationData.token,
            });
          } catch {
            log(LogLevel.Info, "Domain not verified");
            markIncomplete("Domain not verified", {
              isDomainVerified: "false",
              primaryDomain: primary.domainName,
            });
          }
        } else {
          log(LogLevel.Info, "No primary domain found");
          markIncomplete("No primary domain found", {
            isDomainVerified: "false",
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

        try {
          const verified = await google.siteVerification.verify().post({
            site: {
              type: "INET_DOMAIN",
              identifier: checkData.primaryDomain,
            },
            verificationMethod: "DNS_TXT",
          });

          log(LogLevel.Info, "Domain verified successfully", { verified });
          output({
            isDomainVerified: "true",
            primaryDomain: checkData.primaryDomain,
          });
        } catch {
          if (checkData.verificationToken) {
            markPending(
              `Add TXT record to DNS: ${checkData.verificationToken}\n` +
                `Record name: @ or ${checkData.primaryDomain}\n` +
                "This step will retry automatically once DNS propagates."
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
  .undo(({ markReverted }) => Promise.resolve(markReverted()))
  .build();
