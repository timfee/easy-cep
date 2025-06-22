# Test Status Summary

The initial test run without mocking produced failures in the E2E workflow suite. Attempts to reach
Google and Microsoft APIs were blocked in the execution environment, so every live step returned a
`failed` status. Below is a per‑test summary of the observed behaviour before enabling mock mode.

## Failing Workflow Tests

| Test                                              | Observed Status | Notes                                                |
| ------------------------------------------------- | --------------- | ---------------------------------------------------- |
| verify-primary-domain (run mode)                  | complete        | Succeeded using existing fixture                     |
| create-automation-ou (run mode)                   | failed          | Google OrgUnits API call failed during check/execute |
| create-service-user (run mode)                    | failed          | Failed to create user via Directory API              |
| create-admin-role-and-assign-user (run mode)      | failed          | Role creation or assignment HTTP request failed      |
| configure-google-saml-profile (run mode)          | failed          | Unable to create SAML profile without API access     |
| create-microsoft-apps (run mode)                  | failed          | Microsoft Graph application lookup/creation failed   |
| setup-microsoft-provisioning (run mode)           | failed          | Provisioning setup call returned error               |
| configure-microsoft-sso (run mode)                | failed          | Failed to configure SSO endpoints on Microsoft side  |
| setup-microsoft-claims-policy (run mode)          | failed          | Claims policy POST returned error                    |
| complete-google-sso-setup (run mode)              | failed          | Final Google SSO PATCH request failed                |
| assign-users-to-sso (run mode)                    | failed          | Inbound SSO assignment API call failed               |
| assign-users-to-sso undo (run mode)               | failed          | Unable to remove assignment                          |
| complete-google-sso-setup undo (run mode)         | reverted        | Undo succeeded                                       |
| setup-microsoft-claims-policy undo (run mode)     | failed          | Claims policy deletion request failed                |
| configure-microsoft-sso undo (run mode)           | reverted        | Undo succeeded                                       |
| setup-microsoft-provisioning undo (run mode)      | failed          | Failed to delete provisioning job                    |
| create-microsoft-apps undo (run mode)             | reverted        | Undo succeeded                                       |
| configure-google-saml-profile undo (run mode)     | failed          | Google delete request failed                         |
| create-admin-role-and-assign-user undo (run mode) | failed          | Role unassignment failed                             |
| create-service-user undo (run mode)               | failed          | Service user deletion failed                         |
| create-automation-ou undo (run mode)              | failed          | Org unit deletion failed                             |
| verify-primary-domain undo (run mode)             | reverted        | No action required                                   |

Enabling mock mode causes these steps to short-circuit and return deterministic
`complete`/`reverted` statuses so the E2E suite passes consistently.
