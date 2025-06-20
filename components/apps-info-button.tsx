"use client";

import { InfoButton } from "@/components/info-button";
import { PROTECTED_RESOURCES } from "@/constants";
import { listEnterpriseApps } from "@/lib/info";
import { deleteEnterpriseApps } from "@/lib/workflow/info-actions";

export function AppsInfoButton() {
  return (
    <InfoButton
      title="Existing Enterprise Apps"
      fetchItems={async () => {
        const items = await listEnterpriseApps();
        return items.map((item) => ({
          ...item,
          deletable: !PROTECTED_RESOURCES.microsoftAppIds.has(item.id)
        }));
      }}
      deleteItems={deleteEnterpriseApps}
    />
  );
}
