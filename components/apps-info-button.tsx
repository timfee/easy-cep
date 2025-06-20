"use client";

import { InfoButton } from "@/components/info-button";
import { listEnterpriseApps } from "@/lib/info";
import { deleteEnterpriseApps } from "@/lib/workflow/info-actions";

export function AppsInfoButton() {
  return (
    <InfoButton
      title="Existing Enterprise Apps"
      fetchItems={listEnterpriseApps}
      deleteItems={deleteEnterpriseApps}
    />
  );
}
