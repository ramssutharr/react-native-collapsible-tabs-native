import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['node_modules/**', 'lib/**', 'android/build/**'] },
  ...tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // The public surface wraps arbitrary list components and codegen hosts;
      // `any` at those boundaries is deliberate and commented at each site.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
