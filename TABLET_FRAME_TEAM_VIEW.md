# Tablet Frame for Team & Instructor Views

## Overview
Both the team view and instructor dashboard are now displayed within a realistic tablet frame in landscape mode to show correct dimensions as the game is normally played, rather than adapting to desktop view.

This ensures:
- **Team View**: Shows exact gameplay experience for teams
- **Instructor View**: Shows what instructors see during live game monitoring
- **Consistent Dimensions**: Both views use same tablet landscape layout (1024×768)

## Implementation

### Components Created

#### TabletFrame Component
**File**: `components/TabletFrame.tsx`

A wrapper component that creates a realistic tablet device frame with:
- **Landscape orientation**: 1024×768 pixels (iPad-like 4:3 aspect ratio)
- **Device bezel**: 24px border around screen
- **Realistic details**: Camera, power button, volume buttons, home indicator
- **Proper scaling**: Fits within desktop viewport while maintaining aspect ratio
- **3D effects**: Gradient highlights for depth
- **Status indicator**: Shows "TEAM VIEW - TABLET LANDSCAPE (1024×768)"
- **Close button**: Outside the frame for easy access

### Visual Features

1. **Device Frame**
   - Rounded corners (32px radius)
   - Gradient background (slate-800 to slate-900)
   - Shadow effects for depth

2. **Hardware Details**
   - Camera/sensor bar at top center
   - Power button on right edge
   - Volume buttons (up/down) on right edge
   - Home button indicator at bottom center
   - Corner highlights for 3D effect

3. **Screen Area**
   - Black background with 16px rounded corners
   - Inner shadow for recessed screen effect
   - Exact 1024×768 dimensions
   - Overflow hidden for contained content

4. **Info Labels**
   - Top: "TEAM VIEW - TABLET LANDSCAPE (1024×768)" with live indicator
   - Bottom: "Displaying at correct tablet dimensions • Landscape Mode"

### Integration

#### App.tsx Changes
**Lines**: 24, 1997-2011, 2011-2021

```typescript
import TabletFrame from './components/TabletFrame';

// Wrap InstructorDashboard in TabletFrame
{showInstructorDashboard && activeGame && (
    <TabletFrame onClose={() => setShowInstructorDashboard(false)}>
        <InstructorDashboard
            game={activeGame}
            onClose={() => setShowInstructorDashboard(false)}
            onSetMode={setMode}
            mode={mode}
            onOpenPlayground={(playgroundId) => {
                setShowInstructorDashboard(false);
                setViewingPlaygroundId(playgroundId);
            }}
        />
    </TabletFrame>
)}

// Wrap TeamDashboard in TabletFrame
{showTeamDashboard && activeGameId && (
    <TabletFrame onClose={() => setShowTeamDashboard(false)}>
        <TeamDashboard
            gameId={activeGameId}
            game={activeGame || undefined}
            totalMapPoints={activeGame?.points.length || 0}
            onOpenAgents={() => {}}
            onClose={() => setShowTeamDashboard(false)}
            chatHistory={chatHistory}
        />
    </TabletFrame>
)}
```

#### InstructorDashboard.tsx Changes
**Lines**: 387-388

Removed fullscreen wrapper:
```typescript
// Before:
<div className="fixed inset-0 z-[2000] bg-slate-900 text-white flex flex-col animate-in fade-in duration-300">

// After:
<div className="w-full h-full bg-slate-900 text-white flex flex-col">
```

#### TeamDashboard.tsx Changes
**Lines**: 87-88

Removed fullscreen wrapper and backdrop:
```typescript
// Before:
<div className="fixed inset-0 z-[2500] bg-slate-950/95 backdrop-blur-md...">

// After:
<div className="w-full h-full bg-slate-900 flex items-center justify-center">
```

Both dashboards now fill the tablet frame's screen area instead of taking over the entire viewport.

## Dimensions Reference

### Tablet Screen
- **Width**: 1024px
- **Height**: 768px
- **Aspect Ratio**: 4:3
- **Orientation**: Landscape

