# 🚨 CRITICAL: Access Token Hook Setup Required

## The Problem
The 403 errors are still happening because the **Access Token Hook is not enabled** in the Supabase Dashboard. This is a required step that must be done manually.

## ✅ What We've Done So Far
1. ✅ **Backfilled user roles** - All 22 users now have roles in `app_metadata`
2. ✅ **Deployed Access Token Hook** - Function is deployed and active
3. ✅ **Fixed frontend client** - Single Supabase client instance

## 🚨 What's Missing: Enable Access Token Hook in Dashboard

### Step 1: Go to Supabase Dashboard
1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `lqcsassinqfruvpgcooo`

### Step 2: Navigate to Auth Settings
1. Go to **Authentication** → **Settings**
2. Scroll down to **Access Token Hooks** section

### Step 3: Enable the Hook
1. Click **"Add Hook"** or **"Enable"**
2. Select **"Access Token"** as the hook type
3. Set the **Function URL** to: `https://lqcsassinqfruvpgcooo.supabase.co/functions/v1/access-token`
4. Click **"Save"**

### Step 4: Test the Setup
After enabling the hook:
1. **Clear browser storage** (localStorage, sessionStorage)
2. **Log out** of the application
3. **Log back in** - this will trigger the Access Token Hook
4. **Check the browser console** for the JWT claims

## 🔍 Debug Steps

### Check JWT Claims
Open browser console and run:
```javascript
// Check current JWT
const { data: { session } } = await window.supabase.auth.getSession();
if (session) {
  const payload = JSON.parse(atob(session.access_token.split('.')[1]));
  console.log('JWT Claims:', payload);
  console.log('Role claim:', payload.role);
}
```

### Expected Result
After enabling the hook and re-logging in, you should see:
```javascript
{
  "sub": "2109baa7-7cbe-4e9b-a68c-07b2cab23a84",
  "role": "RecruitPro",  // ← This should be present
  "app_metadata": {
    "role": "RecruitPro",
    "allowed_roles": ["super_admin", "team_admin", "member", "authenticated"]
  },
  // ... other claims
}
```

## 🚨 Why This is Critical
- **Without the hook enabled**: JWTs won't have the `role` claim
- **RLS policies fail**: They check for `auth.jwt() ->> 'role'` which returns null
- **403 errors persist**: All database queries are blocked

## 📞 Next Steps
1. **Enable the Access Token Hook** in Supabase Dashboard
2. **Test with a fresh login** (clear storage first)
3. **Verify JWT contains role claim**
4. **Confirm 403 errors are resolved**

The Access Token Hook is the missing piece that will inject the role claim into JWTs, allowing RLS policies to work correctly.
