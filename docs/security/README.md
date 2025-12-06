# HirePilot Security Notes

## Backend location and scope
- HirePilot’s backend/API (Express workers, cron jobs, etc.) runs on Railway, separate from the Vercel-hosted frontend.
- React2Shell targets React Server Components implementations (e.g., Next.js App Router or custom RSC servers). The Railway backend is not running React or the RSC protocol, so it is outside the direct blast radius.

## Operational guidance
- If suspicious activity is reported, review backend logs for unusual POST bodies, long-running function invocations, or payloads that look like serialized React trees.
- Rotate database credentials, third-party API keys, OAuth secrets, and signing keys whenever compromise is suspected.
- Confirm no new React/RSC-specific parsing or deserialization code paths have been introduced on the backend before deploying major changes.

## Backend TODOs (tracked in Railway repo)
1. Review backend logs around **2025-12-03 onward** for anomalous traffic or timeouts.
2. Ensure no React Server Components or React-specific deserialization logic have been added to backend routes or workers.

