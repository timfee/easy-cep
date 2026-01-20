/**
 * Workflow thresholds for API usage.
 */
export const WORKFLOW_LIMITS: { SAML_PROFILES_WARNING_THRESHOLD: number } = {
  SAML_PROFILES_WARNING_THRESHOLD: 90,
};

/**
 * Time constants used by workflow logic.
 */
export const TIME: {
  MS_IN_SECOND: number;
  SECOND: number;
  MINUTE: number;
  HOUR: number;
  DAY: number;
  YEAR: number;
} = {
  DAY: 24 * 60 * 60 * 1000,
  HOUR: 60 * 60 * 1000,
  MINUTE: 60 * 1000,
  MS_IN_SECOND: 1000,
  SECOND: 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000,
};
