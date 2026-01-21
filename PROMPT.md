  You are a Principal Software Engineer acting as the lead architect for the easy-cep project. Your task is to implement a complex
  new feature: Username Mapping Strategy Configuration.

  This feature is critical because it allows users to define how usernames are transformed between Google Workspace and Microsoft
  Entra ID. You must implement the frontend collection, backend storage, API enforcement, and—most importantly—the reconstitution
  of state from the API for existing setups.

  1. Data Model & Variable Registry

  Action: Update lib/workflow/variables.ts.

  Add the following two variables to WORKFLOW_VARIABLES. You must ensure they are exported and available via Var.*.

   1. `usernameMappingStrategy`
       * Type: string (enum: 'upn', 'upn_substitution', 'email')
       * Category: config
       * Configurable: true
       * Description: "The strategy used to map Google usernames to Microsoft Entra ID."
   2. `substituteDomain`
       * Type: string
       * Category: config
       * Configurable: true
       * Description: "The replacement domain used in the 'UPN Substitution' strategy (e.g., 'user@old.com' becomes
         'user@new.com')."
       * Validation: This variable is REQUIRED if usernameMappingStrategy is set to 'upn_substitution'.

  ---

  2. Microsoft Graph Client Extension

  Action: Update lib/workflow/http/microsoft-client.ts.

  You must add support for reading and writing Synchronization Schemas. The API endpoint is:
  GET /servicePrincipals/{id}/synchronization/jobs/{jobId}/schema
  PUT /servicePrincipals/{id}/synchronization/jobs/{jobId}/schema

  Requirements:
   1. Define a Zod Schema (syncSchemaSchema) that models the deeply nested structure of the synchronization schema. It must cover:
       * synchronizationRules (Array)
       * objectMappings (Array) -> Filter for targetObjectName === "User"
       * attributeMappings (Array) -> This is what we will modify.
       * Each mapping has: sourceObjectName, targetAttributeName, expression (string), defaultValue (string), flowType (string).
   2. Add a schema() method to the existing synchronization.jobs(jobId) builder.

  ---

  3. New Step: Configure Username Strategy

  Action: Create lib/workflow/steps/configure-username-strategy.ts.
  Registry: Register this step after CreateMicrosoftApps and before SetupMicrosoftProvisioning.

  A. The `check()` Function (Reconstitution Logic)
  This is the most critical part. When the workflow loads, you must inspect the existing Microsoft Graph configuration to
  determine if a strategy was previously applied.

   1. Fetch: Get the Synchronization Job for the current provisioningServicePrincipalId.
   2. Fetch Schema: If a job exists, GET its schema.
   3. Analyze `attributeMappings` for the "User" object:
       * Find the mapping where targetAttributeName === "userPrincipalName".
       * Detection Logic:
           * IF sourceAttributeName === "mail" THEN set Var.UsernameMappingStrategy = 'email'.
           * IF sourceAttributeName === "userPrincipalName" (and flowType !== 'Expression') THEN set Var.UsernameMappingStrategy =
             'upn'.
           * IF flowType === "Expression":
               * Inspect the expression string. It will look like:
                  Replace([userPrincipalName], " @OLD_DOMAIN", , , " @NEW_DOMAIN", , )
               * Extract: Use a Regex to capture the NEW_DOMAIN value from the expression string.
               * Set: Var.UsernameMappingStrategy = 'upn_substitution'.
               * Set: Var.SubstituteDomain = [The Extracted Domain].
   4. Output: Call markComplete() with the detected variables so the UI reflects the existing state.

  B. The `execute()` Function (UI & Persistence)
   1. UI Component:
       * Render a RadioGroup with 3 options:
           1. (1A) UPN (Standard)
           2. (1B) UPN with Domain Substitution
           3. (1C) Email Address
       * Interactive Element: IF option (1B) is selected, you MUST render a text input field for the Substitute Domain.
       * Validation: You cannot proceed with (1B) if the domain input is empty.
   2. Persistence: Save the selected values to the step output.

  ---

  4. Step Update: Provisioning Configuration

  Action: Update lib/workflow/steps/setup-microsoft-provisioning.ts.

  Logic:
   1. Inject: Read Var.UsernameMappingStrategy and Var.SubstituteDomain.
   2. Modify Schema: IMMEDIATELY after creating the Synchronization Job (and before starting it), fetch the default schema.
   3. Apply Transformation:
       * Target: userPrincipalName mapping.
       * If Strategy = 'upn': Ensure source is userPrincipalName.
       * If Strategy = 'email': Set source to mail.
       * If Strategy = 'upn_substitution':
           * Construct the expression string:
              Replace([userPrincipalName], " @[PrimaryDomain]", , , " @[SubstituteDomain]", , )
           * Set flowType to "Expression".
           * Set expression to your constructed string.
       * Global Change: For all strategies, set givenName and surname default values to _ (underscore).
   4. Save: PUT the modified schema back to the API.

  ---

  5. Step Update: SSO Claims Policy

  Action: Update lib/workflow/steps/setup-microsoft-claims-policy.ts.

  Logic:
   1. Inject: Read Var.UsernameMappingStrategy and Var.SubstituteDomain.
   2. Construct JSON Definition:
      You need to generate the definition string for the ClaimsMappingPolicy.

       * Case 1A (UPN): Use the standard definition (source = userPrincipalName).
       * Case 1C (Email): Change the nameid source to user.mail.
       * Case 1B (Substitution):
           * This requires a complex policy definition.
           * You must define a ClaimsSchema with a Transformation.
           * Transformation Logic:

    1             {
    2               "ID": "ExtractAndJoin",
    3               "TransformationId": "Join",
    4               "InputClaims": [
    5                 {
    6                   "ClaimTypeReferenceId": "extractedPrefix",
    7                   "TransformationClaimType": "string1"
    8                 },
    9                 {
   10                   "ClaimTypeReferenceId": "separator", // hardcoded "@"
   11                   "TransformationClaimType": "separator"
   12                 },
   13                  {
   14                   "ClaimTypeReferenceId": "suffix", // the Var.SubstituteDomain
   15                   "TransformationClaimType": "string2"
   16                 }
   17               ],
   18               "OutputClaims": [
   19                 {
   20                   "ClaimTypeReferenceId": "nameid",
   21                   "TransformationClaimType": "outputClaim"
   22                 }
   23               ]
   24             }
           * Note: You likely need to chain ExtractMailPrefix first. If the specific JSON structure for chained transformations in
             MS Graph is ambiguous, prioritize a standard ExtensionAttribute workaround or ensuring the JSON is syntactically
             perfect for the Join method.

  Deliverables:
   1. Updated variables.ts
   2. Updated microsoft-client.ts
   3. New file steps/configure-username-strategy.ts
   4. Updated steps/setup-microsoft-provisioning.ts
   5. Updated steps/setup-microsoft-claims-policy.ts

  Start by showing me the Variables and Microsoft Client changes to confirm you have the foundation correct.



  



