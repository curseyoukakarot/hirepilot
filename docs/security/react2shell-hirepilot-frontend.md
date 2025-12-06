# React2Shell Notes – HirePilot Frontend

## Frontend overview
- HirePilot’s customer-facing frontend is a Vite-powered React SPA deployed on Vercel.
- The application renders fully on the client and, as of this update, uses no Next.js features and no React Server Components (no `react-server-dom-*` dependencies or custom RSC servers).

## React2Shell risk assessment
- The React2Shell (CVE-2025-55182 / CVE-2025-66478) chain targets server-side React Server Components implementations such as the Next.js App Router.
- Because this project ships only client-rendered React pages, there is no server-component surface exposed to untrusted payloads.
- Staying on the latest patched React 18 release still matters to keep shared utilities (like the JSX runtime) aligned with upstream security fixes.

## React version history

| Package     | Previous version | Current version | Notes |
| ----------- | ---------------- | --------------- | ----- |
| `react`     | `^18.2.0`        | `^18.3.1`       | Upgraded on 2025-12-06 in response to the React2Shell advisory and related React security guidance. |
| `react-dom` | `^18.2.0`        | `^18.3.1`       | Upgraded on 2025-12-06 alongside `react` to keep the renderers in sync. |

## Future checklist
- If we ever migrate this frontend to Next.js or adopt React Server Components, re-read the latest React/Next.js security advisories and re-run a React2Shell-focused review before launch.
- After every major React or tooling upgrade, rerun dependency updates (`npm install && npm run build`) and check advisories for new RSC or protocol-level fixes.
- Always redeploy the Vercel frontend after these upgrades so the patched bundle reaches production.

