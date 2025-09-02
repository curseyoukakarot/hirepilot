#!/usr/bin/env ts-node
import dotenv from 'dotenv';
dotenv.config();

import { PlaywrightConnectionService } from '../services/linkedin/playwrightConnectionService';

async function main() {
  const profileUrl = process.argv[2] || process.env.PROFILE_URL;
  const message = (process.argv[3] ?? process.env.MESSAGE ?? '').trim();
  const fullCookie = process.env.LINKEDIN_COOKIE; // e.g., 'li_at=...; JSESSIONID=...;'

  if (!profileUrl || !profileUrl.includes('linkedin.com/in/')) {
    console.error('Missing or invalid PROFILE URL. Pass as first arg or set PROFILE_URL env.');
    process.exit(1);
  }

  if (!fullCookie) {
    console.error('Missing LINKEDIN_COOKIE env. Expected something like: li_at=...; JSESSIONID=...;');
    process.exit(1);
  }

  if (!process.env.BROWSERLESS_TOKEN) {
    console.error('Missing BROWSERLESS_TOKEN env.');
    process.exit(1);
  }

  const userId = process.env.TEST_USER_ID || 'local-test-user';
  const jobId = `local-${Date.now()}`;

  console.log(`[Run] Connecting to ${profileUrl} with ${message ? 'a message' : 'no message'}...`);

  const result = await PlaywrightConnectionService.sendConnectionRequest({
    profileUrl,
    message,
    fullCookie,
    userId,
    jobId
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});


