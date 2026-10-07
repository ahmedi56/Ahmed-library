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

/**
 * Headless Edge draws the 3D room in software (SwiftShader) on the CPU,
 * which on a modest machine leaves the page busy enough that even plain
 * timers run late — a 1.2 s book close was measured taking 5 s. A small
 * viewport at the lowest quality tier keeps that load down; the room
 * tests also get triple time via test.slow(). None of this reflects what
 * a visitor with a GPU sees.
 */
async function freshRoom(page: Page) {
  test.slow();
  await page.setViewportSize({ width: 960, height: 600 });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('library-perf', 'low');
  });
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

  // Ask the librarian. `vite preview` runs no serverless functions, so this
  // also checks the panel says so plainly instead of breaking.
  await page.getByRole('button', { name: /ASK THE LIBRARIAN/ }).click();
  const ask = page.getByRole('dialog', { name: 'Ask the librarian' });
  await expect(ask).toBeVisible();
  await expect(ask.getByRole('textbox', { name: 'Your question' })).toBeFocused();
  await ask.getByRole('button', { name: 'What has Ahmed built?' }).click();
  await expect(ask.getByRole('alert')).toContainText('not available on this deployment');
  await expect(ask.getByRole('textbox', { name: 'Your question' })).toHaveValue('What has Ahmed built?');
  await page.keyboard.press('Escape');
  await expect(ask).toBeHidden();

  expect(errors).toEqual([]);
});

test('room: deep link, stamps, borrower’s card', async ({ page }) => {
  const errors = trackErrors(page);
  await freshRoom(page);
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
  // One stamp is enough to share.
  await expect(card.getByRole('button', { name: 'Share your card' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Save as image' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();

  expect(errors).toEqual([]);
});

test('room: guided tour opens books in order and can be ended', async ({ page }) => {
  const errors = trackErrors(page);
  await freshRoom(page);
  await page.goto('/?book=contact');
  await expect(openBook(page)).toContainText('Contact');
  await page.keyboard.press('Escape');
  await expect(openBook(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'TOUR', exact: true }).click();
  const bar = page.getByRole('region', { name: 'Guided tour' });
  await expect(bar).toContainText('1 of 8');
  // The tour walks to the first book and opens it on its own.
  await expect(openBook(page)).toContainText('About Me', { timeout: 60_000 });

  await bar.getByRole('button', { name: /END/ }).click();
  await expect(bar).toBeHidden();
  await expect(openBook(page)).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('room: a project link opens the TV viewing mode, browses, and returns', async ({ page }) => {
  const errors = trackErrors(page);
  await freshRoom(page);
  await page.goto('/?project=freshly');

  const panel = page.getByRole('dialog', { name: 'Freshly' });
  // Loading the room is the slowest step under CPU rendering.
  await expect(panel).toBeVisible({ timeout: 60_000 });
  await expect(panel).toContainText('Project 1 of 3');
  await expect(panel).toContainText('Express');
  await expect(page).toHaveURL(/project=freshly/);

  // Browse with the keyboard; the address follows.
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Prowise' })).toBeVisible();
  await expect(page).toHaveURL(/project=prowise/);

  // Esc returns to the room and clears the link.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Prowise' })).toBeHidden();
  await expect(page).not.toHaveURL(/project=/);

  expect(errors).toEqual([]);
});
