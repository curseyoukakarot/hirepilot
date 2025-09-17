# Quick Fix for Universal 403s

## 🎯 Current Status
✅ **RLS policies are correctly set up** - they're looking for `role` in JWT claims  
✅ **Frontend build is fixed** - no more syntax errors  
❌ **JWTs don't have role claims** - this is why you're getting 403s  

## 🚀 Quick Fix Steps

### Step 1: Backfill User Roles (5 minutes)
```bash
cd backend
npx ts-node scripts/backfillUserRoles.ts
```

This adds `app_metadata.role` to all users.

### Step 2: Deploy Access Token Hook (10 minutes)
```bash
# Deploy the function
supabase functions deploy access-token --no-verify-jwt

# Check it's deployed
supabase functions list
```

### Step 3: Enable the Hook (2 minutes)
1. Go to **Supabase Dashboard** → **Auth** → **Settings**
2. Find **Access Token Hooks** 
3. Set URL to: `https://your-project.supabase.co/functions/v1/access-token`
4. **Save**

### Step 4: Test the Fix (2 minutes)
1. **Log out** and **log back in** (to get new JWT with role)
2. **Open browser console** and run:
```javascript
// Check if role is in JWT
window.supabase.auth.getUser().then(r => 
  console.log('Role:', r.data.user?.app_metadata?.role)
);

// Test RLS
window.supabase.from('job_requisitions').select('id, title').limit(3)
  .then(r => console.log('Jobs:', r));
```

## ✅ Expected Results
- **No 403 errors** - RLS policies can read the `role` claim
- **Sessions persist** - users stay logged in
- **All user roles work** - super_admin, recruitpro, etc.

## 🔧 If Still Getting 403s
1. **Check JWT claims** in browser dev tools → Network → Supabase requests
2. **Verify Access Token Hook** is enabled and working
3. **Test with SQL** - run `test_current_rls.sql` in Supabase SQL Editor

The RLS policies are already correct - you just need the JWT role injection! 🎉
