/**
 * Endpoint serverless Vercel — génération PDF du rapport mandant (V2).
 *
 * Input  : POST { reportUrl: string }
 * Output : application/pdf (stream binaire)
 *
 * Utilise puppeteer-core + @sparticuz/chromium pour Vercel Node runtime.
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { reportUrl } = req.body || {};
  if (!reportUrl || typeof reportUrl !== 'string') {
    res.status(400).json({ error: 'reportUrl manquant ou invalide' });
    return;
  }

  // Sécurité basique : n'accepter que les URL du même déploiement
  try {
    const u = new URL(reportUrl);
    const host = req.headers.host || '';
    if (host && !u.host.endsWith(host.split(':')[0])) {
      // autorise localhost pendant le dev
      if (!u.host.startsWith('localhost') && !u.host.startsWith('127.0.0.1')) {
        res.status(400).json({ error: 'URL non autorisée' });
        return;
      }
    }
  } catch {
    res.status(400).json({ error: 'URL invalide' });
    return;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto(reportUrl, { waitUntil: 'networkidle0', timeout: 25000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size:8px; width:100%; padding:0 12mm; color:#999; display:flex; justify-content:space-between;">
          <span>Avis de Valeur · Document confidentiel</span>
          <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=avis-de-valeur.pdf'
    );
    res.send(pdf);
  } catch (err) {
    console.error('PDF generation failed:', err);
    res
      .status(500)
      .json({ error: 'PDF generation failed', details: err.message });
  } finally {
    if (browser) await browser.close();
  }
}
