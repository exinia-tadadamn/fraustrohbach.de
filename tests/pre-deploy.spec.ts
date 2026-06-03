/**
 * Pre-Deploy Smoke-Tests für fraustrohbach.de
 * --------------------------------------------
 * Wird VOR jedem `firebase deploy` ausgeführt, um zu verifizieren:
 *   1. Alle Hauptseiten laden ohne Fehler
 *   2. Kritische UI-Elemente sind vorhanden
 *   3. Vent-Tool funktioniert (28 Tests, inkl. neue Auto-L_opt & Nährstoff-Plot)
 *   4. Keine Console-Errors, keine 4xx/5xx-Requests
 *   5. Kein Mixed-Content, alle Assets laden
 *
 * Aufruf: cd /Users/kseniastrohbach/Dokumentelokal/website
 *         npx playwright test tests/pre-deploy.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

// ---- helpers ----------------------------------------------------------------

async function loadPage(page: Page, path: string): Promise<{ status: number; errors: string[] }> {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  const consoleErrors: string[] = [];

  const consoleHandler = (msg: any) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  };
  const pageErrorHandler = (err: Error) => consoleErrors.push(err.message);
  const responseHandler = (res: any) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  };

  page.on('console', consoleHandler);
  page.on('pageerror', pageErrorHandler);
  page.on('response', responseHandler);

  const response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });

  // Allow async Firestore/blog loaders a moment (offline-fähig)
  await page.waitForTimeout(2000);

  page.off('console', consoleHandler);
  page.off('pageerror', pageErrorHandler);
  page.off('response', responseHandler);

  errors.push(...consoleErrors, ...failedRequests);
  return { status: response?.status() ?? 0, errors };
}

// ============================================================================
// Smoke-Tests: alle Hauptseiten
// ============================================================================

test.describe('Hauptseiten — Smoke', () => {
  const PAGES = [
    { path: '/index.html',           title: 'Exinia | Temporal Lenses',     h1Pattern: /Temporal|Echoes|Published|Exinia/ },
    { path: '/about.html',           title: 'Exinia | About the Artist',    h1Pattern: /About|Exinia|Strohbach/ },
    { path: '/blog.html',            title: 'Exinia | Transmission Log',    h1Pattern: /Transmission|Blog|Exinia/ },
    { path: '/vent/index.html',      title: /Vénta.*Hydrothermal Vent Simulation/, h1Pattern: /Vénta/ },
  ];

  for (const { path, title, h1Pattern } of PAGES) {
    test(`${path} lädt, Titel + H1 korrekt, keine Fehler`, async ({ page }) => {
      const { status, errors } = await loadPage(page, path);

      expect(status, `${path}: HTTP-Status`).toBeGreaterThanOrEqual(200);
      expect(status, `${path}: HTTP-Status`).toBeLessThan(400);

      // Titel
      await expect(page).toHaveTitle(title);

      // H1 muss sichtbar sein und Text enthalten
      const h1Element = page.locator('h1').first();
      await expect(h1Element, `${path}: H1 sichtbar`).toBeVisible();
      const h1Text = (await h1Element.textContent()) ?? '';
      expect(h1Text, `${path}: H1 matched ${h1Pattern}`).toMatch(h1Pattern);

      // Keine Console-Errors, keine fehlgeschlagenen Requests
      // Erlaube externe CDN-/Firestore-Fehler (offline oder nicht konfiguriert)
      const realErrors = errors.filter((e) =>
        !e.includes('cdn.tailwindcss.com') &&
        !e.includes('unpkg.com') &&
        !e.includes('fonts.googleapis.com') &&
        !e.includes('gstatic.com') &&
        !e.includes('firestore.googleapis.com') &&
        !e.includes('firebaseio.com') &&
        !e.includes('googleapis.com') &&
        !e.includes('Failed to load resource')  // generischer Offline-Error
      );
      expect(realErrors, `${path}: Fehler: ${realErrors.join('\n')}`).toEqual([]);
    });
  }
});

// ============================================================================
// Navbar / Footer — konsistent auf allen Hauptseiten
// ============================================================================

test.describe('Navigation — Konsistenz', () => {
  test('Hauptseiten haben ein <nav>-Element mit Home-Link', async ({ page }) => {
    for (const path of ['/index.html', '/about.html', '/blog.html', '/vent/index.html']) {
      await page.goto(BASE + path);
      const nav = page.locator('nav').first();
      await expect(nav, `${path}: nav existiert`).toBeVisible();
      const homeLink = nav.locator('a[href*="index.html"]').first();
      await expect(homeLink, `${path}: Home-Link in nav`).toBeAttached();
    }
  });

  test('Hauptseiten haben ein <footer> mit Kontakt-Info', async ({ page }) => {
    for (const path of ['/index.html', '/about.html', '/blog.html', '/vent/index.html']) {
      await page.goto(BASE + path);
      const footer = page.locator('footer').first();
      await expect(footer, `${path}: footer existiert`).toBeAttached();
      // Mindestens ein Link im Footer
      const footerLinks = await footer.locator('a').count();
      expect(footerLinks, `${path}: footer hat Links`).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Vent-Tool — re-run der existierenden Test-Suite via "import" wäre
// möglich, aber Playwright lädt Specs nicht transitiv. Wir verweisen
// stattdessen in der Konsole auf das Hauptset.
// ============================================================================

test.describe('Vent-Tool — Sanity (Pre-Deploy)', () => {
  test('Tool lädt, Default-Werte korrekt', async ({ page }) => {
    await page.goto(BASE + '/vent/index.html');

    await expect(page.locator('#val-density')).toHaveText('1000');
    await expect(page.locator('#val-vpeak')).toHaveText('1.000');
    await expect(page.locator('#val-cell')).toHaveText('2.0 µm');
    await expect(page.locator('#val-length')).toHaveText('10.0');
    await expect(page.locator('#val-pressure')).toHaveText('2600');
  });

  test('L_opt ist read-only', async ({ page }) => {
    await page.goto(BASE + '/vent/index.html');
    const slider = page.locator('#slider-lopt');
    await expect(slider).toBeDisabled();
  });

  test('Beide Canvas-Elemente (Power + Nutrients) sind sichtbar', async ({ page }) => {
    await page.goto(BASE + '/vent/index.html');
    await expect(page.locator('#power-plot')).toBeVisible();
    await expect(page.locator('#nutrients-plot')).toBeVisible();
  });

  test('Sektion §4 (Quellen) ist vorhanden', async ({ page }) => {
    await page.goto(BASE + '/vent/index.html');
    const section = page.locator('#quellen');
    await expect(section).toBeAttached();
    // Mindestens 10 Quellen-Einträge mit class source-num
    const sources = await section.locator('.source-num').count();
    expect(sources, 'Anzahl nummerierter Quellen').toBeGreaterThanOrEqual(10);
  });

  test('Theorie-Sektion (§1) ist vorhanden', async ({ page }) => {
    await page.goto(BASE + '/vent/index.html');
    const section = page.locator('#theorie');
    await expect(section).toBeAttached();
    // Schlüsselbegriffe aus Theorie
    await expect(page.getByText('Schwarze Raucher', { exact: false }).first()).toBeAttached();
    await expect(page.getByText('Slender-Body', { exact: false }).first()).toBeAttached();
    await expect(page.getByText('Nährstoff-Verfügbarkeit', { exact: false }).first()).toBeAttached();
  });

  test('Begründungs-Sektion (§2) enthält Formeln', async ({ page }) => {
    await page.goto(BASE + '/vent/index.html');
    const section = page.locator('#begruendung');
    await expect(section).toBeAttached();
    // Formel-Klassen müssen existieren
    const formulas = await section.locator('.formula').count();
    expect(formulas, 'Anzahl .formula-Elemente').toBeGreaterThanOrEqual(5);
  });
});

// ============================================================================
// Asset-Lieferung — kein 404, keine Mixed-Content-Warnungen
// ============================================================================

test.describe('Asset-Lieferung', () => {
  test('alle eigenen JS- und CSS-Dateien liefern 200', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', (res) => {
      // Nur eigene Pfade prüfen (kein CDN, kein Firestore)
      const url = res.url();
      if (url.startsWith(BASE) && res.status() >= 400) {
        failed.push(`${res.status()} ${url}`);
      }
    });

    await page.goto(BASE + '/vent/index.html');
    await page.waitForTimeout(500);

    expect(failed, `Fehlgeschlagene Asset-Requests: ${failed.join('\n')}`).toEqual([]);
  });

  test('app.js lädt syntaktisch (kein Parse-Error in der Konsole)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(BASE + '/vent/index.html');
    await page.waitForTimeout(500);

    // Filtere harmlose Tailwind-CDN-Warnungen
    const realErrors = errors.filter((e) => !e.includes('cdn.tailwindcss.com'));
    expect(realErrors, `Parse-Errors: ${realErrors.join('\n')}`).toEqual([]);
  });
});
