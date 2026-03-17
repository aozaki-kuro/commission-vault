import { expect, test } from '@playwright/test'
import {
  ADMIN_LEGACY_PROJECT_NAME,
  expectUnionToMatchSnapshot,
  getAdminPageContainer,
  prepareStablePage,
  skipUnlessProject,
} from './helpers'

test.describe('legacy admin reference baselines', () => {
  test('overview page stays visually stable', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, ADMIN_LEGACY_PROJECT_NAME)
    await page.goto('/admin')
    await page.getByRole('heading', { level: 1, name: 'Admin Overview' }).waitFor()
    await prepareStablePage(page)

    await expect(getAdminPageContainer(page)).toHaveScreenshot('legacy-admin-overview-page.png', {
      animations: 'disabled',
      caret: 'hide',
    })
  })

  test('legacy nav shell stays visually stable', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, ADMIN_LEGACY_PROJECT_NAME)
    await page.goto('/admin')
    await page.getByRole('navigation', { name: 'Admin sections' }).waitFor()
    await prepareStablePage(page)

    await expectUnionToMatchSnapshot(page, 'legacy-admin-nav-shell.png', [
      page.getByRole('banner'),
      page.getByRole('navigation', { name: 'Admin sections' }),
    ])
  })

  test('create page stays visually stable', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, ADMIN_LEGACY_PROJECT_NAME)
    await page.goto('/admin/create')
    await page.getByRole('heading', { level: 1, name: 'Create' }).waitFor()
    await prepareStablePage(page)

    await expect(getAdminPageContainer(page)).toHaveScreenshot('legacy-admin-create-page.png', {
      animations: 'disabled',
      caret: 'hide',
    })
  })

  test('create forms stay visually stable', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, ADMIN_LEGACY_PROJECT_NAME)
    await page.goto('/admin/create')
    await page.getByRole('heading', { name: 'Add Character' }).waitFor()
    await prepareStablePage(page)

    await expectUnionToMatchSnapshot(page, 'legacy-admin-create-forms.png', [
      page.getByRole('heading', { name: 'Add Character' }),
      page.getByRole('textbox', { name: 'Name' }),
      page.getByRole('heading', { name: 'Add Commission Entry' }),
      page.getByRole('button', { name: 'Save commission' }),
    ])
  })

  test('edit page stays visually stable', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, ADMIN_LEGACY_PROJECT_NAME)
    await page.goto('/admin/edit')
    await page.getByRole('heading', { level: 1, name: 'Edit' }).waitFor()
    await prepareStablePage(page)

    await expect(getAdminPageContainer(page)).toHaveScreenshot('legacy-admin-edit-page.png', {
      animations: 'disabled',
      caret: 'hide',
    })
  })

  test('edit manager stays visually stable', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, ADMIN_LEGACY_PROJECT_NAME)
    await page.goto('/admin/edit')
    await page.getByRole('heading', { name: 'Existing commissions' }).waitFor()
    await prepareStablePage(page)

    await expectUnionToMatchSnapshot(page, 'legacy-admin-edit-manager.png', [
      page.getByRole('heading', { name: 'Existing commissions' }),
      page.getByRole('combobox', { name: 'Search commissions' }),
      page.getByRole('button', { name: 'Refresh Assets Cache' }),
    ])
  })

  test('aliases page stays visually stable', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, ADMIN_LEGACY_PROJECT_NAME)
    await page.goto('/admin/aliases')
    await page.getByRole('heading', { level: 1, name: 'Aliases' }).waitFor()
    await prepareStablePage(page)

    await expect(getAdminPageContainer(page)).toHaveScreenshot('legacy-admin-aliases-page.png', {
      animations: 'disabled',
      caret: 'hide',
    })
  })

  test('aliases dashboard stays visually stable', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, ADMIN_LEGACY_PROJECT_NAME)
    await page.goto('/admin/aliases')
    await page.getByRole('heading', { name: 'Alias mapping' }).waitFor()
    await prepareStablePage(page)

    await expectUnionToMatchSnapshot(page, 'legacy-admin-aliases-dashboard.png', [
      page.getByRole('heading', { name: 'Alias mapping' }),
      page.getByRole('tablist'),
      page.getByRole('button', { name: 'Save character aliases' }),
      page.getByRole('textbox').nth(4),
    ])
  })

  test('suggestion page stays visually stable', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, ADMIN_LEGACY_PROJECT_NAME)
    await page.goto('/admin/suggestion')
    await page.getByRole('heading', { level: 1, name: 'Suggestion' }).waitFor()
    await prepareStablePage(page)

    await expect(getAdminPageContainer(page)).toHaveScreenshot('legacy-admin-suggestion-page.png', {
      animations: 'disabled',
      caret: 'hide',
    })
  })

  test('suggestion dashboard stays visually stable', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, ADMIN_LEGACY_PROJECT_NAME)
    await page.goto('/admin/suggestion')
    await page.getByRole('heading', { name: 'Suggestion curation' }).waitFor()
    await prepareStablePage(page)

    await expectUnionToMatchSnapshot(page, 'legacy-admin-suggestion-dashboard.png', [
      page.getByRole('heading', { name: 'Suggestion curation' }),
      page.getByRole('list').first(),
      page.getByRole('searchbox', { name: 'Filter keyword options' }),
    ])
  })
})
