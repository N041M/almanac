import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Two projects so one `pnpm test` covers both worlds:
//  - node: the pure core/kernels/modules (framework-agnostic logic).
//  - web:  the React renderer (jsdom + the plugin set), configured in its own
//          package so its deps resolve locally.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'node',
          environment: 'node',
          include: ['packages/**/*.{test,spec}.ts'],
          exclude: ['**/node_modules/**', 'packages/apps/web/**'],
        },
      },
      './packages/apps/web/vitest.config.ts',
    ],
  },
});
