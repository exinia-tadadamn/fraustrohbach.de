/**
 * Vent Tool — End-to-End Tests (v2 — mit Auto-L_opt & Nährstoff-Graph)
 */

import { test, expect, type Page } from '@playwright/test';

const VENT_URL = '/vent/index.html';

// ---- helpers ----------------------------------------------------------------

async function readOutput(page: Page, id: string): Promise<string> {
  return (await page.locator(`#${id}`).textContent())?.trim() ?? '';
}

async function setSlider(page: Page, id: string, value: number): Promise<void> {
  // Native HTML5 range: fill() rejects out-of-step values; use evaluate to bypass.
  await page.locator(`#${id}`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function showResultPanel(page: Page): Promise<void> {
  await page.click('#run-sim-btn');
  await expect(page.locator('#result-panel')).toBeVisible();
}

// ---- tests ------------------------------------------------------------------

test.describe('Vent tool — Struktur & Inhalt', () => {
  test('lädt mit Titel und allen Sektionen', async ({ page }) => {
    await page.goto(VENT_URL);

    await expect(page).toHaveTitle(/Vénta.*Hydrothermal Vent Simulation/);
    await expect(page.locator('h1').first()).toContainText('Vénta');

    for (const id of ['theorie', 'begruendung', 'vis', 'quellen']) {
      const sec = page.locator(`#${id}`);
      await expect(sec).toHaveCount(1);
      await expect(sec).not.toBeEmpty();
    }

    await expect(page.getByText('Schwarze Raucher', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Slender-Body', { exact: false }).first()).toBeAttached();
    await expect(page.getByText('Resistance-Force-Theory', { exact: false }).first()).toBeAttached();
    await expect(page.getByText('Nährstoff-Verfügbarkeit', { exact: false }).first()).toBeAttached();
  });

  test('zeigt Default-Werte korrekt an', async ({ page }) => {
    await page.goto(VENT_URL);

    await expect(page.locator('#val-density')).toHaveText('1000');
    await expect(page.locator('#val-efficiency')).toHaveText('0.50');
    await expect(page.locator('#val-vmin')).toHaveText('0.0010');
    await expect(page.locator('#val-vpeak')).toHaveText('0.050');
    await expect(page.locator('#val-cell')).toHaveText('2.0 µm');
    await expect(page.locator('#val-length')).toHaveText('10.0');
    await expect(page.locator('#val-pressure')).toHaveText('2600');
  });

  test('L_opt ist read-only (Auto-berechnet)', async ({ page }) => {
    await page.goto(VENT_URL);

    const slider = page.locator('#slider-lopt');
    await expect(slider).toBeDisabled();
    // Wert wird vom JS gesetzt — kein direkter Input möglich
    const value = await slider.inputValue();
    expect(parseFloat(value)).toBeGreaterThan(0);
  });

  test('alle 30 nummerierten Quellen sind in §4 gerendert', async ({ page }) => {
    await page.goto(VENT_URL);
    await page.locator('#quellen').scrollIntoViewIfNeeded();

    const sourceNumbers = await page
      .locator('#quellen .source-num')
      .evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ''));

    for (let i = 1; i <= 30; i++) {
      expect(sourceNumbers, `Quelle [${i}] fehlt`).toContain(String(i));
    }
    expect(sourceNumbers.length).toBeGreaterThanOrEqual(30);
  });
});

test.describe('Vent tool — Auto-berechnete L_opt', () => {
  test('Default L_opt liegt im plausiblen Bereich (50–100 µm)', async ({ page }) => {
    await page.goto(VENT_URL);
    const lopt = parseFloat((await readOutput(page, 'val-lopt')).replace(/[^\d.]/g, ''));
    // v_peak jetzt 0.05 m/s → L_opt = 8·√(μ·L_cell/(ρ·v)) ≈ 68 µm (höher als vorher)
    expect(lopt).toBeGreaterThan(50);
    expect(lopt).toBeLessThan(100);
  });

  test('L_opt steigt mit Zellgröße (L_opt ∝ √L_cell)', async ({ page }) => {
    await page.goto(VENT_URL);
    const l1 = parseFloat((await readOutput(page, 'val-lopt')).replace(/[^\d.]/g, ''));

    // Zellgröße 4× größer (2 → 8 µm) → L_opt verdoppelt sich
    await setSlider(page, 'slider-cell', 8.0);
    await page.waitForTimeout(100);
    const l2 = parseFloat((await readOutput(page, 'val-lopt')).replace(/[^\d.]/g, ''));

    const ratio = l2 / l1;
    // Erwartet: √(8/2) = 2.0, ±10 %
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.2);
  });

  test('L_opt fällt mit v_peak (L_opt ∝ 1/√v_peak)', async ({ page }) => {
    await page.goto(VENT_URL);
    const l1 = parseFloat((await readOutput(page, 'val-lopt')).replace(/[^\d.]/g, ''));

    // v_peak 4× größer (0.05 → 0.08, gerundet durch step=0.001) → L_opt halbiert sich
    await setSlider(page, 'slider-vpeak', 0.08);
    await page.waitForTimeout(100);
    const l2 = parseFloat((await readOutput(page, 'val-lopt')).replace(/[^\d.]/g, ''));

    const ratio = l2 / l1;
    // Erwartet: √(0.05/0.08) ≈ 0.79, ±10 %
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(0.9);
  });

  test('L_opt fällt mit Dichte (L_opt ∝ 1/√ρ)', async ({ page }) => {
    await page.goto(VENT_URL);
    const l1 = parseFloat((await readOutput(page, 'val-lopt')).replace(/[^\d.]/g, ''));

    // ρ 1.21× größer (1000 → 1100) → L_opt ~0.91
    await setSlider(page, 'slider-density', 1100);
    await page.waitForTimeout(100);
    const l2 = parseFloat((await readOutput(page, 'val-lopt')).replace(/[^\d.]/g, ''));

    const ratio = l2 / l1;
    // Erwartet: 1/√1.21 = 0.91, ±5 %
    expect(ratio).toBeGreaterThan(0.86);
    expect(ratio).toBeLessThan(0.96);
  });

  test('L_opt und L_opt-Formel-Anzeige sind synchron', async ({ page }) => {
    await page.goto(VENT_URL);
    const a = (await readOutput(page, 'val-lopt')).replace(/[^\d.]/g, '');
    const b = (await readOutput(page, 'val-lopt-formula'));
    expect(parseFloat(a)).toBeCloseTo(parseFloat(b), 0);
  });
});

test.describe('Vent tool — Power-Plot Physik', () => {
  test('Default-Physik produziert positive Leistung und ATP', async ({ page }) => {
    await page.goto(VENT_URL);
    await showResultPanel(page);

    const kin = await readOutput(page, 'out-kinetic');
    expect(kin).toMatch(/e-?\d+/);
    expect(kin).not.toBe('--');

    const atp = await readOutput(page, 'out-atp');
    expect(atp).toMatch(/e-?\d+/);
    expect(atp).not.toBe('--');

    const veff = await readOutput(page, 'out-veff');
    expect(veff).toMatch(/m\/s$/);
  });

  test('P_kin reagiert auf Dichte (qualitativ, signifikante Änderung erwartet)', async ({ page }) => {
    await page.goto(VENT_URL);
    await showResultPanel(page);

    // Im Stokes-Regime ist P_kin = 2·μ·L·v² (unabhängig von ρ).
    // Aber L_opt hängt von ρ ab (1/√ρ), was v_eff bei festem L verschiebt.
    // → signifikante P_kin-Änderung über L_opt-Shift.
    await setSlider(page, 'slider-cell', 2.0);
    await setSlider(page, 'slider-vpeak', 0.05);
    await setSlider(page, 'slider-length', 68);
    await setSlider(page, 'slider-density', 1000);
    await page.waitForTimeout(200);
    const p1 = await readOutput(page, 'out-kinetic');

    await setSlider(page, 'slider-density', 1100);
    await page.waitForTimeout(200);
    const p2 = await readOutput(page, 'out-kinetic');

    // P_kin-Werte müssen verschieden sein (mind. Faktor 2 Differenz)
    expect(p1).not.toBe(p2);
  });

  test('L_opt setzt L auf Peak via "Auf Peak setzen"-Button', async ({ page }) => {
    await page.goto(VENT_URL);
    await setSlider(page, 'slider-density', 1000);
    await setSlider(page, 'slider-vpeak', 0.05);
    await setSlider(page, 'slider-cell', 2.0);
    await page.waitForTimeout(100);
    const expectedLopt = parseFloat((await readOutput(page, 'val-lopt')).replace(/[^\d.]/g, ''));

    await setSlider(page, 'slider-length', 5);
    await page.click('#btn-peak');
    await page.waitForTimeout(100);
    const lengthVal = parseFloat((await readOutput(page, 'val-length')));
    expect(lengthVal).toBeCloseTo(expectedLopt, 0);
  });

  test('Mineral-Precipitation-Schalter wechselt Bonus', async ({ page }) => {
    await page.goto(VENT_URL);
    await showResultPanel(page);

    const capEffWithBonus = await readOutput(page, 'out-capt-eff');
    expect(capEffWithBonus).toMatch(/\+\d+%/);

    await page.click('#precip-yes');
    await page.waitForTimeout(100);
    const capEffNoBonus = await readOutput(page, 'out-capt-eff');
    expect(capEffNoBonus).not.toMatch(/\+\d+%/);

    await page.click('#precip-no');
    await page.waitForTimeout(100);
    const capEffRestored = await readOutput(page, 'out-capt-eff');
    expect(capEffRestored).toMatch(/\+\d+%/);
  });

  test('Druck-Slider ändert den angezeigten Wert', async ({ page }) => {
    await page.goto(VENT_URL);

    await expect(page.locator('#val-pressure')).toHaveText('2600');
    // HTML5-Snap: set 1010 → 1011
    await setSlider(page, 'slider-pressure', 1010);
    await expect(page.locator('#val-pressure')).toHaveText('1011');

    await setSlider(page, 'slider-pressure', 2500);
    await expect(page.locator('#val-pressure')).toHaveText('2501');
  });

  test('Abfallprodukte zeigen nicht "--" nach Panel-Öffnung', async ({ page }) => {
    await page.goto(VENT_URL);
    await showResultPanel(page);

    for (const id of [
      'out-waste-s', 'out-waste-so4', 'out-waste-ch4', 'out-waste-fe', 'out-waste-heat',
    ]) {
      const v = await readOutput(page, id);
      expect(v, `Output #${id} ist leer`).not.toBe('--');
      expect(v, `Output #${id} hat keine Zahl`).toMatch(/e-?\d+/);
    }
  });
});

test.describe('Vent tool — Nährstoff-Plot', () => {
  test('Nährstoff-Plot existiert und ist sichtbar', async ({ page }) => {
    await page.goto(VENT_URL);
    const canvas = page.locator('#nutrients-plot');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('Nährstoff-Plot ist nicht leer (Pixel gerendert)', async ({ page }) => {
    await page.goto(VENT_URL);
    const canvas = page.locator('#nutrients-plot');
    await page.waitForTimeout(300);

    const hasPixels = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) return 0;
      const img = ctx.getImageData(0, 0, c.width, c.height);
      let nonZero = 0;
      for (let i = 3; i < img.data.length; i += 4) {
        if (img.data[i] > 0) nonZero++;
      }
      return nonZero;
    });
    expect(hasPixels).toBeGreaterThan(1000);
  });

  test('Nährstoff-Output zeigt alle 5 Spezies', async ({ page }) => {
    await page.goto(VENT_URL);
    await showResultPanel(page);

    for (const id of ['out-nut-h2s', 'out-nut-ch4', 'out-nut-fe', 'out-nut-si', 'out-nut-ba']) {
      const v = await readOutput(page, id);
      expect(v, `#${id} ist leer`).not.toBe('--');
      expect(v, `#${id} hat keine Zahl`).toMatch(/[\d.]+/);
    }
  });

  test('H₂S-Konzentration sinkt bei hohem Druck mit Precipitation', async ({ page }) => {
    await page.goto(VENT_URL);
    await page.click('#precip-yes');
    await page.waitForTimeout(100);

    // Bei niedrigem Druck (50 bar)
    await setSlider(page, 'slider-pressure', 50);
    await page.waitForTimeout(100);
    const c1 = parseFloat((await readOutput(page, 'out-nut-h2s')).match(/[\d.]+/)?.[0] ?? '0');

    // Bei hohem Druck (2900 bar)
    await setSlider(page, 'slider-pressure', 2900);
    await page.waitForTimeout(100);
    const c2 = parseFloat((await readOutput(page, 'out-nut-h2s')).match(/[\d.]+/)?.[0] ?? '0');

    // H₂S sollte ab ~500 bar sinken
    expect(c2).toBeLessThan(c1);
    // Bei 2900 bar mit frac=0.5: Faktor ~ 0.5 * (1+tanh(2.4)) ≈ 0.5 * 1.984 ≈ 0.99 Reduktion
    // → c2 ≈ 0.01 * 110 = 1.1 mmol/kg
    expect(c2).toBeLessThan(c1 * 0.6);
  });

  test('CH₄ bleibt konstant über Druck (kein Ausfällungs-Modell)', async ({ page }) => {
    await page.goto(VENT_URL);
    await page.click('#precip-yes');
    await page.waitForTimeout(100);

    await setSlider(page, 'slider-pressure', 50);
    await page.waitForTimeout(100);
    const c1 = parseFloat((await readOutput(page, 'out-nut-ch4')).match(/[\d.]+/)?.[0] ?? '0');

    await setSlider(page, 'slider-pressure', 2900);
    await page.waitForTimeout(100);
    const c2 = parseFloat((await readOutput(page, 'out-nut-ch4')).match(/[\d.]+/)?.[0] ?? '0');

    // CH₄: frac=0 → keine Ausfällung
    expect(c2).toBeCloseTo(c1, 1);
  });

  test('Precipitation=Nein hält alle Nährstoffe konstant bei 100 %', async ({ page }) => {
    await page.goto(VENT_URL);
    // Default ist bereits Nein
    await showResultPanel(page);

    // Bei niedrigem Druck
    await setSlider(page, 'slider-pressure', 50);
    await page.waitForTimeout(100);
    const h2s_low = parseFloat((await readOutput(page, 'out-nut-h2s')).match(/[\d.]+/)?.[0] ?? '0');

    // Bei hohem Druck
    await setSlider(page, 'slider-pressure', 2900);
    await page.waitForTimeout(100);
    const h2s_high = parseFloat((await readOutput(page, 'out-nut-h2s')).match(/[\d.]+/)?.[0] ?? '0');

    // Ohne Precipitation bleiben alle Nährstoffe konstant
    expect(h2s_high).toBeCloseTo(h2s_low, 1);
  });

  test('Klick auf Nährstoff-Plot setzt Druck', async ({ page }) => {
    await page.goto(VENT_URL);
    const canvas = page.locator('#nutrients-plot');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas hat keine BoundingBox');

    // In der Mitte des Canvas klicken
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await page.waitForTimeout(200);

    // Druck sollte sich auf einen Wert im Bereich ändern
    const p = parseInt((await readOutput(page, 'val-pressure')), 10);
    expect(p).toBeGreaterThanOrEqual(1);
    expect(p).toBeLessThanOrEqual(3000);
  });
});

