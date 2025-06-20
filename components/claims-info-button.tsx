"use client";

import { InfoButton } from "@/components/info-button";
import { listClaimsPolicies } from "@/lib/info";
import { deleteClaimsPolicies } from "@/lib/workflow/info-actions";

export function ClaimsInfoButton() {
  return (
    <InfoButton
      title="Existing Claims Policies"
      fetchItems={listClaimsPolicies}
      deleteItems={deleteClaimsPolicies}
    />
  );
}
