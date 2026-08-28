import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { chromium } from 'playwright';
import { detectSite } from './detect.js';

// Ne cible que les boutons de téléchargement affichés publiquement par le
// site lui-même (le propriétaire du document a activé cette option). Si ce
// contrôle n'existe pas, on s'arrête : on ne tente aucun contournement des
// protections anti-copie.
const DOWNLOAD_TEXT = /^(download|télécharger)\b/i;

export async function downloadDocument(rawUrl, credentials, downloadDir) {
  const site = detectSite(rawUrl);
  if (!site) {
    return { ok: false, reason: 'Seuls les liens scribd.com et calameo.com sont pris en charge.' };
  }

  await fs.mkdir(downloadDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    if (site === 'scribd' && credentials?.email && credentials?.password) {
      await loginToScribd(page, credentials.email, credentials.password);
    }

    await page.goto(rawUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    const downloadControl = await findDownloadControl(page);
    if (!downloadControl) {
      return {
        ok: false,
        reason:
          "Aucun bouton de téléchargement public n'a été trouvé sur ce document. " +
          "Le propriétaire n'a pas autorisé le téléchargement, ou une connexion est requise pour le voir.",
      };
    }

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      downloadControl.click(),
    ]);

    const suggested = download.suggestedFilename() || `document-${Date.now()}.pdf`;
    const safeName = sanitizeFileName(suggested);
    const filePath = path.join(downloadDir, `${crypto.randomUUID()}-${safeName}`);
    await download.saveAs(filePath);

    return { ok: true, filePath, fileName: safeName };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function findDownloadControl(page) {
  const candidates = [
    page.getByRole('link', { name: DOWNLOAD_TEXT }),
    page.getByRole('button', { name: DOWNLOAD_TEXT }),
    page.locator('a[href*="download" i]:visible'),
    page.locator('[data-testid*="download" i]:visible'),
  ];

  for (const locator of candidates) {
    try {
      const first = locator.first();
      if ((await first.count()) > 0 && (await first.isVisible())) {
        return first;
      }
    } catch {
      // sélecteur non applicable sur cette page, on essaie le suivant
    }
  }
  return null;
}

async function loginToScribd(page, email, password) {
  await page.goto('https://www.scribd.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
}

function sanitizeFileName(name) {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 150) || `document-${Date.now()}`;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}
