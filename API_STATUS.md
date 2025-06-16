# API Status

## Completely verified successfully

- verifyPrimaryDomain: domains endpoint returned primary domain data
- createAutomationOU: GET orgunits returned empty; POST works
- createServiceUser: service user exists; creation endpoint ready
- createCustomAdminRole: roles list shows absence; ready to create
- assignRoleToUser: roleAssignments returns assignments
- configureGoogleSamlProfile: listing profiles returned existing profile
- createMicrosoftApps: query applications returned template instances
- configureMicrosoftSyncAndSso: sync jobs empty (not started)
- setupMicrosoftClaimsPolicy: claimsMappingPolicies empty
- assignUsersToSso: inbound assignments list retrieved

## Remaining work

- completeGoogleSsoSetup: manual configuration
- testSsoConfiguration: manual verification
