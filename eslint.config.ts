import antfu from '@antfu/eslint-config'

const eslintConfig = antfu({
  astro: true,
  typescript: true,
  test: true,
  react: true,
  ignores: ['**/.wrangler/**', '**/.claude/**'],
  formatters: {
    css: true,
    html: true,
  },
})

export default eslintConfig
