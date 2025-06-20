"use client";

import { InfoButton } from "@/components/info-button";
import { listSamlProfiles } from "@/lib/info";
import { deleteSamlProfiles } from "@/lib/workflow/info-actions";

export function SamlInfoButton() {
  return (
    <InfoButton
      title="Existing SAML Profiles"
      fetchItems={listSamlProfiles}
      deleteItems={deleteSamlProfiles}
    />
  );
}
