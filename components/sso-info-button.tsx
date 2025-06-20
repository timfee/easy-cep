"use client";

import { InfoButton } from "@/components/info-button";
import { env } from "@/env";
import { listSsoAssignments } from "@/lib/info";
import { deleteSsoAssignments } from "@/lib/workflow/info-actions";

export function SsoInfoButton() {
  return (
    <InfoButton
      title="Existing SSO Assignments"
      fetchItems={listSsoAssignments}
      deleteItems={env.ALLOW_INFO_PURGE ? deleteSsoAssignments : undefined}
    />
  );
}
