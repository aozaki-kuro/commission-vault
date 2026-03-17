import { expect, test } from '@playwright/test'
import {
  ADMIN_PROJECT_NAME,
  expectUnionToMatchSnapshot,
  getAdminPageContainer,
  prepareStablePage,
  skipUnlessProject,
} from './helpers'

test('edit page stays visually stable', async ({ page }, testInfo) => {
  skipUnlessProject(testInfo, ADMIN_PROJECT_NAME)
  await page.goto('/edit')
  await page.getByRole('heading', { level: 1, name: 'Edit' }).waitFor()
  await prepareStablePage(page)

  await expect(getAdminPageContainer(page)).toHaveScreenshot('admin-edit-page.png', {
    animations: 'disabled',
    caret: 'hide',
  })
})

test('edit manager stays visually stable', async ({ page }, testInfo) => {
  skipUnlessProject(testInfo, ADMIN_PROJECT_NAME)
  await page.goto('/edit')
  await page.getByRole('heading', { name: 'Existing commissions' }).waitFor()
  await prepareStablePage(page)

  await expectUnionToMatchSnapshot(page, 'admin-edit-manager.png', [
    page.getByRole('heading', { name: 'Existing commissions' }),
    page.getByRole('combobox', { name: 'Search commissions' }),
    page.getByRole('button', { name: 'Refresh Assets Cache' }),
  ])
})
