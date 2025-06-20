"use client";

import { InfoButton } from "@/components/info-button";
import { listProvisioningJobs } from "@/lib/info";

export function ProvisioningInfoButton() {
  return (
    <InfoButton
      title="Existing Provisioning Jobs"
      fetchItems={listProvisioningJobs}
    />
  );
}
