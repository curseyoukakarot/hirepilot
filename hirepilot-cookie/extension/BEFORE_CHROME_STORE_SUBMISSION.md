# 🚀 BEFORE Chrome Web Store Submission - Final Checklist

## ⚠️ CRITICAL: Update URLs from localhost to production

### 1. Update background.js
**Change line 1:**
```javascript
// FROM:
const API_BASE = 'http://localhost:8080/api';

// TO:
const API_BASE = 'https://api.thehirepilot.com/api';
```

### 2. Update popup.bundle.js 
**Find and change these lines:**
```javascript
// FROM:
var API = "http://localhost:8080/api/linkedin/save-cookie";
var GOTRUE_URL = "http://localhost:9999";

// TO:
var API = "https://api.thehirepilot.com/api/linkedin/save-cookie";
var GOTRUE_URL = "https://api.thehirepilot.com";
```

### 3. Update manifest.json
**Remove localhost from host_permissions:**
```json
"host_permissions": [
    "https://api.thehirepilot.com/*",
    "https://*.linkedin.com/*",
    "https://linkedin.com/*"
    // REMOVE these localhost entries:
    // "http://localhost:8080/*",
    // "http://localhost:9999/*"
],
```

## 📋 Final Submission Steps
1. Make all URL changes above
2. Test extension one final time with production URLs
3. Create final zip: `HirePilot-LinkedIn-Assistant-v2.1.0-PRODUCTION.zip`
4. Submit to Chrome Web Store

## ✅ Current Testing Version
- File: `HirePilot-LinkedIn-Assistant-v2.1.0-TESTING.zip`
- Status: Ready for localhost testing
- APIs: Points to localhost:8080 and localhost:9999

## 🎯 Issues Fixed from Rejection
- ✅ Removed unused `webRequest` permission
- ✅ Removed unused `tabs` permission  
- ✅ Kept only necessary permissions: `cookies`, `storage`, `activeTab`
- ✅ Updated version to 2.1.0
- ✅ Improved extension name and description