import { configuredClient } from '@paradigma/core';
// The store never reuses an administrative session, even on the same origin.
export const { client: supabase, configurationError } = configuredClient(false);

// Customer identity is isolated from both catalog requests and the admin app.
export const { client: customerAuth } = configuredClient('customer');
