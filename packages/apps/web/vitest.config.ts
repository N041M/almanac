import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// Referenced as a project from the root vitest config. Deps (react, jsdom,
// testing-library) resolve from this package's own node_modules.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
