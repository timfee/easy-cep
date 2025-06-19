import { VarName, WorkflowVars } from "@/types";

export interface VariableRelationship {
  dependent: VarName;
  requires: VarName[];
  validate?: (vars: Partial<WorkflowVars>) => string | null;
}

export const VARIABLE_RELATIONSHIPS: VariableRelationship[] = [
  {
    dependent: "provisioningUserEmail" as VarName,
    requires: ["primaryDomain", "provisioningUserPrefix"] as VarName[],
    validate: (vars) => {
      const email = vars.provisioningUserEmail;
      const expectedEmail = `${vars.provisioningUserPrefix}@${vars.primaryDomain}`;
      if (email && email !== expectedEmail) {
        return `Email should be ${expectedEmail}`;
      }
      return null;
    }
  },
  {
    dependent: "adminRoleId" as VarName,
    requires: ["directoryServiceId"] as VarName[],
    validate: (vars) => {
      if (vars.adminRoleId && !vars.directoryServiceId) {
        return "Admin role requires directory service ID";
      }
      return null;
    }
  }
];

export function validateVariableRelationships(
  vars: Partial<WorkflowVars>
): string[] {
  const errors: string[] = [];

  for (const relationship of VARIABLE_RELATIONSHIPS) {
    if (vars[relationship.dependent]) {
      for (const req of relationship.requires) {
        if (!vars[req]) {
          errors.push(`${relationship.dependent} requires ${req} to be set`);
        }
      }
    }

    if (relationship.validate) {
      const error = relationship.validate(vars);
      if (error) errors.push(error);
    }
  }

  return errors;
}
