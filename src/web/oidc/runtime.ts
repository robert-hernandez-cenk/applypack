import type { OidcClient } from './client';
import type { OidcSettings } from './settings';

/**
 * What the gate and the sign-in routes run on. The client is a function
 * because the provider is asked about itself once, as the server starts
 * (ADR 0064), after this module has been read.
 */
export interface SignInRuntime {
  settings: OidcSettings;
  client(): OidcClient;
}
