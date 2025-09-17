# JWT Role Injection Deployment Guide

This guide fixes the Universal 403s by ensuring all Supabase JWTs include a top-level `role` claim.

## 🎯 Problem Solved
- **Sessions persist** after OAuth redirects
- **JWTs contain role information** for RLS policies
- **403s eliminated** for all user roles
- **No RLS policy rewrites needed**

## 📋 Deployment Steps

### Step 1: Backfill User Roles
```bash
cd backend
npx ts-node scripts/backfillUserRoles.ts
```

This populates `app_metadata.role` for all existing users.

### Step 2: Deploy Access Token Hook
```bash
# Deploy the edge function
supabase functions deploy access-token --no-verify-jwt

# Verify deployment
supabase functions list
```

### Step 3: Enable Access Token Hook
1. Go to **Supabase Dashboard** → **Auth** → **Settings**
2. Find **Access Token Hooks** section
3. Set **URL** to: `https://your-project.supabase.co/functions/v1/access-token`
4. **Save** settings

### Step 4: Apply RLS Migration
Run in **Supabase SQL Editor**:
```sql
-- Apply the migration
-- Copy contents from: backend/migrations/20250124_simple_rls_with_role_claim.sql
```

### Step 5: Test the Fix
1. **Log out** and **log back in** (to get new JWT with role)
2. **Open browser console** and run:
```javascript
// Test session
window.supabase.auth.getSession().then(r => 
  console.log('Session:', r.data.session)
);

// Test role claim
window.supabase.auth.getUser().then(r => 
  console.log('Role from app_metadata:', r.data.user?.app_metadata?.role)
);

// Test RLS
window.supabase.from('job_requisitions').select('id, title').limit(3)
  .then(r => console.log('Jobs query result:', r));
```

### Step 6: Run Validation Script
```bash
cd frontend
npx tsx scripts/validateJWTClaims.ts
```

## ✅ Expected Results

### After Step 1 (Backfill):
- All users have `app_metadata.role` populated
- Console shows: "Updated user X → role: Y"

### After Step 2-3 (Access Token Hook):
- New logins get JWTs with top-level `role` claim
- RLS policies can access `role` directly

### After Step 4 (RLS Migration):
- Policies use `(current_setting('request.jwt.claims', true)::json ->> 'role')`
- No more drilling into `app_metadata` or `user_metadata`

### After Step 5-6 (Testing):
- Sessions persist after login
- JWT contains role information
- RLS queries return data (no 403s)
- All user roles work correctly

## 🔧 Troubleshooting

### If Access Token Hook fails:
- Check function logs: `supabase functions logs access-token`
- Verify environment variables are set
- Ensure function is deployed and enabled

### If RLS still returns 403s:
- Verify users logged out/in after hook deployment
- Check JWT claims in browser dev tools
- Test with SQL: `SET LOCAL request.jwt.claims = '{"role":"super_admin"}';`

### If sessions don't persist:
- Ensure email confirmation is disabled
- Check `detectSessionInUrl: true` in client config
- Clear browser storage and try again

## 🎉 Success Indicators

- ✅ No "Multiple GoTrueClient instances" warnings
- ✅ Sessions persist after OAuth redirects  
- ✅ JWT contains `role` claim at top level
- ✅ RLS queries return data for all user roles
- ✅ No 403 permission denied errors
