import 'dotenv/config';
import { fetchSalesNavJson } from '../services/linkedin/playwrightFetcher';

/**
 * Quick ad-hoc runner to verify that Playwright + LinkedIn session cookies can
 * pull Sales Navigator JSON results through the Decodo residential proxy.
 *
 * Required ENV vars (export before running):
 *  FULL_COOKIE        – full `document.cookie` string copied from Chrome DevTools.
 *  API_URL            – the exact Sales-Nav XHR URL (salesApiLeadSearch or salesApiPeopleSearch).
 *  CSRF_TOKEN         – digits after `ajax:` in the JSESSIONID cookie.
 *
 * Proxy vars (already used by backend):
 *  DECODO_HOST, DECODO_PORT, DECODO_USER, DECODO_PASS
 *
 * Usage:
 *   npx ts-node backend/scripts/testSalesNavPlaywright.ts
 */

(async () => {
  const fullCookie = process.env.FULL_COOKIE || `li_sugr=d1a83cea-0fe4-40aa-ba76-caaef080eca5; bcookie="v=2&e18e2669-187a-4bef-891c-e4441bc34318"; aam_uuid=14682191225434458542797223635036293980; _gcl_au=1.1.5673813.1751828647; JSESSIONID="ajax:7800495894513966410"; timezone=America/Chicago; li_theme=light; li_theme_set=app; bitmovin_analytics_uuid=83628e57-78bb-41d5-b5c8-ab6b23b587e7; AMCV_14215E3D5995C57C0A495C55%40AdobeOrg=-637568504%7CMCIDTS%7C20293%7CMCMID%7C14904174231065529812746794656562460823%7CMCAAMLH-1753908810%7C9%7CMCAAMB-1753908810%7C6G1ynYcLPuiQxYZrsz_pkqfLG9yMXBpb2zX5dvJdYQJzPXImdj0y%7CMCOPTOUT-1753311210s%7CNONE%7CvVersion%7C5.1.1; liap=true; s_fid=74E52A2C8A8A75CB-19E9327E057415CD; gpv_pn=www.linkedin.com%2Fmessaging%2Fthread%2Fid-redacted%3D%3D%2F; s_ips=1041; s_tp=1041; s_tslv=1753327061536; sdui_ver=sdui-flagship:0.1.9465+sdui-flagship.production; UserMatchHistory=AQJlMk1j2j4M_wAAAZhdSqH5Nbd79qoVDAHZQsI17mOSGGP2ev0p4rFz0LwE9Dn39R_0t8PhLS6bKw; AnalyticsSyncHistory=AQITDJBCM3pKYgAAAZhdSqH5bJDgA4nqw46oVQEoxomlPkQ0PrGrS5FM48ksy6WyjtKyXUu4aVgPlnr_MY6CCQ; lms_ads=AQE7-58tIC6uvwAAAZhdSqLbyN_qw28fm4ZVSBs3j71og33bJ1TwCJeIEunLZ6QS5tzlAbu6JQ2uwQKFOyYc7wAwdRQaiYGw; lms_analytics=AQE7-58tIC6uvwAAAZhdSqLbyN_qw28fm4ZVSBs3j71og33bJ1TwCJeIEunLZ6QS5tzlAbu6JQ2uwQKFOyYc7wAwdRQaiYGw; PLAY_LANG=en; lang=v=2&lang=en-US; lidc="b=OB45:s=O:r=O:a=O:p=O:g=5523:u=1727:x=1:i=1753998854:t=1754060942:v=2:sig=AQFtI62oaANzYz9TYCgw8tWlM7wrDM-M"`;
  const apiUrl = process.env.API_URL;
  const csrf = process.env.CSRF_TOKEN;

  if (!fullCookie || !apiUrl || !csrf) {
    console.error('Missing FULL_COOKIE, API_URL or CSRF_TOKEN env vars');
    process.exit(1);
  }

  try {
    console.log('[Test] Fetching Sales Navigator JSON via Playwright...');
    const { status, json } = await fetchSalesNavJson({
      apiUrl,
      fullCookie,
      csrfToken: csrf
    });

    console.log('HTTP status', status);
    console.log('Top-level keys:', Object.keys(json));
    if (Array.isArray(json.elements)) {
      console.log('Elements length:', json.elements.length);
      console.log('First element sample:', JSON.stringify(json.elements[0], null, 2));
    } else {
      console.log('No elements array in response');
    }
  } catch (err) {
    console.error('Playwright fetch failed:', err);
    process.exit(1);
  }
})();
