import { test as base, expect } from '@playwright/test';
import { expectRenderedContrast } from '../local-sheet/contrast';

const test = base.extend<{ safety: void }>({ safety: [async ({ context, page }, use) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  const unexpectedRequests: string[] = [];
  await context.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).origin !== 'http://127.0.0.1:3198' || !['GET', 'HEAD'].includes(request.method())) {
      unexpectedRequests.push(`${request.method()} ${new URL(request.url()).origin}`);
      return route.abort();
    }
    await route.continue();
  });
  await use();
  expect(browserErrors).toEqual([]);
  expect(unexpectedRequests).toEqual([]);
  expect(await page.evaluate(() => window.overviewReview.blocked)).toEqual([]);
}, { auto: true }] });

for (const width of [390, 1440]) {
  for (const theme of ['dark', 'light'] as const) {
    test(`character overview workflows fit ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.addInitScript(value => { if (!localStorage.getItem('inkborne-theme')) localStorage.setItem('inkborne-theme', value); }, theme);
      for (const route of ['/dashboard', '/characters']) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.locator('main a[href="/characters/11111111-1111-4111-8111-000000000001"]')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => window.overviewReview.blocked)).toEqual([]);
        const calls = await page.evaluate(() => window.overviewReview.operations.filter(operation => operation.table === 'characters'));
        expect(calls).toHaveLength(1);
        expect(calls[0].filters).toContainEqual(['user_id', 'local-overview-reviewer']);
        expect(calls[0].filters).toContainEqual(['archived', false]);
        await expect(page.locator('header img[src*="/brand/"]').filter({ visible: true })).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: test.info().outputPath(`${route.slice(1)}-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
      }
      await page.getByLabel('Review theme').selectOption(theme === 'dark' ? 'light' : 'dark');
      await expect.poll(() => page.evaluate(() => localStorage.getItem('inkborne-theme'))).toBe(theme === 'dark' ? 'light' : 'dark');
      await page.reload();
      await expect(page.getByLabel('Review theme')).toHaveValue(theme === 'dark' ? 'light' : 'dark');
    });
  }
}

test('blank and single-character states retain real creation and character destinations', async ({ page }) => {
  for (const route of ['/dashboard', '/characters']) {
    await page.goto(route + '?scenario=empty');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.locator('main a[href="/characters/new"]').count()).toBeGreaterThan(0);
    await page.goto(route + '?scenario=single');
    await expect(page.getByText('Mara Stonepath', { exact: true })).toBeVisible();
    await expect(page.locator('main a[href="/characters/11111111-1111-4111-8111-000000000001"]')).toHaveCount(1);
  }
});

