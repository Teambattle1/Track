# Task ID and Centering Fixes

## Issues Fixed

### TASK 1: Duplicate Task IDs When Adding Playzone
**Problem**: Console showed duplicate React keys like `ai-1767644047664-0`, `ai-1767644047664-1`, etc. when adding playzones to existing games.

**Root Cause**:
1. AI-generated tasks were using `Date.now()` for ID generation, which gave the same timestamp to all tasks in a batch
2. Template import was also using `Date.now()` for all tasks, creating potential collisions
3. React was rendering tasks multiple times in the action mapping without explicit unique keys

**Fixes Applied**:
1. **`services/ai.ts`** (Line 190-215):
   - Added unique random suffix to AI task IDs: `ai-${baseTimestamp}-${index}-${randomSuffix}`
   - Each task now gets a truly unique ID even when generated in the same millisecond

2. **`components/PlaygroundEditor.tsx`** (Line 1129-1171):
   - Added unique random suffix to template task IDs
   - Used a base timestamp for the batch and added random suffix per task
   - ID format: `task-${baseTimestamp}-${index}-${random()}`

3. **`components/PlaygroundEditor.tsx`** (Lines 5258-5291):
   - Added explicit unique keys to all action `.map()` calls
   - Wrapped rendered items in divs with composite keys including action index
   - Format: `${targetTask.id}-nested-${sourceTask.id}-${actionType}-${actionIndex}`

### TASK 2: Tasks Centering When Importing Templates
**Problem**: When importing templates like "TEAMCHALLENGE 2.0", all tasks appeared stacked in the center of the playzone instead of being spread out.

**Root Cause**:
Template tasks were imported with their original positions (usually centered at 0,0), without applying any spacing logic.

**Fix Applied**:
**`components/PlaygroundEditor.tsx`** (Line 1144-1189):
- Implemented spiral placement algorithm for playzone template imports
- Tasks are now arranged in concentric circles with 80px spacing
- First task at center (0,0)
- Subsequent tasks spread in rings of 6 tasks each
- Algorithm:
  ```typescript
  const getPlayzoneOffset = (index: number): { x: number; y: number } => {
      if (index === 0) return { x: 0, y: 0 };
      const radiusPixels = 80;
      const tasksPerRing = 6;
      const ring = Math.floor((index - 1) / tasksPerRing) + 1;
      const posInRing = (index - 1) % tasksPerRing;
      const angle = (posInRing / tasksPerRing) * 2 * Math.PI;
      const offsetPixels = radiusPixels * ring;
      return {
          x: offsetPixels * Math.cos(angle),
          y: offsetPixels * Math.sin(angle)
      };
  };
  ```

## Testing Recommendations

1. **Test TASK 1 Fix**:
   - Add a playzone template to an existing game
   - Check browser console for duplicate key warnings
   - Verify no `Encountered two children with the same key` errors
   - Confirm all task IDs are unique in the game data

2. **Test TASK 2 Fix**:
   - Import "TEAMCHALLENGE 2.0" template to a game
   - Verify tasks are spread out in a spiral pattern
   - Confirm spacing is approximately 80px between adjacent tasks
   - Check that first task is at center and others radiate outward

## Console Output

The fixes include enhanced logging:
- `[PlaygroundEditor] Created playground and tasks:` now includes `appliedSpiralPlacement: true`
- `[PlaygroundEditor] ✅ Template imported successfully with spiral placement`
- Task IDs are now logged to verify uniqueness

## Related Files
- `services/ai.ts` - AI task ID generation
- `components/PlaygroundEditor.tsx` - Template import and task rendering
- `components/AiTaskGenerator.tsx` - AI task generation UI (uses ai.ts service)
