import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // react-hooks v7's set-state-in-effect flags the fetch-on-mount /
      // sync-from-external pattern used deliberately across the data hooks
      // and admin pages (~20 sites). Restructuring data loading is planned
      // alongside the BookingPage decomposition; until then the rule is off
      // rather than scattering inline disables.
      'react-hooks/set-state-in-effect': 'off',
      // Allow the `const { id: _id, ...rest } = row` destructure-to-omit idiom.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
])