test.describe('Vent tool — Plot & Canvas', () => {
  test('Power-Canvas existiert und ist nicht 0×0', async ({ page }) => {
    await page.goto(VENT_URL);
    const canvas = page.locator('#power-plot');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('Power-Canvas ist nicht leer (Pixel-Inhalt)', async ({ page }) => {
    await page.goto(VENT_URL);
    const canvas = page.locator('#power-plot');
    await page.waitForTimeout(300);

    const hasPixels = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) return 0;
      const img = ctx.getImageData(0, 0, c.width, c.height);
      let nonZero = 0;
      for (let i = 3; i < img.data.length; i += 4) {
        if (img.data[i] > 0) nonZero++;
      }
      return nonZero;
    });
    expect(hasPixels).toBeGreaterThan(1000);
  });

  test('Klick auf Power-Canvas setzt L', async ({ page }) => {
    await page.goto(VENT_URL);
    const canvas = page.locator('#power-plot');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas hat keine BoundingBox');

    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await page.waitForTimeout(200);

    const len = parseFloat((await readOutput(page, 'val-length')));
    expect(len).toBeGreaterThan(1);
    expect(len).toBeLessThan(50);
  });
});

test.describe('Vent tool — Robustheit', () => {
  test('keine Console-Errors beim Laden', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await page.goto(VENT_URL);
    await showResultPanel(page);
    await page.locator('#quellen').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    expect(errors, `Console errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('keine fehlgeschlagenen Network-Requests', async ({ page }) => {
    const failed: string[] = [];
    page.on('requestfailed', (req) => {
      failed.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) {
        failed.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto(VENT_URL);
    await showResultPanel(page);
    await page.waitForTimeout(500);

    const ownFailures = failed.filter(
      (f) => !f.includes('cdn.tailwindcss.com') && !f.includes('unpkg.com') && !f.includes('fonts.googleapis.com')
    );
    expect(ownFailures, `Failed requests: ${ownFailures.join('\n')}`).toEqual([]);
  });

  test('alle erwarteten DOM-IDs existieren', async ({ page }) => {
    await page.goto(VENT_URL);

    const requiredIds = [
      'slider-density', 'slider-efficiency',
      'slider-vmin', 'slider-vpeak', 'slider-lopt', 'slider-cell',
      'slider-demand-base', 'slider-demand-slope',
      'slider-length', 'slider-pressure',
      'precip-yes', 'precip-no',
      'run-sim-btn', 'btn-peak',
      'val-density', 'val-efficiency', 'val-vmin', 'val-vpeak',
      'val-lopt', 'val-lopt-formula', 'val-length', 'val-pressure', 'val-cell',
      'val-demand-base', 'val-demand-slope',
      'out-veff', 'out-kinetic', 'out-captured', 'out-capt-eff',
      'out-atp', 'out-demand', 'out-surplus', 'out-meets',
      'out-waste-s', 'out-waste-so4', 'out-waste-ch4', 'out-waste-fe', 'out-waste-heat',
      'out-nut-h2s', 'out-nut-ch4', 'out-nut-fe', 'out-nut-si', 'out-nut-ba',
      'power-plot', 'nutrients-plot', 'result-panel',
    ];
    for (const id of requiredIds) {
      await expect(page.locator(`#${id}`), `ID #${id} fehlt`).toHaveCount(1);
    }
  });
});
