import { expect, test } from '@playwright/test'
import {
  ADMIN_PROJECT_NAME,
  expectUnionToMatchSnapshot,
  getAdminPageContainer,
  prepareStablePage,
  skipUnlessProject,
} from './helpers'

test('create page stays visually stable', async ({ page }, testInfo) => {
  skipUnlessProject(testInfo, ADMIN_PROJECT_NAME)
  await page.goto('/create')
  await page.getByRole('heading', { level: 1, name: 'Create' }).waitFor()
  await page.getByRole('heading', { name: 'Add Character' }).waitFor()
  await prepareStablePage(page)

  await expect(getAdminPageContainer(page)).toHaveScreenshot('admin-create-page.png', {
    animations: 'disabled',
    caret: 'hide',
  })
})

test('create forms stay visually stable', async ({ page }, testInfo) => {
  skipUnlessProject(testInfo, ADMIN_PROJECT_NAME)
  await page.goto('/create')
  await page.getByRole('heading', { name: 'Add Character' }).waitFor()
  await prepareStablePage(page)

  await expectUnionToMatchSnapshot(page, 'admin-create-forms.png', [
    page.getByRole('heading', { name: 'Add Character' }),
    page.getByLabel('Name', { exact: true }),
    page.getByRole('heading', { name: 'Add Commission Entry' }),
    page.getByRole('button', { name: 'Save commission' }),
  ])
})
