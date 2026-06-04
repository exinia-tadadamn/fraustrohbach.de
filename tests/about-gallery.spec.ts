/**
 * About-Gallery E2E Tests (UI-only)
 *
 * Testet:
 *   1. Admin-Toolbar erscheint nach Login
 *   2. "+ New Folder"-Card ist nur für Admins sichtbar
 *   3. Modal "Create Album" öffnet + schließt korrekt
 *   4. File-Drop auf Album-Card erzeugt Highlight
 *   5. File-Drop auf "+ New Folder"-Card erzeugt Highlight
 *   6. Image-Drag-Start setzt opacity-40
 *   7. Toast-Funktion kann aufgerufen werden
 *   8. Album-Sortierung clientseitig (kein Firebase-Aufruf)
 *   9. Image-Cards haben draggable-Attribut für Admins
 *  10. Image-Cards sind NICHT draggable für Gäste
 *
 * Diese Tests prüfen NUR die UI-Schicht. Firestore-Schreibvorgänge
 * erfordern einen echten Firebase-Login, der hier nicht simuliert wird
 * (Custom-Token-Setup wäre möglich, aber aufwändig).
 */

import { test, expect, type Page } from '@playwright/test';

const ABOUT_URL = '/about.html';

// Admin-Session simulieren
async function loginAsAdmin(page: Page) {
  await page.goto(ABOUT_URL);
  await page.evaluate(() => sessionStorage.setItem('exinia_auth_session', 'true'));
  await page.reload();
  await expect(page.locator('#admin-toolbar')).toBeVisible();
}

async function waitForGalleryReady(page: Page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('gallery-content');
    return el && !el.classList.contains('hidden');
  }, { timeout: 10000 });
  await page.waitForTimeout(500);
}

// ============================================================================
// Tests
// ============================================================================

test.describe('About-Gallery — Admin-Toolbar', () => {
  test('Admin-Toolbar erscheint nach Login', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('#admin-toolbar')).toBeVisible();
  });

  test('Admin-Toolbar ist für Gäste versteckt', async ({ page }) => {
    await page.goto(ABOUT_URL);
    await waitForGalleryReady(page);
    await expect(page.locator('#admin-toolbar')).toBeHidden();
  });
});

test.describe('About-Gallery — "+ New Folder"-Card Sichtbarkeit', () => {
  test('Card ist nur für Admins sichtbar', async ({ page, context }) => {
    // Ohne Login: versteckt
    await page.goto(ABOUT_URL);
    await waitForGalleryReady(page);
    await expect(page.locator('#new-folder-card')).toBeHidden();

    // Mit Login: sichtbar
    const newPage = await context.newPage();
    await newPage.goto(ABOUT_URL);
    await newPage.evaluate(() => sessionStorage.setItem('exinia_auth_session', 'true'));
    await newPage.reload();
    await waitForGalleryReady(newPage);
    await expect(newPage.locator('#new-folder-card')).toBeVisible();
    await newPage.close();
  });
});

test.describe('About-Gallery — Create-Album-Modal', () => {
  test('Modal öffnet via "Create Folder"-Button', async ({ page }) => {
    await loginAsAdmin(page);
    await waitForGalleryReady(page);

    // Modal initial versteckt
    const initiallyHidden = await page.locator('#create-album-modal').evaluate((el) =>
      el.classList.contains('hidden')
    );
    expect(initiallyHidden).toBeTruthy();

    // Klick öffnet
    await page.click('button:has-text("Create Folder")');
    await page.waitForFunction(() =>
      !document.getElementById('create-album-modal').classList.contains('hidden'),
      { timeout: 3000 }
    );
    await expect(page.locator('#new-album-name')).toBeVisible();
  });

  test('Modal öffnet via Klick auf "+ New Folder"-Card', async ({ page }) => {
    await loginAsAdmin(page);
    await waitForGalleryReady(page);

    await page.locator('#new-folder-card > div').click();
    await page.waitForFunction(() =>
      !document.getElementById('create-album-modal').classList.contains('hidden'),
      { timeout: 3000 }
    );
    await expect(page.locator('#new-album-name')).toBeVisible();
  });

  test('Modal schließt via X-Button', async ({ page }) => {
    await loginAsAdmin(page);
    await waitForGalleryReady(page);
    await page.click('button:has-text("Create Folder")');
    await page.waitForFunction(() =>
      !document.getElementById('create-album-modal').classList.contains('hidden')
    );
    // X-Button im Modal (ph-x class)
    await page.locator('#create-album-modal button').filter({ has: page.locator('.ph-x') }).click();
    await page.waitForFunction(() =>
      document.getElementById('create-album-modal').classList.contains('hidden'),
      { timeout: 3000 }
    );
  });
});

