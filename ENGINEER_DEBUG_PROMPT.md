# Principal Engineer Debug Request: Candidate Profile Drawer Issues

## 🚨 **Critical Issue Summary**
The candidate profile drawer in `/candidates` section is not updating contact information properly, showing stale data while the candidates list shows updated data. Additionally, persistent 404 errors are occurring in the network tab.

## 📋 **Current Behavior**
- **Candidates List**: Shows updated contact info correctly ✅
- **Profile Drawer**: Shows stale/old contact info ❌
- **Network Tab**: Shows 404 errors for `lead-activities` and other endpoints ❌
- **Backend Sync**: Working correctly (confirmed via tests) ✅

## 🔍 **Issues Identified**

### 1. **State Synchronization Problem**
- Profile drawer's `localLead` state not updating when contact info changes
- Parent component (`CandidateList`) updates correctly but drawer doesn't reflect changes
- Data inconsistency between drawer and list view

### 2. **404 API Errors**
- `lead-activities?lead_id=e0a621cb-5792-4b35-a661-486314247d42` - 404
- `Odfeaf65-a6e1-4b60-8106-1701519b7176` - 404
- These errors persist despite multiple fixes

### 3. **ID Type Confusion**
- When leads are converted to candidates, the system may be using wrong ID types
- Candidate ID vs Lead ID confusion in API calls
- Potential data integrity issues in the conversion process

## 🛠️ **Attempted Fixes**

### Fix 1: API Routing Correction
**Problem**: `LeadProfileDrawer` was hardcoded to use leads API
**Solution**: Added `entityType` prop and conditional API routing
```javascript
// Before
const apiEndpoint = `${API_BASE_URL}/leads/${localLead.id}`;

// After  
const apiEndpoint = entityType === 'candidate' 
  ? `${API_BASE_URL}/candidates/${localLead.id}`
  : `${API_BASE_URL}/leads/${localLead.id}`;
```
**Result**: ✅ API calls now go to correct endpoints

### Fix 2: State Update Callback
**Problem**: Parent component not notified of changes
**Solution**: Added `onLeadUpdated` callback
```javascript
// In saveContactField
const updatedLocalLead = { ...localLead, [field]: value };
setLocalLead(updatedLocalLead);
onLeadUpdated?.(updatedLocalLead); // Added this line
```
**Result**: ✅ Parent component receives updates

### Fix 3: Bidirectional Data Sync
**Problem**: Backend not syncing between leads and candidates tables
**Solution**: Added sync logic in both backend routes
```typescript
// In candidates.ts (PUT /api/candidates/:id)
if (data.lead_id) {
  const leadUpdate: any = {};
  if (first_name !== undefined) leadUpdate.first_name = first_name;
  // ... sync to leads table
  await supabase.from('leads').update(leadUpdate).eq('id', data.lead_id);
}

// In leads.ts (PATCH /api/leads/:id)  
// ... sync to candidates table
```
**Result**: ✅ Backend data sync working

### Fix 4: State Timing Issue
**Problem**: `fetchLatestLead` overwriting fresh updates with stale data
**Solution**: Removed unnecessary `fetchLatestLead` calls after updates
```javascript
// Before
setLocalLead(parsed);
onLeadUpdated?.(parsed);
fetchLatestLead(parsed.id); // This was overwriting with stale data

// After
setLocalLead(parsed);
onLeadUpdated?.(parsed);
// Note: Don't fetch latest lead here as it might overwrite with stale data
```
**Result**: ✅ Prevents stale data overwrite

### Fix 5: 404 Error Prevention
**Problem**: `ActivityLogSection` making API calls with invalid IDs
**Solution**: Only use `lead_id` when it exists
```javascript
// Before
const resolvedLeadId = lead?.lead_id || lead?.id;

// After
const resolvedLeadId = lead?.lead_id;
if (!resolvedLeadId) {
  setActivities([]);
  return; // Skip API call
}
```
**Result**: ❌ 404 errors still persist

## 🧪 **Testing Performed**

### 1. **Pipeline Test**
- Simulated complete data flow from backend to frontend
- All logic appears correct in isolation
- Backend sync working properly

### 2. **State Management Test**
- Verified React state update flow
- Confirmed `useEffect` dependencies
- Identified timing issues

### 3. **API Endpoint Test**
- Verified correct API routing
- Confirmed HTTP methods (PUT vs PATCH)
- Backend responses working

## 🔍 **Current Suspicions**

### 1. **Data Integrity Issues**
- Lead-to-candidate conversion process may be corrupting data
- `lead_id` references may be invalid or pointing to deleted records
- Database constraints or foreign key issues

### 2. **Race Conditions**
- Multiple API calls happening simultaneously
- State updates being overwritten by competing requests
- `useEffect` dependency array causing unexpected re-renders

### 3. **Authentication/Authorization**
- User may not have proper permissions to access certain records
- Session tokens may be invalid or expired
- CORS or credential issues

### 4. **Component Lifecycle Issues**
- `LeadProfileDrawer` may not be properly unmounting/remounting
- State not being reset between different candidates
- Memory leaks or stale closures

## 📁 **Key Files to Investigate**

### Frontend
- `frontend/src/screens/LeadProfileDrawer.jsx` (lines 110-160, 200-300, 2000+)
- `frontend/src/screens/CandidateList.jsx` (lines 200-300)
- `frontend/src/components/ActivityLogSection.jsx` (lines 25-50)

### Backend
- `backend/src/routes/candidates.ts` (PUT endpoint)
- `backend/src/routes/leads.ts` (PATCH endpoint)
- `backend/api/leadActivities.ts` (GET endpoint)

## 🎯 **Specific Questions for Principal Engineer**

1. **Data Flow**: Is there a race condition between the drawer state update and the parent component re-render?

2. **Database**: Are there any foreign key constraints or data integrity issues with the lead-to-candidate conversion?

3. **Authentication**: Could there be permission issues preventing access to certain records?

4. **Component Architecture**: Is the `LeadProfileDrawer` component properly designed to handle both leads and candidates?

5. **API Design**: Should we have separate endpoints for candidate activities instead of reusing lead-activities?

6. **State Management**: Would a more robust state management solution (Redux, Zustand) help with this synchronization issue?

## 🚀 **Immediate Debugging Steps**

1. **Add comprehensive logging** to track state changes and API calls
2. **Check database** for orphaned records or invalid foreign keys
3. **Verify authentication** tokens and user permissions
4. **Test with fresh data** to rule out data corruption
5. **Profile performance** to identify any memory leaks or infinite loops

## 📊 **Expected Outcome**
- Profile drawer shows updated contact info immediately
- No 404 errors in network tab
- Consistent data between drawer and list view
- Smooth user experience when updating candidate information

---

**Priority**: High - This affects core user functionality
**Impact**: Users cannot reliably update candidate information
**Timeline**: Needs resolution ASAP
