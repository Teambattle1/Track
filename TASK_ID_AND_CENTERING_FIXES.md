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

### TASK 2: Tasks Must Preserve Exact Template Positions
**Problem**: Initial fix incorrectly applied spiral placement to playzone templates, but user requires exact position preservation from template design.

**Root Cause**:
Misunderstanding of requirements - playzone templates are carefully designed layouts that must be preserved exactly, not randomized or spread out.

**Fix Applied**:
**`components/PlaygroundEditor.tsx`** (Line 1144-1180):
- **REMOVED** spiral placement algorithm
- **PRESERVED** exact positions from template using `playgroundPosition` and `devicePositions`
- Tasks now appear exactly where the designer placed them in the template
- Both legacy shared positions and device-specific positions are maintained
- Implementation:
  ```typescript
  const newTasks: GamePoint[] = (template.tasks || []).map((task, index) => {
      // PRESERVE EXACT POSITIONS from template (both legacy and device-specific)
      const preservedPosition = task.playgroundPosition ? { ...task.playgroundPosition } : undefined;
      const preservedDevicePositions = task.devicePositions ? { ...task.devicePositions } : undefined;

      return {
          ...task,
          id: uniqueId,
          playgroundId: newPlaygroundId,
          playgroundPosition: preservedPosition, // EXACT position from template
          devicePositions: preservedDevicePositions, // EXACT device-specific positions
          order: index,
          isCompleted: false,
          isUnlocked: true
      };
  });
  ```

## Testing Recommendations

1. **Test TASK 1 Fix**:
   - Add a playzone template to an existing game
   - Check browser console for duplicate key warnings
   - Verify no `Encountered two children with the same key` errors
   - Confirm all task IDs are unique in the game data

2. **Test TASK 2 Fix**:
   - Import "TEAMCHALLENGE 2.0" template to a game
   - Verify tasks appear in EXACT same positions as in the template
   - Confirm NO tasks are centered, spread, or randomized
   - Check that layout matches original template design perfectly
   - Test on multiple devices to verify device-specific positions are preserved

## Console Output

The fixes include enhanced logging:
- `[PlaygroundEditor] Created playground and tasks:` now includes `appliedSpiralPlacement: true`
- `[PlaygroundEditor] ✅ Template imported successfully with spiral placement`
- Task IDs are now logged to verify uniqueness

## Related Files
- `services/ai.ts` - AI task ID generation
- `components/PlaygroundEditor.tsx` - Template import and task rendering
- `components/AiTaskGenerator.tsx` - AI task generation UI (uses ai.ts service)
