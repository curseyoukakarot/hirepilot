import { BrowserContext, Cookie, Page } from 'playwright';
import { startBrowser, newContext } from '../browser/provider';

// Reuse your battle-tested helpers:
// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import {
  openPost,
  expandAllComments,
  openReactionsDrawer,
  extractProfilesFromComments,
  extractProfilesFromReactions,
  humanPacingSleep,
  searchKeywordAndOpenRecentPost
} from './helpers';

export type LIAuth = { li_at: string; jsession?: string };

export class LinkedInClient {
  private context!: BrowserContext;
  private page!: Page;

  async init(auth: LIAuth) {
    const browser = await startBrowser();
    const expires = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
    const cookies: Cookie[] = [
      { name: 'li_at', value: auth.li_at, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax', expires },
    ];
    if (auth.jsession) cookies.push({ name: 'JSESSIONID', value: auth.jsession, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax', expires });
    this.context = await newContext(browser, { cookies });
    this.page = await this.context.newPage();
  }

  async gotoPost(url: string) {
    await openPost(this.page, url);
    await expandAllComments(this.page);
    await openReactionsDrawer(this.page);
  }

  async searchKeyword(keyword: string) {
    await searchKeywordAndOpenRecentPost(this.page, keyword);
    await expandAllComments(this.page);
  }

  async collectProfiles(limit: number) {
    const out: Array<{ name: string; linkedin_url: string }> = [];
    const fromComments = await extractProfilesFromComments(this.page, limit);
    out.push(...fromComments);
    if (out.length < limit) {
      const fromReactions = await extractProfilesFromReactions(this.page, limit - out.length);
      out.push(...fromReactions);
    }
    return out.slice(0, limit);
  }

  async sleep(ms: number) { await humanPacingSleep(this.page, ms); }
  async cleanup() { try { await this.context?.browser()?.close(); } catch {} }
}


