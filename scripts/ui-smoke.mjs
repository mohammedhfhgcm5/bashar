/**
 * UI smoke with seed accounts.
 * citizen/org: Demo1234! (SEED_PASSWORD) · supervisor: Supervisor123! (BOOTSTRAP)
 * Uses in-app NavLink clicks so the JWT in memory is preserved.
 */
import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'tmp', 'ui-smoke')
const base = process.env.WEB_ORIGIN || 'http://127.0.0.1:5173'

const accounts = {
  citizen: { email: 'citizen@damage.local', password: 'Demo1234!' },
  supervisor: { email: 'supervisor@damage.local', password: 'Supervisor123!' },
  org: { email: 'org@damage.local', password: 'Demo1234!' },
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true })
  console.log('shot', name)
}

async function login(page, account) {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(account.email)
  await page.locator('input[type="password"]').fill(account.password)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 }),
    page.getByRole('button', { name: 'دخول' }).click(),
  ])
  await page.locator('aside nav').waitFor({ state: 'visible' })
}

async function goNav(page, label) {
  await page.locator('aside nav').getByRole('link', { name: label, exact: true }).click()
  await page.waitForTimeout(600)
}

async function logout(page) {
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click()
  await page.waitForURL(/\/login/, { timeout: 15_000 })
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, locale: 'ar' })
  page.setDefaultTimeout(30_000)

  console.log('citizen…')
  await login(page, accounts.citizen)
  await goNav(page, 'البلاغات')
  await page.locator('main table a').first().waitFor({ state: 'visible' })
  await shot(page, '01-citizen-reports')

  await page.locator('main table a').first().click()
  await page.waitForURL(/\/reports\/[0-9a-f-]+/i)
  await page.locator('main').getByText('اقتراح النموذج').waitFor()
  const assess = page.getByRole('button', { name: 'تقييم الصور' })
  if (await assess.isVisible().catch(() => false)) {
    await assess.click()
    await page.getByRole('button', { name: 'جارٍ التقييم…' }).waitFor({ state: 'hidden', timeout: 90_000 }).catch(() => {})
    await page.waitForTimeout(2000)
  }
  await shot(page, '02-citizen-report-assessment')

  await goNav(page, 'البلاغات')
  const draftLink = page.locator('main tr', { hasText: 'مسودة' }).locator('a').first()
  if (await draftLink.count()) {
    await draftLink.click()
    await page.locator('main').getByText('تعديل المسودة').waitFor()
    await shot(page, '03-citizen-draft-editor')
  }

  await goNav(page, 'الخريطة')
  await page.waitForTimeout(2000)
  await shot(page, '04-citizen-map')
  await logout(page)

  console.log('supervisor…')
  await login(page, accounts.supervisor)
  await goNav(page, 'المساعدات')
  await page.locator('main').getByText('المساعدات').waitFor()
  await shot(page, '05-supervisor-aid')

  await goNav(page, 'البلاغات')
  await page.locator('main table a').first().waitFor({ state: 'visible' })
  await shot(page, '06-supervisor-reports')
  const reviewLink = page.locator('main tr', { hasText: /مُرسل|قيد المراجعة/ }).locator('a').first()
  if (await reviewLink.count()) {
    await reviewLink.click()
    await page.locator('main').getByRole('heading', { name: 'المراجعة', exact: true }).waitFor()
    await shot(page, '07-supervisor-review')
  }
  await logout(page)

  console.log('org…')
  await login(page, accounts.org)
  await goNav(page, 'المساعدات')
  await page.locator('input[placeholder="مثلاً RPT-2026"]').fill('RPT')
  await page.waitForTimeout(1200)
  await shot(page, '08-org-aid')
  await goNav(page, 'الإحصاء')
  await page.locator('main').getByText('الإحصاء').waitFor()
  await shot(page, '09-org-stats')

  await browser.close()
  console.log('done →', outDir)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
