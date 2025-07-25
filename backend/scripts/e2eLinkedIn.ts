import puppeteer from 'puppeteer';
import { randomUUID } from 'crypto';

(async () => {
  let prisma: any = null;
  try {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
  } catch {
    console.warn('[e2eLinkedIn] Prisma not available – DB writes disabled');
  }

  const TEST_USER_ID = process.env.TEST_USER_ID || 'REPLACE_WITH_UUID';

  // Retrieve fresh, valid cookie if prisma available, else skip
  let cookieStr = '';
  if (prisma) {
    const cookieRow = await prisma.linkedin_cookies.findFirstOrThrow({
      where: { user_id: TEST_USER_ID, valid: true },
    });
    cookieStr = `li_at=${cookieRow.li_at}; JSESSIONID=${cookieRow.jsessionid};`;
  } else {
    const liAt = process.env.LINKEDIN_LI_AT;
    const jsid = process.env.LINKEDIN_JSESSIONID;
    if (!liAt) {
      console.error('🛑 Provide LINKEDIN_LI_AT env var when Prisma is unavailable');
      process.exit(1);
    }
    cookieStr = `li_at=${liAt};` + (jsid ? ` JSESSIONID=${jsid};` : '');
  }

  const session = randomUUID().slice(0, 8);
  const proxyHost = `${process.env.DECODO_HOST}:${process.env.DECODO_PORT}`;
  console.log('Proxy:', proxyHost);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      `--proxy-server=${proxyHost}`,
      '--proxy-bypass-list=<-loopback>',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--remote-debugging-port=9222'
    ]
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (HirePilotBot Stage)');

  // Provide proxy credentials
  await page.authenticate({
    username: process.env.DECODO_USER!,
    password: process.env.DECODO_PASS!
  });

  // Set cookies
  const cookies = cookieStr.split(';').map(pair => {
    const [name, value] = pair.trim().split('=');
    return { name, value, domain: '.linkedin.com', httpOnly: true, secure: true } as any;
  });
  // @ts-ignore
  await page.setCookie(...cookies);

  /* PROFILE ENRICHMENT */
  await page.goto('https://www.linkedin.com/in/jackson-bailey-3aa032254/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const profileHtml = await page.content();
  await prisma.puppet_jobs.create({ data: { type: 'enrich_profile', proxy_session: session, html_size: profileHtml.length, status: 'success' } });
  console.log('[Enrich] bytes:', profileHtml.length);

  /* CONNECTION REQUEST */
  const connectBtn = await page.$('button:has-text("Connect")');
  if (connectBtn) {
    await connectBtn.click();
    await page.waitForSelector('textarea[name="message"]', { timeout: 5000 });
    await page.type('textarea[name="message"]', 'Hi Jackson – testing HirePilot automation. Please ignore 😊', { delay: 25 });
    await page.click('button:has-text("Send")');
    console.log('[Invite] Sent');
    await prisma.linkedin_sent_invites.create({ data: { user_id: TEST_USER_ID, target_profile: 'jackson-bailey-3aa032254', sent_at: new Date() } });
  } else {
    console.log('[Invite] Button not found or already connected');
  }

  /* SALES NAV SCRAPE */
  const navUrl = 'https://www.linkedin.com/sales/search/people?query=(replace_query)&page=1';
  await page.goto(navUrl, { waitUntil: 'domcontentloaded' });
  const navHtml = await page.content();
  await prisma.puppet_jobs.create({ data: { type: 'sales_nav_page', proxy_session: session, html_size: navHtml.length, status: 'success' } });
  console.log('[SalesNav] bytes:', navHtml.length);

  await browser.close();
  if (prisma) await prisma.$disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
}); 