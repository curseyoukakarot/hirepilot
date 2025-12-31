/**
 * Debug helper: resolve a user's team context using the same logic as the API handlers.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ts-node backend/scripts/debugTeamContext.ts <userId>
 *
 * Notes:
 * - This uses the service-role client, so it can run outside the app with env vars set.
 * - It will best-effort backfill `users.team_id` / `team_members` when inferred.
 */

import { getUserTeamContext } from '../api/team/teamContext';

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Missing <userId>');
    process.exit(1);
  }
  const ctx = await getUserTeamContext(userId);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(ctx, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


