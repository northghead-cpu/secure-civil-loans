/**
 * Feature Flags Configuration
 * 
 * Controls the availability of optional features in the application.
 * Set individual features to true/false to enable/disable them.
 * Disabling features will not affect existing functionality.
 */

export const features = {
  /**
   * Enable OCR Document Processing
   * When enabled, documents uploaded during KYC will be processed
   * to extract structured data (names, IDs, dates).
   * 
   * @default true
   */
  enableOCR: true,

  /**
   * Enable Fraud Detection Engine
   * When enabled, OCR data will be compared against user-submitted
   * form data to detect inconsistencies and potential fraud.
   * 
   * @default true
   */
  enableFraudDetection: true,

  /**
   * Enable OCR Processing Logging
   * When enabled, OCR processing results and errors will be logged
   * to the console for debugging purposes.
   * 
   * @default false (set to true in development)
   */
  enableOCROLogging: false,
} as const;

/**
 * Type-safe feature flag access
 */
export type FeatureKey = keyof typeof features;

/**
 * Check if a specific feature is enabled
 */
export const isFeatureEnabled = (feature: FeatureKey): boolean => {
  return features[feature] ?? false;
};

export default features;
