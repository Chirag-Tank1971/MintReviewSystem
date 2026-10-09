// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Only the classic, low-noise hook rules. eslint-plugin-react-hooks v7's full
      // "recommended" set targets React Compiler readiness and flags many idiomatic,
      // correct patterns (e.g. setState in an effect) as errors — too strict for this
      // pass on existing code; revisit if/when adopting the React Compiler.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // This codebase has a lot of loosely-typed API response handling;
      // tightening this repo-wide is a larger follow-up, not part of this pass.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  }
);
