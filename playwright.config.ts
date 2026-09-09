import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  use: { channel: 'chrome', headless: true },
  webServer: [
    { command: 'npm run dev -w @paradigma/loja -- --port 5183 --strictPort', url: 'http://127.0.0.1:5183', reuseExistingServer: false, env: { VITE_SUPABASE_URL: 'https://supabase.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only' } },
    { command: 'npm run dev -w @paradigma/admin -- --port 5184 --strictPort', url: 'http://127.0.0.1:5184', reuseExistingServer: false, env: { VITE_SUPABASE_URL: 'https://supabase.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only' } },
    { command: 'npm run dev -w @paradigma/loja -- --port 5185 --strictPort', url: 'http://127.0.0.1:5185', reuseExistingServer: false, env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' } },
    { command: 'npm run dev -w @paradigma/admin -- --port 5186 --strictPort', url: 'http://127.0.0.1:5186', reuseExistingServer: false, env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' } },
  ],
});
