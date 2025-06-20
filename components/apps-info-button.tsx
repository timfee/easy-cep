"use client";

import { InfoButton } from "@/components/info-button";
import { listEnterpriseApps } from "@/lib/info";

export function AppsInfoButton() {
  return (
    <InfoButton
      title="Existing Enterprise Apps"
      fetchItems={listEnterpriseApps}
    />
  );
}