test.describe('About-Gallery — Drag & Drop UX', () => {
  test('Album-Card erhält ring-Highlight bei dragover', async ({ page }) => {
    await loginAsAdmin(page);
    await waitForGalleryReady(page);

    // Mindestens ein Album muss da sein
    const albumCount = await page.locator('.folder-card[data-album-id]').count();
    if (albumCount === 0) {
      test.skip();
      return;
    }

    const firstAlbum = page.locator('.folder-card[data-album-id]').first();
    const albumId = await firstAlbum.getAttribute('data-album-id');
    await page.evaluate((id) => {
      const fakeEvent = {
        preventDefault: () => {},
        dataTransfer: { types: ['Files'], dropEffect: 'copy' },
      };
      window.albumDropHover(id, fakeEvent);
    }, albumId);
    await page.waitForTimeout(100);
    await expect(firstAlbum).toHaveClass(/ring-neon-cyan/);
  });

  test('"+ New Folder"-Card erhält ring-Highlight bei dragover', async ({ page }) => {
    await loginAsAdmin(page);
    await waitForGalleryReady(page);

    await page.waitForSelector('#new-folder-card', { state: 'attached', timeout: 5000 });
    const newCard = page.locator('#new-folder-card');
    await expect(newCard).toBeVisible();

    // Direkt die global verfügbaren Handler aufrufen
    await page.evaluate(() => {
      const fakeEvent = {
        preventDefault: () => {},
        dataTransfer: { types: ['Files'], dropEffect: 'copy' },
      };
      window.newFolderDropHover(fakeEvent);
    });
    await page.waitForTimeout(100);
    // Highlight-Klasse wird auf das äußere #new-folder-card gesetzt
    await expect(newCard).toHaveClass(/ring-neon-amber/);
  });

  test('Album-Card verliert Highlight bei dragleave', async ({ page }) => {
    await loginAsAdmin(page);
    await waitForGalleryReady(page);

    const albumCount = await page.locator('.folder-card[data-album-id]').count();
    test.skip(albumCount === 0, 'Kein Album vorhanden');

    const firstAlbum = page.locator('.folder-card[data-album-id]').first();
    const albumId = await firstAlbum.getAttribute('data-album-id');

    // Highlight setzen
    await page.evaluate((id) => {
      const fakeEvent = {
        preventDefault: () => {},
        dataTransfer: { types: ['Files'], dropEffect: 'copy' },
      };
      window.albumDropHover(id, fakeEvent);
    }, albumId);
    await page.waitForTimeout(100);
    await expect(firstAlbum).toHaveClass(/ring-neon-cyan/);

    // Highlight entfernen
    await page.evaluate((id) => {
      const fakeEvent = {
        preventDefault: () => {},
        dataTransfer: { types: ['Files'] },
      };
      window.albumDropLeave(id, fakeEvent);
    }, albumId);
    await page.waitForTimeout(100);
    const hasClass = await firstAlbum.evaluate((el) => el.className.includes('ring-neon-cyan'));
    expect(hasClass).toBeFalsy();
  });

  test('Image-Cards sind draggable für Admins', async ({ page }) => {
    await loginAsAdmin(page);
    await waitForGalleryReady(page);

    const imgCount = await page.locator('.image-card[data-image-id]').count();
    test.skip(imgCount === 0, 'Kein Bild vorhanden');

    const firstImg = page.locator('.image-card[data-image-id]').first();
    await expect(firstImg).toHaveAttribute('draggable', 'true');
  });

  test('Image-Cards sind NICHT draggable für Gäste', async ({ page }) => {
    await page.goto(ABOUT_URL);
    await waitForGalleryReady(page);

    // Falls Bilder geladen werden: ohne draggable-Attribut prüfen
    const imgCount = await page.locator('.image-card').count();
    if (imgCount === 0) test.skip();
    const firstImg = page.locator('.image-card').first();
    await expect(firstImg).not.toHaveAttribute('draggable', 'true');
  });

  test('Image-Drag-Start setzt opacity-40', async ({ page }) => {
    await loginAsAdmin(page);
    await waitForGalleryReady(page);

    const imgCount = await page.locator('.image-card[data-image-id]').count();
    test.skip(imgCount === 0, 'Kein Bild vorhanden');

    const firstImg = page.locator('.image-card[data-image-id]').first();
    await firstImg.dispatchEvent('dragstart', {
      dataTransfer: { setData: () => {}, effectAllowed: 'move' },
    });
    await expect(firstImg).toHaveClass(/opacity-40/);
  });
});

