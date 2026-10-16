import { expect, test, type Page } from '@playwright/test'
import { clickField, createSevenVsSeven, save } from './support/editorActions'

// Placement presets in the browser library (Firefox, degraded mode, SPEC 8.6, D-092): saved in
// IndexedDB, kept after a reload, applied by their anchor.

const library = (page: Page) => page.getByRole('complementary', { name: 'Bibliothèque' })
const banner = (page: Page) => page.getByTestId('placement-banner')

test('saves a preset in the browser and applies it after a reload', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByTestId('degraded-banner')).toBeVisible()
  await createSevenVsSeven(page, 'Navigateur')
  await save(page)
  await library(page).getByRole('tab', { name: 'Modèles' }).click()
  await library(page).getByRole('button', { name: 'Enregistrer un modèle…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Enregistrer un modèle' })
  await dialog.getByLabel('Nom').fill('Touche nav')
  await dialog.getByLabel('Type').selectOption({ label: 'Touche' })
  await dialog.getByRole('button', { name: 'Cliquer le point d’ancrage' }).click()
  await clickField(page, 40, 50)
  await expect(page.getByText('Modèle « Touche nav » enregistré.')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Ouvrir Navigateur' }).click()
  await library(page).getByRole('tab', { name: 'Modèles' }).click()
  const item = library(page).getByRole('listitem', { name: 'Modèle Touche nav' })
  await expect(item).toContainText('Touche · 14 joueuses')
  await item.getByRole('button', { name: 'Appliquer' }).click()
  await expect(banner(page)).toBeVisible()
  await clickField(page, 60, 50)
  await expect(banner(page)).toHaveCount(0)
  await expect(
    page.getByRole('complementary', { name: 'Inspecteur' }).getByLabel('Catégorie'),
  ).toHaveValue('lineout')
})
