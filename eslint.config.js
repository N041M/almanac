// Flat ESLint config. The boundaries rule is the mechanical enforcement of
// L1 (star modularity) and the §4 dependency matrix: a sibling-module import
// is a failed build, not a code-review note.
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.config.*',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['packages/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['packages/**/*'],
      'boundaries/elements': [
        { type: 'core', pattern: 'packages/core/**' },
        { type: 'kernel', pattern: 'packages/kernels/*/**' },
        { type: 'module', pattern: 'packages/modules/*/**' },
        { type: 'app', pattern: 'packages/apps/*/**' },
      ],
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    rules: {
      // The §4 boundary matrix:
      //   core   -> (nothing but itself)
      //   kernel -> core
      //   module -> core, kernel        (NEVER another module)
      //   app    -> core, kernel, module
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'core', allow: ['core'] },
            { from: 'kernel', allow: ['core', 'kernel'] },
            { from: 'module', allow: ['core', 'kernel'] },
            { from: 'app', allow: ['core', 'kernel', 'module', 'app'] },
          ],
        },
      ],
      // L8: no `any`, no non-null assertions used to dodge types.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
