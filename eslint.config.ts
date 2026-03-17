import antfu from '@antfu/eslint-config'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'

const adminTailwindEntryPoint = 'apps/admin/src/styles/globals.css'
const adminTailwindRules = Object.fromEntries(
  Object.entries(betterTailwindcss.configs.recommended.rules).map(([ruleName, ruleConfig]) => {
    const severity = Array.isArray(ruleConfig) ? ruleConfig[0] : ruleConfig
    return [ruleName, [severity, { entryPoint: adminTailwindEntryPoint }]]
  }),
)

const eslintConfig = antfu({
  astro: true,
  typescript: true,
  test: true,
  react: true,
  ignores: ['**/.wrangler/**'],
  formatters: {
    /**
     * Format CSS, LESS, SCSS files, also the `<style>` blocks in Vue
     * By default uses Prettier
     */
    css: true,
    /**
     * Format HTML files
     * By default uses Prettier
     */
    html: true,
    /**
     * Format Markdown files
     * Supports Prettier and dprint
     * By default uses Prettier
     */
    // markdown: 'prettier',
  },
})

eslintConfig.append({
  plugins: {
    'better-tailwindcss': betterTailwindcss,
  },
  rules: {
    ...betterTailwindcss.configs.recommended.rules,
  },
})

eslintConfig.append({
  files: ['apps/admin/src/**/*.{ts,tsx}'],
  rules: adminTailwindRules,
})

export default eslintConfig
