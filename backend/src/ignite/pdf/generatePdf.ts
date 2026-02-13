import { chromium } from 'playwright';

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1275, height: 1650 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