### Frame
- **Total Width**: 1072px (1024 + 48px bezel)
- **Total Height**: 816px (768 + 48px bezel)
- **Bezel Size**: 24px on all sides
- **Corner Radius**: 32px (outer), 16px (screen)
- **Max Viewport**: 95vw × 90vh (scales to fit)

### Responsive Behavior
- Frame scales proportionally to fit desktop screens
- Maintains 4:3 aspect ratio at all sizes
- Centers in viewport with padding
- Never exceeds 95% viewport width or 90% viewport height

## Why These Dimensions?

### 1024×768 (4:3 Ratio)
- Standard iPad dimensions in landscape mode
- Common tablet resolution for educational/enterprise use
- Optimal for landscape gameplay
- Matches most tablet devices used in team challenges

### Landscape Orientation
- Natural holding position for tablets during gameplay
- Better visibility for maps and task lists
- Mirrors actual team gameplay experience
- Easier collaboration when multiple team members view together

## User Experience

### Before
- Team and instructor views adapted to full desktop screen
- Dimensions didn't match actual tablet gameplay
- Difficult to preview exact gameplay experience
- No visual indication of device constraints
- Inconsistent sizing between different views

### After
- **Team View**: Shown at exact tablet dimensions (1024×768)
- **Instructor View**: Shown at exact tablet dimensions (1024×768)
- Realistic device frame provides context for both views
- Instructors and admins see exactly what teams see
- Consistent experience across all dashboard views
- Easy to understand actual device constraints

## Testing

✅ **Verify Tablet Frame - Team View**:
1. Click "Show Team Dashboard" from HUD
2. Confirm tablet frame appears centered on screen
3. Check dimensions label shows "TEAM VIEW - TABLET LANDSCAPE (1024×768)"
4. Verify content is contained within screen area

✅ **Verify Tablet Frame - Instructor View**:
1. Open game in INSTRUCTOR mode
2. Click "INSTRUCTOR DASHBOARD" button
3. Confirm tablet frame appears centered on screen
4. Check dimensions label shows "TEAM VIEW - TABLET LANDSCAPE (1024×768)"
5. Verify map, teams, and controls fit within tablet screen

✅ **Verify Scaling**:
1. Resize browser window
2. Confirm frame scales proportionally
3. Verify aspect ratio remains 4:3
4. Check frame never exceeds 95vw or 90vh

✅ **Verify Close Functionality**:
1. Click close button (outside frame, top-right)
2. Confirm team view closes
3. Verify no background clicks leak through

✅ **Verify Content Fit**:
1. Check all team dashboard elements are visible
2. Confirm scrolling works if needed
3. Verify no content is cut off
4. Test with different team data (scores, tasks, etc.)

## Future Enhancements

### Potential Features
1. **Device Selection**: Toggle between different tablet sizes (iPad, Android, etc.)
2. **Orientation Toggle**: Switch between landscape and portrait
3. **Rotation Animation**: Smooth transition when changing orientation
4. **Device Skin Options**: Different colors/styles for the frame
5. **Screenshot**: Capture team view as PNG image
6. **Side-by-Side**: Show multiple team views simultaneously

### Alternate Dimensions
- **iPad Pro**: 1366×1024 (landscape)
- **Android Tablet**: 1280×800 (landscape)
- **Surface**: 1920×1280 (landscape)
- **Portrait Mode**: 768×1024 (iPad portrait)

## Files Modified
1. **`components/TabletFrame.tsx`** - New tablet frame wrapper component
2. **`App.tsx`** - Import and wrap TeamDashboard
3. **`components/TeamDashboard.tsx`** - Remove fullscreen wrapper
4. **`TABLET_FRAME_TEAM_VIEW.md`** - This documentation

## Related Components
- `components/TeamDashboard.tsx` - Team view content
- `components/InstructorDashboard.tsx` - Instructor view (not framed)
- `components/PlayzoneGameView.tsx` - Playzone view for teams
- `App.tsx` - Main app routing and state management
