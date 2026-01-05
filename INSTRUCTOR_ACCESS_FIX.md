# INSTRUCTOR Access Fix - TeamAction v4.7

## Issue
When users logged in with the instructor code `4027`, they were incorrectly granted full EDITOR access, allowing them to modify games. The intended behavior is that INSTRUCTOR role should be strictly limited to monitoring capabilities.

## Expected Behavior
INSTRUCTOR users should:
- See the Game Manager upon login
- Upon selecting a game, only access **INSTRUCTOR VIEW** and **TEAM VIEW**
- Have no access to editing tools or EDITOR mode

## Root Cause
The bug was in `components/GameManager.tsx`. The `primaryActionForGame` function always called `onEditGame(gameId)` when a game was selected, which set the mode to EDIT regardless of the user's access level.

```typescript
// OLD CODE (BUGGY)
const primaryActionForGame = (gameId: string) => {
    if (onEditGame) {
        onEditGame(gameId);  // Always sets mode to EDIT!
    } else {
        onSelectGame(gameId);
    }
};
```

## Fixes Implemented

### 1. GameManager.tsx - Prevent INSTRUCTOR from entering EDIT mode
**File:** `components/GameManager.tsx`

Added a check to prevent INSTRUCTOR mode users from calling `onEditGame`:

```typescript
const primaryActionForGame = (gameId: string) => {
    // INSTRUCTOR mode should only select game, not enter EDIT mode
    if (mode === GameMode.INSTRUCTOR) {
        onSelectGame(gameId);
        onClose();
        return;
    }
    
    // For EDITOR mode: call onEditGame if available
    if (onEditGame) {
        onEditGame(gameId);
    } else {
        onSelectGame(gameId);
    }
};
```

### 2. ToolbarsDrawer.tsx - Restrict Mode Switching
**File:** `components/ToolbarsDrawer.tsx`

Added `userAccessMode` prop and restricted the MAPMODE section to only show mode buttons based on access level:

```typescript
interface ToolbarsDrawerProps {
    // ... other props
    userAccessMode?: 'EDITOR' | 'INSTRUCTOR' | 'TEAM' | null;
}
```

Updated MAPMODE section:
- **EDITOR button**: Only visible to users with EDITOR access
- **INSTRUCTOR button**: Visible to EDITOR and INSTRUCTOR access
- **TEAM button**: Visible to all access levels

### 3. GameHUD.tsx - Pass userAccessMode prop
**File:** `components/GameHUD.tsx`

Ensured `userAccessMode` is passed from GameHUD to ToolbarsDrawer:

```typescript
<ToolbarsDrawer
    // ... other props
    userAccessMode={userAccessMode}
/>
```

## Access Matrix

| User Access | Can Select Game | Can View EDITOR | Can View INSTRUCTOR | Can View TEAM |
|------------|----------------|-----------------|---------------------|---------------|
| EDITOR     | ✅ Yes         | ✅ Yes          | ✅ Yes              | ✅ Yes        |
| INSTRUCTOR | ✅ Yes         | ❌ No           | ✅ Yes              | ✅ Yes        |
| TEAM       | ✅ Yes         | ❌ No           | ❌ No               | ✅ Yes        |

## Login Flow for INSTRUCTOR

1. User enters code `4027` on login screen
2. `LoginPage.tsx` creates instructor user with role 'instructor'
3. Calls `onLoginSuccess(instructorUser, 'INSTRUCTOR')`
4. `App.tsx` sets:
   - `authUser` to instructor user
   - `userAccessMode` to 'INSTRUCTOR'
   - `mode` to `GameMode.INSTRUCTOR`
   - Skips landing page, shows Game Manager
5. User selects a game from Game Manager
6. `GameManager` calls `onSelectGame(gameId)` (NOT `onEditGame`)
7. Game opens in INSTRUCTOR mode
8. User can switch between INSTRUCTOR VIEW and TEAM VIEW only

## Files Modified

1. `components/GameManager.tsx` - Fixed game selection logic
2. `components/ToolbarsDrawer.tsx` - Added access restrictions to mode switcher
3. `components/GameHUD.tsx` - Pass userAccessMode prop

## Testing Checklist

- [x] Login with code `4027` → User gets INSTRUCTOR mode (not EDITOR)
- [x] Select game from Game Manager → Opens in INSTRUCTOR mode
- [x] MAPMODE section shows only INSTRUCTOR and TEAM buttons
- [x] Cannot switch to EDITOR mode from toolbar
- [x] Can switch to TEAM VIEW
- [x] Can switch back to INSTRUCTOR VIEW
- [x] No editing tools accessible

## Version
Fixed in TeamAction v4.7
