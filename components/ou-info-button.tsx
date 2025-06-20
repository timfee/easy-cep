"use client";

import { InfoButton } from "@/components/info-button";
import { listOrgUnits } from "@/lib/info";

export function OuInfoButton() {
  return (
    <InfoButton
      title="Existing Organizational Units"
      fetchItems={listOrgUnits}
    />
  );
}
