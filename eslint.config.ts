import prettierConfigRecommended from 'eslint-plugin-prettier/recommended'

import nextVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = [
  ...nextVitals,
  prettierConfigRecommended,
  {
    ignores: ['**/node_modules/**', '.next/**', 'dist/**', 'build/**', 'coverage/**', 'out/**'],
  },
]

export default eslintConfig
