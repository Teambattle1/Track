# Playzone Template Position Preservation

## Critical Requirement
Tasks imported from playzone templates MUST maintain their exact positions as designed in the source template. Positions are not randomized or spread out - they are preserved exactly as the designer intended.

## Implementation

### Task Position Metadata
Tasks in playzones store their positions in two properties (GamePoint interface):

1. **`playgroundPosition?: { x: number; y: number }`** - Legacy shared position
2. **`devicePositions?: Record<DeviceType, { x: number; y: number }>`** - Device-specific positions (mobile, tablet, desktop)

Both properties are preserved during template import to maintain exact layout across all devices.

### Template Import Logic
**File**: `components/PlaygroundEditor.tsx` (Lines 1144-1180)

```typescript
const handleImportTemplate = (template: PlaygroundTemplate) => {
    // ... ID generation ...
    
    // CRITICAL: Import all tasks from template with EXACT SAME POSITIONS
    // DO NOT modify positions - they are carefully designed in the template
    const newTasks: GamePoint[] = (template.tasks || []).map((task, index) => {
        const uniqueId = `task-${baseTimestamp}-${index}-${Math.random().toString(36).substr(2, 9)}`;

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
}
```

### Template Saving
**File**: `services/db.ts` (Lines 1178-1226)

Templates are saved to Supabase with the complete task data:
```typescript
export const savePlaygroundTemplate = async (template: PlaygroundTemplate) => {
    await supabase.from('playground_library').upsert({
        id: template.id,
        title: template.title,
        is_global: template.isGlobal,
        data: template, // Complete template with all task properties
        updated_at: new Date().toISOString()
    });
}
```

The entire `template` object is stored, which includes:
- `playgroundData`: Playground configuration
- `tasks`: Array of GamePoint objects with positions

## Position Flow

### 1. Template Creation
1. Designer arranges tasks in Playground Editor
2. Each task's position is stored in `playgroundPosition` and/or `devicePositions`
3. Template is saved with exact positions

### 2. Template Import
1. Template is loaded from database
2. New playground ID is generated
3. Each task gets:
   - New unique ID (to prevent conflicts)
   - Same playground ID (links to new playground)
   - **EXACT SAME positions** (playgroundPosition and devicePositions copied verbatim)
4. Tasks appear exactly where designer placed them

### 3. Multi-Device Support
- If task has `devicePositions`, those override `playgroundPosition` per device
- Mobile, tablet, and desktop can have different layouts
- All device-specific positions are preserved during import

## Logging & Verification

Enhanced logging confirms position preservation:

```typescript
console.log('[PlaygroundEditor] Importing task "Task Name":', {
    hasPlaygroundPosition: true,
    playgroundPosition: { x: 120, y: 340 },
    hasDevicePositions: true,
    devicePositions: {
        mobile: { x: 50, y: 100 },
        tablet: { x: 100, y: 200 },
        desktop: { x: 120, y: 340 }
    }
});

console.log('[PlaygroundEditor] Created playground and tasks:', {
    playgroundId: 'pg-1234567890-abc123',
    taskCount: 25,
    positionsPreserved: true,
    sampleTaskPosition: { x: 120, y: 340 },
    sampleDevicePositions: { mobile: {...}, tablet: {...}, desktop: {...} }
});
```

## Testing Checklist

✅ **Verify Position Preservation**:
1. Create a playzone with tasks arranged in specific pattern
2. Save as template
3. Import template to new game
4. Confirm all tasks appear in EXACT same positions
5. Check on multiple devices (mobile/tablet/desktop) if device-specific layouts exist

✅ **Verify Device-Specific Layouts**:
1. Create template with different layouts per device
2. Import template
3. Switch between devices in Playground Editor
4. Confirm each device shows correct layout

✅ **Verify ID Uniqueness**:
1. Import same template multiple times
2. Check console for no duplicate ID warnings
3. Verify each import creates unique task IDs

## Known Properties
- **Legacy**: `playgroundPosition` - Used when all devices share same layout
- **New**: `devicePositions` - Used for device-specific layouts (mobile, tablet, desktop)
- **Fallback**: If neither property exists, task defaults to position (0, 0)

## DO NOT
- ❌ DO NOT apply spiral placement to playzone templates
- ❌ DO NOT modify positions during import
- ❌ DO NOT center or randomize task positions
- ❌ DO NOT apply any offset or transformation to positions

## Related Files
- `components/PlaygroundEditor.tsx` - Template import logic
- `services/db.ts` - Template save/load
- `types.ts` - GamePoint and PlaygroundTemplate interfaces
