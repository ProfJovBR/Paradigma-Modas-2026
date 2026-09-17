import { defineConfig, loadEnv } from 'vite';
import { validatePagesEnvironment } from '../../build/pages';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => {
  validatePagesEnvironment(loadEnv(mode, '.', ''));
  return { plugins: [react(), tailwindcss()] };
});
