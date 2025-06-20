"use client";

import { InfoButton } from "@/components/info-button";
import { listSsoAssignments } from "@/lib/info";

export function SsoInfoButton() {
  return (
    <InfoButton
      title="Existing SSO Assignments"
      fetchItems={listSsoAssignments}
    />
  );
}
