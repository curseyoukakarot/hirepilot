// Run: ts-node backend/services/linkedin-remote/dev/e2e.ts
import fetch from 'node-fetch';

const USER_ID = process.env.TEST_USER_ID!;
async function main() {
  let r = await fetch('http://localhost:8080/linkedin/session/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-id': USER_ID },
    body: JSON.stringify({ streamMode: 'novnc' })
  });
  const { sessionId, streamUrl } = await r.json() as any;
  console.log('Open streamUrl in browser, login:', streamUrl);

  process.stdin.resume();
  console.log('Press Enter once logged in...');
  await new Promise(res => process.stdin.once('data', res));

  r = await fetch('http://localhost:8080/linkedin/session/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-id': USER_ID },
    body: JSON.stringify({ sessionId })
  });
  console.log('Complete ->', await r.json());

  console.log('Now enqueue send_connection in your app with sessionId');
}
main().catch(e => { console.error(e); process.exit(1); });