********************* ORIGINAL PROMPT (FOR DETAILS IF NEEDED)******************
However I think we have a problen


Can we create a new step (you should determine where it should go logically). Use v0 to create the UI --- It should collect the **Username mapping strategy**

The options are (1A) (1B) or (1C). We should be able to re-constitute the step in future runs based on the API value as we do everything else.



(1A) UPN
The end user instructions we give are below - please research and dedtermine the right API call:
-Under Mappings, click Provision Entra ID Users.
-For the attributes surname and givenName, do the following:
-Click Edit.
-Set Default value if null to _.
-Click OK.
-Click Save.


(1B) UPN with Domain Substitituion
Under Mappings, click Provision Entra ID Users.
For the attribute userPrincipalName, do the following:

Click Edit.
Configure the following mapping:

Mapping type: Expression
Expression:



Replace([userPrincipalName], "@DOMAIN", , , "@SUBSTITUTE_DOMAIN", , )
Replace the following:

DOMAIN: domain name you want to replace
SUBSTITUTE_DOMAIN domain name to use instead
Click OK.

For the attributes surname and givenName, do the following:

Click Edit.
Set Default value if null to _.
Click OK.
Click Save.

Confirm that saving changes will result in users and groups being resynchronized by clicking Yes.

Click X to close the Attribute Mapping dialog.


(1C) Email address
Under Mappings, click Provision Entra ID Users.
For the attribute userPrincipalName, do the following:
Click Edit.
Set Source attribute to mail.
Click OK.
For the attributes surname and givenName, do the following:
Click Edit.
Set Default value if null to _.
Click OK.
Click Save.
Confirm that saving changes will result in users and groups being resynchronized by clicking Yes.
Click X to close the Attribute Mapping dialog.






2) this value will adjust the claim behavior:

-- if UPN w/ Domain Substituion, the end user instructions are as folllows; please find an API method:
Click Unique User Identifier (Name ID) to change the claims mapping.

Set Source to Transformation and configure the following transformation:

Transformation: ExtractMailPrefix()
Parameter 1: user.userPrincipalName
Select Add transformation and configure the following transformation:

Transformation: Join()
Separator: @
Parameter 2: Enter the substitute domain name.
You must use the same substitute domain name for user provisioning and single sign-on. If the domain name isn't listed, you might need to verify it first .

Click Add.

Click Save.

--- if email address
On the User Attributes & Claims card, click edit Edit.
Select the row labeled Unique User Identifier (Name ID).
Change Source attribute to user.mail.
Click Save.
Delete all claims listed under Additional claims. To delete all records, click more_horiz, and then click Delete.

User Attributes & Claims dialog.

Dismiss the dialog by clicking close.






This step will likely involve a LOT of research first. Some docs: https://docs.cloud.google.com/architecture/identity/federating-gcp-with-azure-ad-configuring-provisioning-and-single-sign-on#email-address_2 and https://learn.microsoft.com/en-us/graph/api/resources/synchronization-overview?view=graph-rest-1.0