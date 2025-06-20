"use client";

import { InfoButton } from "@/components/info-button";
import { env } from "@/env";
import { listProvisioningJobs } from "@/lib/info";
import { deleteProvisioningJobs } from "@/lib/workflow/info-actions";

export function ProvisioningInfoButton() {
  return (
    <InfoButton
      title="Existing Provisioning Jobs"
      fetchItems={listProvisioningJobs}
      deleteItems={env.ALLOW_INFO_PURGE ? deleteProvisioningJobs : undefined}
    />
  );
}
