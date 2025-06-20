"use client";

import { InfoButton } from "@/components/info-button";
import { listProvisioningJobs } from "@/lib/info";
import { deleteProvisioningJobs } from "@/lib/workflow/info-actions";

export function ProvisioningInfoButton() {
  return (
    <InfoButton
      title="Existing Provisioning Jobs"
      fetchItems={listProvisioningJobs}
      deleteItems={deleteProvisioningJobs}
    />
  );
}
