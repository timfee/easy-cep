# API Status

## Completely verified successfully

### verifyPrimaryDomain

_check_ success:

- complete - verified 200 response with primary domain
- incomplete - verified 200 response with empty domains list
  _execute_ success:
- manual completion recorded when domain verified

### createAutomationOU

_check_ success:

- complete - verified 200 response showing OU
- incomplete - verified 200 response without OU
  _execute_ success:
- 201 created returns OU path
- 409 already exists treated as success

### createServiceUser

_check_ success:

- complete - 200 user details
- incomplete - 404 not found
  _execute_ success:
- 201 returns user info
  _execute_ errors:
- 409 user already exists handled

### createAdminRoleAndAssignUser

_check_ success:

- complete - role and assignment exist (verified 200 roles page and assignment list)
- incomplete - role missing or assignment missing
  _execute_ success:
- 200 privileges fetched, role created (200) or assignment created (200)
  _execute_ errors:
- 409 role or assignment already exists handled

### configureGoogleSamlProfile

_check_ success:

- complete - 200 profile exists
- incomplete - empty list
  _execute_ success:
- 200 operation response with profile info
  _execute_ errors:
- 400 invalid request handled

### createMicrosoftApps

_check_ success:

- complete - 200 existing apps
- incomplete - empty list
  _execute_ success:
- 201 returns provisioning and SSO app info
  _execute_ errors:
- 400 invalid template

### configureMicrosoftSyncAndSso

_check_ success:

- complete - sync job active
- incomplete - no jobs or paused
  _execute_ success:
- 204 on patch secrets
- 204 on start sync

### setupMicrosoftClaimsPolicy

_check_ success:

- complete - 200 with existing policy
- incomplete - empty list
  _execute_ success:
- 201 created policy
- 204 assignment success
  _execute_ errors:
- 409 policy already exists handled

### assignUsersToSso

_check_ success:

- complete - assignment present
- incomplete - none found
  _execute_ success:
- 200 assignment created
  _execute_ errors:
- 409 already assigned handled

## Remaining work

### completeGoogleSsoSetup

- Manual configuration of Google Admin Console

### testSsoConfiguration

- Manual verification of SSO login
