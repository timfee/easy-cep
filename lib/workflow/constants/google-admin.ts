export interface AdminPrivilege {
  serviceId: string;
  privilegeName: string;
  childPrivileges?: AdminPrivilege[];
}

export const GOOGLE_ADMIN_PRIVILEGES: { REQUIRED: string[] } = {
  REQUIRED: [
    "ORGANIZATION_UNITS_RETRIEVE",
    "USERS_RETRIEVE",
    "USERS_CREATE",
    "USERS_UPDATE",
    "GROUPS_ALL",
  ],
};
