import antfu from '@antfu/eslint-config'

const eslintConfig = antfu({
  astro: true,
  typescript: true,
  test: true,
  react: true,
  ignores: ['**/.wrangler/**', '**/.claude/**', 'docs/**', '.superpowers/**'],
  formatters: {
    css: true,
    html: true,
    markdown: 'prettier',
  },
})

export default eslintConfig
