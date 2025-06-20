"use client";

import { InfoButton } from "@/components/info-button";
import { env } from "@/env";
import { listSamlProfiles } from "@/lib/info";
import { deleteSamlProfiles } from "@/lib/workflow/info-actions";

export function SamlInfoButton() {
  return (
    <InfoButton
      title="Existing SAML Profiles"
      fetchItems={listSamlProfiles}
      deleteItems={env.ALLOW_INFO_PURGE ? deleteSamlProfiles : undefined}
    />
  );
}
