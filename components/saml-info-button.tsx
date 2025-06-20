"use client";

import { InfoButton } from "@/components/info-button";
import { listSamlProfiles } from "@/lib/info";

export function SamlInfoButton() {
  return (
    <InfoButton title="Existing SAML Profiles" fetchItems={listSamlProfiles} />
  );
}
