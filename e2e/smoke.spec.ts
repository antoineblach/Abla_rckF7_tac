import { expect, test } from '@playwright/test'

test('the application loads', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Combinaisons rugby à 7' })).toBeVisible()
})
