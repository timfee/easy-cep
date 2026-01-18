/**
 * Google admin privilege shape from the directory API.
 */
export interface AdminPrivilege {
  serviceId: string;
  privilegeName: string;
  childPrivileges?: AdminPrivilege[];
}

/**
 * Required admin privileges for provisioning roles.
 */
export const GOOGLE_ADMIN_PRIVILEGES: { REQUIRED: string[] } = {
  REQUIRED: [
    "ORGANIZATION_UNITS_RETRIEVE",
    "USERS_RETRIEVE",
    "USERS_CREATE",
    "USERS_UPDATE",
    "GROUPS_ALL",
  ],
};
