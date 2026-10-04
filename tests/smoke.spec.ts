import { test, expect, type Page } from '@playwright/test';

/**
 * Collects uncaught exceptions. Failed resource loads are not exceptions:
 * the "no CV uploaded yet" Firestore 404 is expected on a fresh database.
 */
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/**
 * The book panel once it is really open. While a book is still flying off
 * the shelf (or back onto it) the panel is mounted but faded out and
 * `inert` — which Playwright would otherwise count as visible.
 */
function openBook(page: Page) {
  return page.locator('[role="dialog"][aria-labelledby="book-content-title"]:not([inert])');
}

test('flat view: open a book and close it', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => localStorage.setItem('library-view', 'flat'));
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome to my library' })).toBeVisible();
  await page.getByRole('button', { name: /About Me/ }).click();
  const dialog = page.getByRole('dialog', { name: 'About Me' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\?book=about/);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test('room: deep link, stamps, borrower’s card', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?book=about');

  // The 3D room loaded (not the flat fallback) and opened the linked book.
  await expect(page.locator('canvas')).toBeVisible();
  await expect(openBook(page)).toContainText('About Me');

  // Arriving earns "Come in", then "First chapter" — one slip at a time.
  await expect(page.getByRole('status').filter({ hasText: 'Come in' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(openBook(page)).toHaveCount(0);

  await page.keyboard.press('j');
  const card = page.getByRole('dialog', { name: /Borrower.s card/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Come in');
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();

  expect(errors).toEqual([]);
});

test('room: guided tour opens books in order and can be ended', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?book=contact');
  await expect(openBook(page)).toContainText('Contact');
  await page.keyboard.press('Escape');
  await expect(openBook(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'TOUR', exact: true }).click();
  const bar = page.getByRole('region', { name: 'Guided tour' });
  await expect(bar).toContainText('1 of 8');
  // The tour walks to the first book and opens it on its own.
  await expect(openBook(page)).toContainText('About Me', { timeout: 20_000 });

  await bar.getByRole('button', { name: /END/ }).click();
  await expect(bar).toBeHidden();
  await expect(openBook(page)).toHaveCount(0);

  expect(errors).toEqual([]);
});
