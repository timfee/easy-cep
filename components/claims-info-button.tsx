"use client";

import { InfoButton } from "@/components/info-button";
import { listClaimsPolicies } from "@/lib/info";

export function ClaimsInfoButton() {
  return (
    <InfoButton
      title="Existing Claims Policies"
      fetchItems={listClaimsPolicies}
    />
  );
}
