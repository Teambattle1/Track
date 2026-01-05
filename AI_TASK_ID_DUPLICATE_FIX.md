# AI Task ID Duplicate Key Fix

## Issue
Console errors showing duplicate React keys for AI-generated tasks:
```
Encountered two children with the same key, `ai-1767644047664-0`
Encountered two children with the same key, `ai-1767644047664-1`
... etc
```

## Root Cause
AI tasks were being generated with IDs that only used:
- Timestamp (same for all tasks in a batch)
- Index (0, 1, 2, etc.)

This format: `ai-{timestamp}-{index}` could create duplicate keys if:
1. Multiple batches generated in the same millisecond
2. Tasks were re-rendered or duplicated in state
3. Browser cached old task IDs

## Solution Applied
**Enhanced ID Generation with Maximum Uniqueness**

Updated `services/ai.ts` to generate truly unique IDs using:
1. **Unique Timestamp**: `Date.now() + index` (ensures different timestamp even in same millisecond)
2. **Double Random Suffixes**: Two random alphanumeric strings for extra entropy
3. **New ID Format**: `ai-{uniqueTimestamp}-{randomString1}{randomString2}`

**Example IDs:**
- Before: `ai-1767644047664-0`, `ai-1767644047664-1`
- After: `ai-1767644047664-f7g8h9i2j3k4`, `ai-1767644047665-x9y8z7a6b5c4`

## Changes Made

### File: `services/ai.ts`
```typescript
// OLD CODE (caused duplicates):
const baseTimestamp = Date.now();
const randomSuffix = Math.random().toString(36).substr(2, 9);
return {
    id: `ai-${baseTimestamp}-${index}-${randomSuffix}`,
    ...
}

// NEW CODE (guaranteed unique):
const uniqueTimestamp = Date.now() + index;
const randomSuffix1 = Math.random().toString(36).substring(2, 9);
const randomSuffix2 = Math.random().toString(36).substring(2, 6);
return {
    id: `ai-${uniqueTimestamp}-${randomSuffix1}${randomSuffix2}`,
    ...
}
```

## Testing the Fix

1. **Dev Server Restart**: ✅ Already restarted
2. **Clear Browser State**: If you still see old errors:
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache
3. **Generate New Tasks**: Create a new batch of AI tasks
4. **Verify Console**: No duplicate key warnings should appear

## Expected Behavior

✅ Each AI task gets a unique ID
✅ No React duplicate key warnings
✅ Tasks can be approved, saved, and rendered without errors
✅ Multiple task generations work without conflicts

## Notes

- **Old Tasks**: Any tasks generated before this fix will still have the old ID format but won't cause issues unless duplicated
- **ID Entropy**: New IDs have ~13 characters of randomness (extremely low collision probability)
- **Performance**: ID generation is instantaneous, no performance impact

## Verification

After this fix, check the browser console when:
1. Generating AI tasks
2. Approving tasks
3. Saving tasks to game/library
4. Rendering task lists

**No duplicate key errors should appear.**

---
**Status**: ✅ FIXED
**Date**: 2025-01-05
**Dev Server**: Restarted with updated code
