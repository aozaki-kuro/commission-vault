import prettierConfigRecommended from 'eslint-plugin-prettier/recommended'

import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  prettierConfigRecommended,
  {
    ignores: ['**/node_modules/**', '.next/**', 'dist/**', 'build/**', 'coverage/**', 'out/**'],
  },
]

export default eslintConfig
