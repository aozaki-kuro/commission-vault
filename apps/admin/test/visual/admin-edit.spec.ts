import { expect, test } from '@playwright/test'
import {
  ADMIN_PROJECT_NAME,
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
  const managerSection = page.locator('section.space-y-5').filter({
    has: page.getByRole('heading', { name: 'Existing commissions' }),
  })

  await page.getByRole('heading', { name: 'Existing commissions' }).waitFor()
  await prepareStablePage(page)

  await expect(managerSection).toHaveScreenshot('admin-edit-manager.png', {
    animations: 'disabled',
    caret: 'hide',
  })
})
