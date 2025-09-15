# REX Pipeline Tools - Complete Test Suite

This directory contains the complete REX pipeline management tools with comprehensive testing infrastructure.

## 🎯 Overview

REX can now manage candidate pipelines with both **read** and **write** capabilities:
- **viewPipeline**: View candidates in pipeline stages with filtering
- **moveCandidateStage**: Move candidates between stages with role-based access control

## 📁 Files

### Core Tools
- `viewPipeline.ts` - Read-only pipeline data access
- `moveCandidateStage.ts` - Write access for stage management

### Testing Infrastructure
- `testPipelineTools.ts` - Comprehensive test harness (10 tests)
- `seedPipelineTestData.ts` - Test data seeding script
- `pipelineTestSchema.sql` - Complete database schema + test data
- `runPipelineTests.ts` - Automated test runner
- `viewPipelineRouting.md` - MCP routing documentation

## 🚀 Quick Start

### 1. Setup Database Schema
```sql
-- Run this in Supabase SQL Editor
-- File: tools/rex/pipelineTestSchema.sql
```

**⚠️ If you get "column stage does not exist" error:**
```sql
-- Quick fix: Run this first
-- File: tools/rex/fixStageColumn.sql
```

### 2. Run Test Suite
```bash
# Option A: Automated test runner
npx ts-node tools/rex/runPipelineTests.ts

# Option B: Manual steps
npx ts-node tools/rex/seedPipelineTestData.ts
npx ts-node tools/rex/testPipelineTools.ts
```

## 🧪 Test Coverage

### viewPipeline Tests
1. **All candidates** - Returns all candidates for a job
2. **Stage filtering** - Filters by specific pipeline stage
3. **Staleness filtering** - Finds candidates stuck in stages
4. **Name search** - Searches candidates by name
5. **Empty results** - Handles no matches gracefully

### moveCandidateStage Tests
6. **Permission denied** - Blocks unauthorized users
7. **Confirmation required** - Requires explicit confirmation
8. **Successful move** - Moves candidates between stages
9. **Verification** - Confirms moves with viewPipeline
10. **Error handling** - Handles invalid candidate IDs

## 📊 Test Data

The test suite uses realistic data:
- **Job**: Revenue Ops Role (job123)
- **Candidates**: 4 candidates with different stages
- **Stages**: Phone Screen, Interview, Technical Interview, Offer
- **Timestamps**: Various ages for staleness testing

## 🔐 Security Features

### Role-Based Access Control
- **viewPipeline**: Available to all collaborators
- **moveCandidateStage**: Restricted to team_admin, pro, RecruitPro

### Confirmation Flow
- All stage moves require explicit confirmation
- Prevents accidental candidate movements

## 🛠️ Integration

### MCP Tool Registry
Both tools are registered in `rexTools.json`:
```json
{
  "name": "viewPipeline",
  "description": "Get a structured list of candidates in each pipeline stage for a specific job with filtering options."
},
{
  "name": "moveCandidateStage", 
  "description": "Move a candidate to a different pipeline stage with role-based access control and confirmation flow."
}
```

### Backend Functions
Functions are implemented in `backend/tools/rexToolFunctions.ts`:
- `viewPipeline()` - Read pipeline data
- `moveCandidateStage()` - Update candidate stages

## 📝 Example Usage

### View Pipeline Data
```
REX, show me all candidates in the Interview stage
REX, who's been stuck in Phone Screen for 7+ days?
REX, list candidates named Alice in the pipeline
```

### Move Candidates
```
REX, move Alice Johnson to the Interview stage
REX, advance candidate cand123 into Offer
REX, update this candidate's stage to Rejected
```

## 🔧 Development

### Adding New Tests
1. Add test case to `testPipelineTools.ts`
2. Update test count in documentation
3. Run test suite to validate

### Modifying Tools
1. Update tool implementation
2. Update corresponding test cases
3. Run full test suite
4. Update documentation

## 🚨 Troubleshooting

### Common Issues
- **"column stage does not exist"**: Run `fixStageColumn.sql` first
- **Database connection**: Ensure Supabase credentials are set
- **Schema errors**: Run `pipelineTestSchema.sql` first
- **Permission errors**: Check RLS policies in Supabase
- **Test failures**: Check console output for specific errors

### Quick Fixes
```sql
-- Fix 1: Add missing stage column
ALTER TABLE candidate_jobs ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'Applied';

-- Fix 2: Update existing records
UPDATE candidate_jobs SET stage = 'Applied' WHERE stage IS NULL;
```

### Debug Mode
Enable detailed logging by setting:
```typescript
console.log('[DEBUG]', 'Your debug message');
```

## 📈 Performance

- **Query optimization**: Uses indexed columns for fast lookups
- **Pagination ready**: Can be extended for large datasets
- **Caching friendly**: Results can be cached for better performance

## 🔄 Maintenance

### Regular Tasks
- Update test data periodically
- Monitor query performance
- Review access control policies
- Update documentation

### Schema Updates
When updating the database schema:
1. Update `pipelineTestSchema.sql`
2. Update tool implementations
3. Update test cases
4. Re-run full test suite

## 📚 Documentation

- **API Reference**: See individual tool files
- **MCP Routing**: See `viewPipelineRouting.md`
- **Database Schema**: See `pipelineTestSchema.sql`
- **Test Cases**: See `testPipelineTools.ts`

---

**Status**: ✅ Production Ready  
**Last Updated**: January 2025  
**Version**: 1.0.0
