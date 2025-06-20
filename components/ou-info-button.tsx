"use client";

import { InfoButton } from "@/components/info-button";
import { env } from "@/env";
import { listOrgUnits } from "@/lib/info";
import { deleteOrgUnits } from "@/lib/workflow/info-actions";

export function OuInfoButton() {
  return (
    <InfoButton
      title="Existing Organizational Units"
      fetchItems={listOrgUnits}
      deleteItems={env.ALLOW_INFO_PURGE ? deleteOrgUnits : undefined}
    />
  );
}
