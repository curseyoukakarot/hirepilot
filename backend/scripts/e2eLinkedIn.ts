import puppeteer from 'puppeteer';
// @ts-ignore - optional dev dependency available in runtime env
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

async function main() {
  const prisma = new PrismaClient();
  const TEST_USER_ID = process.env.TEST_USER_ID || 'REPLACE_WITH_UUID';

  // Retrieve fresh, valid cookie
  const cookieRow = await prisma.linkedin_cookies.findFirstOrThrow({
    where: { user_id: TEST_USER_ID, valid: true },
  });

  const cookieStr = `li_at=${cookieRow.li_at}; JSESSIONID=${cookieRow.jsessionid};`;

  const session = randomUUID().slice(0, 8);

  // Build proxy URL directly from env vars (no %SESSION% replacement needed)
  const proxyUrl = `http://${process.env.DECODO_USER}:${process.env.DECODO_PASS}` +
    `@${process.env.DECODO_HOST}:${process.env.DECODO_PORT}`;

  console.log('Proxy:', proxyUrl);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [`--proxy-server=${proxyUrl}`],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (HirePilotBot Stage)');

  // Set cookies
  const cookies = cookieStr.split(';').map(pair => {
    const [name, value] = pair.trim().split('=');
    return { name, value, domain: '.linkedin.com', httpOnly: true, secure: true } as any;
  });
  // @ts-ignore – puppeteer types accept spread array
  await page.setCookie(...cookies);

  /* 1️⃣  PROFILE ENRICHMENT */
  await page.goto('https://www.linkedin.com/in/jackson-bailey-3aa032254/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  const profileHtml = await page.content();
  await prisma.puppet_jobs.create({
    data: {
      type: 'enrich_profile',
      proxy_session: session,
      html_size: profileHtml.length,
      status: 'success',
    },
  });
  console.log('[Enrich] bytes:', profileHtml.length);

  /* 2️⃣  CONNECTION REQUEST */
  const connectBtn = await page.$('button:has-text("Connect")');
  if (connectBtn) {
    await connectBtn.click();
    await page.waitForSelector('textarea[name="message"]', { timeout: 5000 });
    await page.type('textarea[name="message"]', 'Hi Jackson – testing HirePilot automation. Please ignore 😊', { delay: 25 });
    await page.click('button:has-text("Send")');
    console.log('[Invite] Sent');
    await prisma.linkedin_sent_invites.create({
      data: {
        user_id: TEST_USER_ID,
        target_profile: 'jackson-bailey-3aa032254',
        sent_at: new Date(),
      },
    });
  } else {
    console.log('[Invite] Button not found or already connected');
  }

  /* 3️⃣  SALES NAV SCRAPE */
  const navUrl = 'https://www.linkedin.com/sales/search/people?query=(replace_query)&page=1';
  await page.goto(navUrl, { waitUntil: 'domcontentloaded' });
  const navHtml = await page.content();
  await prisma.puppet_jobs.create({
    data: {
      type: 'sales_nav_page',
      proxy_session: session,
      html_size: navHtml.length,
      status: 'success',
    },
  });
  console.log('[SalesNav] bytes:', navHtml.length);

  await browser.close();
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 