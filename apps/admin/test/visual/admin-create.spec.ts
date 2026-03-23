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

test('admin nav switches sections without a full reload', async ({ page }, testInfo) => {
  skipUnlessProject(testInfo, ADMIN_PROJECT_NAME)
  await page.goto('/create')
  await page.getByRole('heading', { name: 'Add Character' }).waitFor()

  await page.evaluate(() => {
    sessionStorage.removeItem('__admin-beforeunload')
    window.addEventListener('beforeunload', () => {
      sessionStorage.setItem('__admin-beforeunload', '1')
    }, { once: true })
  })

  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Edit' }).click()
  await page.getByRole('heading', { level: 1, name: 'Edit' }).waitFor()
  await page.getByRole('heading', { name: 'Existing commissions' }).waitFor()

  await expect(page).toHaveURL(/\/edit$/)
  await expect.poll(async () => page.evaluate(() => sessionStorage.getItem('__admin-beforeunload'))).toBeNull()
})

test('overview quick actions stay inside the client shell', async ({ page }, testInfo) => {
  skipUnlessProject(testInfo, ADMIN_PROJECT_NAME)
  await page.goto('/')
  await page.getByRole('heading', { level: 1, name: 'Admin Overview' }).waitFor()
  await page.getByRole('heading', { name: 'Quick actions' }).waitFor()

  await page.evaluate(() => {
    sessionStorage.removeItem('__admin-beforeunload')
    window.addEventListener('beforeunload', () => {
      sessionStorage.setItem('__admin-beforeunload', '1')
    }, { once: true })
  })

  await page.getByRole('link', { name: 'Edit existing' }).click()
  await page.getByRole('heading', { level: 1, name: 'Edit' }).waitFor()
  await page.getByRole('heading', { name: 'Existing commissions' }).waitFor()

  await expect(page).toHaveURL(/\/edit$/)
  await expect.poll(async () => page.evaluate(() => sessionStorage.getItem('__admin-beforeunload'))).toBeNull()
})
