import { test } from '@playwright/test'
import {
  ADMIN_PROJECT_NAME,
  expectUnionToMatchSnapshot,
  prepareStablePage,
  skipUnlessProject,
} from './helpers'

test('aliases dashboard stays visually stable', async ({ page }, testInfo) => {
  skipUnlessProject(testInfo, ADMIN_PROJECT_NAME)
  await page.goto('/aliases')
  await page.getByRole('heading', { name: 'Alias mapping' }).waitFor()
  await prepareStablePage(page)

  await expectUnionToMatchSnapshot(page, 'admin-aliases-dashboard.png', [
    page.getByRole('heading', { name: 'Alias mapping' }),
    page.getByRole('tablist'),
    page.getByRole('button', { name: 'Save character aliases' }),
    page.getByRole('textbox').nth(4),
  ])
})
