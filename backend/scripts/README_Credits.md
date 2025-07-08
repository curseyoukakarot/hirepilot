# Credit System - Backfill & Management

## Overview

The HirePilot credit system assigns credits to users based on their role:

- **member**: 350 credits
- **admin**: 1000 credits  
- **team_admin**: 5000 credits (shared with up to 4 team members)
- **RecruitPro**: 1000 credits
- **super_admin**: 10000 credits

## For New Users

New users automatically get credits assigned based on their role through a database trigger when they sign up.

## For Existing Users (Backfill)

Existing users need to be backfilled with credits. You have two options:

### Option 1: Admin Interface (Recommended)

1. Go to the Admin User Management page
2. Click the **"Backfill Credits"** button
3. Confirm the operation
4. The system will process all users and show a summary

### Option 2: Manual Script

Run the backfill script manually:

```bash
cd backend
npm run ts-node scripts/backfillUserCredits.ts
```

Or with npx:

```bash
cd backend
npx ts-node scripts/backfillUserCredits.ts
```

## What the Backfill Does

1. **Identifies users without credits**: Finds all users in the `users` table who don't have a record in `user_credits`
2. **Assigns role-based credits**: Allocates credits based on the user's role
3. **Logs the allocation**: Creates entries in `credit_usage_log` for tracking
4. **Avoids duplicates**: Won't overwrite existing credit records
5. **Provides summary**: Shows results of the operation

## Team Admin Credit Sharing

Team admins (role: `team_admin`) can share their 5000 credits with up to 4 team members:

- Team members use the team admin's credit pool if they don't have their own credits
- Usage is logged under the team admin's account
- API endpoints available at `/api/credits/team-members`

## Verification

After backfill, verify credits were assigned:

```sql
-- Check total users with credits
SELECT COUNT(*) as users_with_credits FROM user_credits;

-- Check credits by role
SELECT u.role, uc.total_credits, COUNT(*) as user_count
FROM users u
JOIN user_credits uc ON u.id = uc.user_id
GROUP BY u.role, uc.total_credits
ORDER BY u.role;
```

## Troubleshooting

If users still don't see credits on the billing page:

1. **Check user_credits table**: Verify the user has a record
2. **Check API response**: Test `/api/billing/overview` endpoint
3. **Clear cache**: Have user refresh their browser
4. **Check logs**: Look for errors in credit allocation

## Environment Requirements

Make sure these environment variables are set:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
``` 