import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['packages/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/**/src/**'],
    },
  },
});