test('campaign names appear only on assigned character entries in both themes', async ({ page }) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 844 : 1000 });
    for (const theme of ['dark', 'light']) {
      for (const route of ['/dashboard', '/characters']) {
        await page.goto(route);
        await page.getByLabel('Review theme').selectOption(theme);
        const main = page.locator('main');
        const first = route === '/dashboard' ? page.getByRole('region', { name: 'Your latest character' }) : main.locator('a[href="/characters/11111111-1111-4111-8111-000000000001"]');
        await expect(first).toContainText('Campaign · Lanterns of Bellmere');
        await expect(main.locator('a[href="/characters/11111111-1111-4111-8111-000000000003"]')).toContainText('Campaign · Lanterns of Bellmere');
        await expect(main.locator('a[href="/characters/11111111-1111-4111-8111-000000000002"]')).not.toContainText('Campaign');
        await expect(main.getByText(/No campaign|Unassigned campaign/i)).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: test.info().outputPath(`campaign-${route.slice(1)}-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
      }
    }
  }
});

test('actual appearance menu persists across pages and System follows the device', async ({ page }) => {
  await page.goto('/dashboard');
  const choose = async (mode: string) => {
    await page.getByRole('button', { name: 'Appearance', exact: true }).filter({ visible: true }).click();
    await page.getByRole('menuitemradio', { name: mode, exact: true }).click();
  };
  await choose('Light');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.locator('main').getByRole('link', { name: /View all/ }).click();
  await expect(page.getByRole('heading', { name: 'Characters', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Appearance', exact: true }).filter({ visible: true })).toHaveAttribute('data-appearance', 'light');
  await choose('Dark');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' });
  await choose('System');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('accent identities stay local to entries and remain readable in both themes', async ({ page }) => {
  for (const theme of ['dark', 'light']) {
    for (const route of ['/dashboard', '/characters']) {
      await page.goto(route);
      await page.getByLabel('Review theme').selectOption(theme);
      const sources = await page.locator('main [style*="--character-light-source"]').evaluateAll(nodes => nodes.map(node => ({
        light: (node as HTMLElement).style.getPropertyValue('--character-light-source').trim(),
        dark: (node as HTMLElement).style.getPropertyValue('--character-dark-source').trim(),
        active: getComputedStyle(node).getPropertyValue('--entry-source').trim(),
      })));
      expect(sources).toHaveLength(8);
      expect(sources.map(source => source.active)).toEqual(sources.map(source => theme === 'dark' ? source.dark : source.light));
      expect(new Set(sources.map(source => source.active)).size).toBeGreaterThan(5);
      const frameAccent = await page.locator('[data-character-app]').evaluate(node => getComputedStyle(node).getPropertyValue('--accent').trim());
      expect(frameAccent).toBe(theme === 'dark' ? '#C9A44A' : '#785923');
      const targets = page.locator('main [style*="--character-light-source"] span, main [style*="--character-light-source"] p');
      for (const target of await targets.all()) {
        // Only leaf text: decorative stars and composite wrappers add no text roles.
        if (await target.evaluate(node => node.children.length === 0 && !!node.textContent?.trim() && !node.getAttribute('aria-hidden'))) {
          await expectRenderedContrast(target);
        }
      }
      const action = page.locator('main a[href="/characters/new"]').first();
      await expectRenderedContrast(action);
      await action.hover();
      await expectRenderedContrast(action);
    }
  }
});

test('long content, empty and read-failure states fit narrow and tablet screens', async ({ page }) => {
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/dashboard', '/characters']) {
      for (const scenario of ['long', 'empty', 'error']) {
        await page.goto(`${route}?scenario=${scenario}&name=long`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        if (scenario === 'error') {
          await expect(page.getByRole('alert')).toContainText('couldn’t be loaded');
          await expect(page.getByText('No characters yet.')).toHaveCount(0);
          await expect(page.getByText('Folio I · A blank notebook')).toHaveCount(0);
        }
        if (width === 320) await page.screenshot({ path: test.info().outputPath(`${route.slice(1)}-${scenario}-320.png`), fullPage: true });
      }
    }
  }
});

test('keyboard focus and mobile navigation retain usable destinations', async ({ page }) => {
  await page.goto('/characters');
  const card = page.locator('main a[href="/characters/11111111-1111-4111-8111-000000000001"]');
  for (let step = 0; step < 40 && !await card.evaluate(node => node.matches(':focus-visible')); step++) await page.keyboard.press('Tab');
  await expectRenderedContrast(card, { focus: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('link', { name: 'Library', exact: true })).toHaveAttribute('href', '/library');
  await expect(dialog.getByRole('link', { name: 'Homebrew', exact: true })).toHaveAttribute('href', '/homebrew');
  await expect.poll(() => dialog.evaluate(node => {
    for (let current: Element | null = node; current; current = current.parentElement) if (getComputedStyle(current).opacity !== '1') return false;
    return true;
  })).toBe(true);
  await expectRenderedContrast(dialog.getByRole('link', { name: 'Characters', exact: true }));
  await dialog.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('alpha dismissal is explicitly simulated in this browser', async ({ page }) => {
  await page.goto('/dashboard?alpha=visible');
  await expect(page.getByText('You’re testing Inkborne Alpha')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss alpha banner' }).click();
  await expect(page.getByText('You’re testing Inkborne Alpha')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('You’re testing Inkborne Alpha')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('inkborne-overview-alpha-dismissed'))).toBe('true');
  expect(await page.evaluate(() => window.overviewReview.blocked)).toEqual([]);
});

test('real feedback form reports the local-review sending boundary', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Send feedback', exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("What's on your mind?").fill('A fictional local review note.');
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Feedback is not sent from this fictional local review.');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
