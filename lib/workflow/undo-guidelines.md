# Undo Implementation Guidelines

## Required Undo Implementation

Steps that CREATE resources MUST implement undo:

- create-automation-ou
- create-service-user
- create-admin-role-and-assign-user
- configure-google-saml-profile
- create-microsoft-apps
- setup-microsoft-provisioning
- setup-microsoft-claims-policy
- complete-google-sso-setup (for certificates)

## Optional Undo Implementation

Steps that only READ or VERIFY can have empty undo:

- verify-primary-domain
- Any future read-only steps

## Undo Best Practices

1. Always wrap in try-catch
2. Handle 404 errors gracefully (resource already deleted)
3. Log warnings for partial cleanup failures
4. Call markReverted() even if nothing to clean up
5. Clean up in reverse order of creation