test.describe('About-Gallery — Toast-System', () => {
  test('Toast-Funktion ist global verfügbar', async ({ page }) => {
    await loginAsAdmin(page);
    await waitForGalleryReady(page);

    const exists = await page.evaluate(() => typeof window.showToast === 'function');
    expect(exists).toBeTruthy();
  });

  test('Toast-Element wird bei showToast-Aufruf erzeugt', async ({ page }) => {
    await loginAsAdmin(page);
    await waitForGalleryReady(page);

    const before = await page.locator('#gallery-toast').count();
    expect(before).toBe(0);

    await page.evaluate(() => window.showToast('Test message', 5000));
    await expect(page.locator('#gallery-toast')).toBeVisible();
    await expect(page.locator('#gallery-toast')).toContainText('Test message');
  });

  test('Toast verschwindet nach Ablauf der duration', async ({ page }) => {
    await loginAsAdmin(page);
    await waitForGalleryReady(page);

    await page.evaluate(() => window.showToast('Quick', 1000));
    await expect(page.locator('#gallery-toast')).toBeVisible();

    await page.waitForFunction(() => {
      const el = document.getElementById('gallery-toast');
      return el && el.classList.contains('opacity-0');
    }, { timeout: 3000 });
  });
});

test.describe('About-Gallery — Galerie-Initialisierung', () => {
  test('Galerie lädt ohne Auth-Fehler (Gast-Modus)', async ({ page }) => {
    await page.goto(ABOUT_URL);
    await waitForGalleryReady(page);
    // Galerie-Inhalt ist sichtbar
    await expect(page.locator('#gallery-content')).toBeVisible();
  });

  test('Filestorage-Bucket und Project-ID sind korrekt konfiguriert', async ({ page }) => {
    await page.goto(ABOUT_URL);
    const config = await page.evaluate(() => {
      const app = firebase.app();
      return {
        projectId: app.options.projectId,
        storageBucket: app.options.storageBucket,
        authDomain: app.options.authDomain,
      };
    });
    expect(config.projectId).toBe('website-7c871');
    expect(config.storageBucket).toContain('website-7c871');
  });
});

test.describe('About-Gallery — Filename-Sichtbarkeit (Besucher)', () => {
  test('Image-Cards zeigen keinen filename-Overlay (Gast)', async ({ page }) => {
    await page.goto(ABOUT_URL);
    await waitForGalleryReady(page);

    const imgCount = await page.locator('.image-card').count();
    test.skip(imgCount === 0, 'Kein Bild vorhanden');

    const firstCard = page.locator('.image-card').first();
    // Kein filename-Overlay innerhalb einer Image-Card
    const overlayCount = await firstCard.locator('p.text-\\[10px\\].font-mono.text-slate-300').count();
    expect(overlayCount).toBe(0);

    // alt-Attribut enthält keinen filename
    const alt = await firstCard.locator('img').getAttribute('alt');
    expect(alt).toBe('');
  });

  test('Image-Cards zeigen keinen filename-Overlay (Admin)', async ({ page }) => {
    await loginAsAdmin(page);
    await waitForGalleryReady(page);

    const imgCount = await page.locator('.image-card').count();
    test.skip(imgCount === 0, 'Kein Bild vorhanden');

    const firstCard = page.locator('.image-card').first();
    const overlayCount = await firstCard.locator('p.text-\\[10px\\].font-mono.text-slate-300').count();
    expect(overlayCount).toBe(0);
  });

  test('Lightbox-Viewer zeigt keinen Filename (Gast)', async ({ page }) => {
    await page.goto(ABOUT_URL);
    await waitForGalleryReady(page);

    const imgCount = await page.locator('.image-card').count();
    test.skip(imgCount === 0, 'Kein Bild vorhanden');

    await page.locator('.image-card').first().locator('img').click();
    await page.waitForFunction(() => {
      const v = document.getElementById('image-viewer');
      return v && v.style.display === 'flex';
    }, { timeout: 3000 });

    const filenameVisible = await page.locator('#viewer-filename').isVisible();
    expect(filenameVisible).toBeFalsy();
  });
});

test.describe('About-Gallery — Spacing', () => {
  test('Grids verwenden gap-6 (mobile) / gap-8 (desktop)', async ({ page }) => {
    await page.goto(ABOUT_URL);
    await waitForGalleryReady(page);

    // Tailwind: gap-6 → gap: 1.5rem (24px) auf < md; gap-8 → 2rem (32px) auf md+
    const classes = await page.locator('#uncategorized-grid').getAttribute('class');
    expect(classes).toContain('gap-6');
    expect(classes).toContain('md:gap-8');
  });
});
