import { configuredClient } from '@paradigma/core';
// The store never reuses an administrative session, even on the same origin.
export const { client: supabase, configurationError } = configuredClient(false);
