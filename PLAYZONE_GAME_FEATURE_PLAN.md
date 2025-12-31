# 🎮 PLAYZONE GAME FEATURE - COMPREHENSIVE PLAN

## EXECUTIVE SUMMARY
Create a new "Playzone Game" mode that enables indoor, touch-based gameplay using only playgrounds (no GPS/map navigation). This mode is designed for teams playing on the same screen/device without GPS-based location tracking.

---

## 1. FEATURE OVERVIEW

### What is a Playzone Game?
- **Indoor-only gameplay** with touch interactions on a single screen
- **Playground-based** (not GPS/map-based)
- **No navigation required** - fixed playgrounds only
- **Team-based access** with QR code scanning or team name entry
- **No team lobby** - direct game access from team login screen
- **QR task activation** works (along with NFC, iBeacon, Click methods)
- **GPS activations are hidden and disabled** in this mode

### Key Characteristics
✅ Single device, full team plays together  
✅ Can navigate between multiple playgrounds using if/then logic  
✅ Countdown timer visible at top of playzone screen  
✅ All game features work except GPS-based tasks  
✅ Simple team access: "SCAN QR" or "TYPE TEAM NAME"  

---

## 2. ARCHITECTURE & DATA MODEL

### 2.1 Game Type Extension
Add a new field to the `Game` interface (types.ts):
```typescript
interface Game {
  // ... existing fields ...
  
  // NEW: Game Mode Configuration
  gameMode?: 'standard' | 'playzone'; // 'standard' = GPS-based, 'playzone' = playground-only
}
```

### 2.2 What Gets Changed by Game Mode
| Feature | Standard Game | Playzone Game |
|---------|---------------|---------------|
| Map view | ✅ Visible | ❌ Hidden |
| GPS navigation | ✅ Enabled | ❌ Disabled |
| Playgrounds | Optional | ✅ Required |
| GPS-based tasks | ✅ Visible | ❌ Hidden/Disabled |
| QR/NFC/iBeacon/Click | ✅ Yes | ✅ Yes |
| Team Lobby | ✅ Yes | ❌ Simple QR/Name entry |
| Meeting point | ✅ Yes | ❌ Disabled |
| Countdown timer | ✅ Optional | ✅ Always visible |

---

## 3. IMPLEMENTATION BREAKDOWN

### 3.1 LANDING PAGE & CREATE MENU
**File**: `components/InitialLanding.tsx`

**Changes**:
1. Add new "PLAYZONE GAME" button to the CREATE menu (renderCreateMenu)
2. New action: `'CREATE_PLAYZONE_GAME'` in the action types
3. Style with appropriate icon and gradient (similar to existing buttons)

**Implementation**:
```
- Update InitialLandingProps to include CREATE_PLAYZONE_GAME action
- Add MapPinButton with icon (Globe or Indoor/Building icon)
- Gradient: emerald/teal theme  
- onClick={() => onAction('CREATE_PLAYZONE_GAME')}
```

---

### 3.2 GAME CREATOR - MODE SELECTION
**File**: `components/GameCreator.tsx`

**Changes**:
1. Add a "Game Mode" selection step at the beginning (before entering game name)
2. Two radio buttons: "Standard Game (GPS-based)" or "Playzone Game (Indoor, Playground-based)"
3. Show/hide fields based on game mode
4. When mode is selected, set `game.gameMode` accordingly

**Implementation Details**:
- Add game mode selection UI at top of form
- Store selected mode in component state
- When creating game, include gameMode in game object
- Conditionally render fields:
  - Hide "defaultMapStyle" selection for playzone
  - Show warning: "Playzone games use playgrounds only. GPS locations will be disabled."
  - For playzone: require at least one playground to be added

---

### 3.3 TASK EDITOR - HIDE GPS ACTIVATIONS
**File**: `components/TaskEditor.tsx`

**Changes**:
1. Accept game context or `gameMode` prop to TaskEditor
2. In ACTIVATION tab:
   - Hide "radius (GPS)" activation checkbox when gameMode === 'playzone'
   - Disable/prevent GPS activation method from being selected
   - Show info: "GPS activations are not supported in Playzone Games"
3. When validating task: ensure GPS is not enabled for playzone mode

**Implementation**:
- Add optional `gameMode` prop to TaskEditor
- Conditional rendering: `{gameMode !== 'playzone' && <GPSSection />}`
- Validation: if gameMode is playzone, remove 'radius' from activationTypes

---

### 3.4 GAME MANAGER - PLAYGROUND NAVIGATION & TIMER
**File**: `components/GameManager.tsx`

**Changes**:
1. When `game.gameMode === 'playzone'`:
   - Hide map view completely
   - Show only available playgrounds as the main interaction area
   - Hide navigation/GPS UI elements
   - Hide meeting point features

2. Playground navigation:
   - Keep existing if/then logic for transitioning between playgrounds
   - Ensure tasks can link to other playgrounds

3. Countdown timer:
   - Always visible at top of screen for playzone games
   - Integrated with game timer config
   - Accessible even when switching playgrounds

**Implementation**:
```typescript
// In GameManager render:
if (activeGame?.gameMode === 'playzone') {
  return (
    <div>
      {/* Countdown Timer at top */}
      <CountdownTimer />
      
      {/* Playground Screen (no map) */}
      <PlaygroundScreen activePlayground={...} />
      
      {/* Playground Navigation (if/then) */}
      <PlaygroundNavigation />
    </div>
  );
}
```

---

### 3.5 TEAM LOBBY REPLACEMENT - SIMPLE QR/NAME LOGIN
**File**: `components/TeamLobbyPanel.tsx` (or new component)

**Changes**:
For playzone games ONLY, replace TeamLobbyPanel with a simple login screen:

**New Component**: `PlayzoneGameEntry.tsx`
- Two input methods:
  1. **"SCAN QR CODE"** button - opens device camera for QR scanning
  2. **"ENTER TEAM NAME"** text input - free-form team name entry
- Submit button to join game
- No team creation/lobby functionality
- Simplified, full-screen design

**Implementation**:
- Check `game.gameMode === 'playzone'` before showing TeamLobby
- If playzone, show PlayzoneGameEntry instead
- On successful entry, start game directly (no lobby wait)

---

### 3.6 GAME FLOW MODIFICATIONS
**File**: `components/GameManager.tsx` (or game flow orchestrator)

**Changes**:
1. **Team Access**:
   - Standard game: Show TeamLobbyPanel
   - Playzone game: Show PlayzoneGameEntry (QR or team name)

2. **Game Start**:
   - Standard: Team lobby → Game starts when instructor confirms
   - Playzone: QR/name entry → Game starts immediately

3. **Map & Navigation**:
   - Standard: Show map, use GPS
   - Playzone: Hide map, use playgrounds only

4. **Playground Switching**:
   - Allow if/then rules to navigate between playgrounds
   - Display current playground on screen
   - Show available tasks for current playground

---

### 3.7 TASK VISIBILITY & FILTERING
**File**: `components/GameManager.tsx` + task rendering

**Changes**:
1. When displaying tasks in playzone mode:
   - Filter out tasks with GPS activation
   - Only show tasks for current playground
   - Show tasks with: QR, NFC, iBeacon, Click, or Playground activations

2. When adding tasks to playzone game:
   - Hide/warn about GPS-only tasks
   - Allow selection only of non-GPS tasks

**Implementation**:
```typescript
const getPlayzoneSuitableTasks = (points: GamePoint[], gameMode?: string) => {
  if (gameMode !== 'playzone') return points;
  
  return points.filter(point => {
    // Exclude if ONLY has GPS and no other activations
    const hasNonGpsActivation = point.activationTypes?.some(
      type => type !== 'radius'
    );
    return hasNonGpsActivation;
  });
};
```

---

### 3.8 GAME POINTS VALIDATION
**File**: `components/App.tsx` or game creation logic

**Changes**:
When creating/saving a playzone game:
1. Validate that all points don't rely on GPS
2. Remove 'radius' activation from all points
3. Ensure playgrounds array is populated
4. Warn if game has no suitable tasks

**Implementation**:
```typescript
const validatePlayzoneGame = (game: Game) => {
  if (game.gameMode !== 'playzone') return true;
  
  // Check playgrounds
  if (!game.playgrounds || game.playgrounds.length === 0) {
    throw new Error('Playzone games require at least one playground');
  }
  
  // Remove GPS activations
  game.points.forEach(point => {
    if (point.activationTypes) {
      point.activationTypes = point.activationTypes.filter(type => type !== 'radius');
    }
  });
  
  return true;
};
```

---

## 4. FILE MODIFICATIONS SUMMARY

### Files to Modify:
1. **types.ts**
   - Add `gameMode?: 'standard' | 'playzone'` to Game interface

2. **components/InitialLanding.tsx**
   - Add CREATE_PLAYZONE_GAME action type
   - Add new MapPinButton in renderCreateMenu()

3. **components/GameCreator.tsx**
   - Add game mode selection UI at top
   - Conditionally hide/show fields based on mode
   - Pass gameMode to game creation

4. **components/TaskEditor.tsx**
   - Add gameMode prop
   - Hide GPS activation section for playzone mode
   - Prevent GPS selection in playzone

5. **components/GameManager.tsx**
   - Conditionally show map/playground based on gameMode
   - Always show countdown timer for playzone
   - Support playground-only navigation

6. **components/TeamLobbyPanel.tsx** OR **Create: PlayzoneGameEntry.tsx**
   - Check gameMode and show appropriate entry screen
   - Implement QR scanning + team name entry

7. **components/App.tsx**
   - Handle CREATE_PLAYZONE_GAME action
   - Add validation for playzone games
   - Route to GameCreator with playzone mode

8. **services/db.ts** (optional)
   - Add validation before saving playzone games

---

## 5. UI/UX CONSIDERATIONS

### Playzone Game Entry Screen
```
┌─────────────────────────────────┐
│   PLAYZONE GAME                 │
│                                 │
│  [SCAN QR CODE] button          │
│                                 │
│  OR                             │
│                                 │
│  Team Name: [____________]      │
│  [JOIN GAME]                    │
└─────────────────────────────────┘
```

### Playzone Game Screen
```
┌──── 05:32 ────────────────────┐  ← Countdown timer always visible
│  PLAYGROUND: Indoor Activity  │
│                               │
│   [Task 1] [Task 2] [Task 3]  │
│                               │
│   [Next Playground] (if/then) │
└───────────────────────────────┘
```

---

## 6. FEATURE CHECKLIST

### Phase 1: Core Setup
- [ ] Add gameMode to Game interface
- [ ] Add CREATE_PLAYZONE_GAME to landing page
- [ ] Create game mode selection in GameCreator
- [ ] Add gameMode parameter to game creation flow

### Phase 2: Task Management
- [ ] Hide GPS activation in TaskEditor for playzone
- [ ] Filter GPS tasks from playzone games
- [ ] Validate playzone games have suitable tasks

### Phase 3: Game Flow
- [ ] Create PlayzoneGameEntry component
- [ ] Implement QR scanning
- [ ] Implement team name entry
- [ ] Remove team lobby for playzone games

### Phase 4: Game UI
- [ ] Hide map for playzone games
- [ ] Show only playgrounds
- [ ] Ensure timer is always visible
- [ ] Support playground navigation

### Phase 5: Testing & Polish
- [ ] Test playzone game creation
- [ ] Test team entry (QR + name)
- [ ] Test task filtering
- [ ] Test playground navigation
- [ ] Verify all non-GPS game features work
- [ ] Verify GPS tasks are disabled

---

## 7. EDGE CASES & CONSIDERATIONS

### Edge Case 1: Converting Existing Game to Playzone
- Ensure graceful handling if gameMode is undefined (default to 'standard')
- Warn user if converting standard → playzone removes GPS tasks

### Edge Case 2: Mixed Activation Tasks
- If a task has GPS + QR: keep it, just disable GPS for this game mode
- Filter out tasks that ONLY have GPS activation

### Edge Case 3: Playground Navigation Loop Prevention
- Ensure if/then rules don't create infinite loops
- Test playground switching thoroughly

### Edge Case 4: No Playgrounds Added
- Prevent game creation if gameMode is playzone but no playgrounds
- Show clear error message

### Edge Case 5: Timer Configuration
- Ensure countdown timer works with playzone games
- Test with various timer configs

---

## 8. TESTING STRATEGY

### Unit Tests
- Test gameMode filtering logic
- Test GPS activation filtering
- Test playzone game validation

### Integration Tests
- Create playzone game with multiple playgrounds
- Add tasks to playzone game
- Test team entry (QR + name)
- Test task execution in playzone
- Test playground navigation

### User Acceptance Tests
- Create playzone game end-to-end
- Play as team (QR entry + name entry)
- Verify all features work except GPS
- Verify countdown timer always visible
- Verify playground switching

---

## 9. ROLLOUT PLAN

### Phase 1: Implementation (Week 1)
- Core gameMode field
- Landing page button
- GameCreator mode selection

### Phase 2: Task Management (Week 1-2)
- TaskEditor GPS hiding
- Task filtering
- Validation

### Phase 3: Game Flow (Week 2)
- PlayzoneGameEntry component
- QR scanning integration
- Team lobby replacement

### Phase 4: UI Polish (Week 2-3)
- Timer integration
- Playground navigation
- Map hiding
- Final styling

### Phase 5: Testing & Launch (Week 3-4)
- Comprehensive testing
- User feedback
- Bug fixes
- Production deployment

---

## 10. SUCCESS CRITERIA

✅ Playzone games can be created from landing page  
✅ Game mode selection is clear and intuitive  
✅ GPS activations are hidden/disabled in playzone mode  
✅ Team entry works with QR code scanning  
✅ Team entry works with team name text input  
✅ No map view for playzone games  
✅ Countdown timer always visible  
✅ Playground navigation works via if/then logic  
✅ All other game features work normally  
✅ No GPS-only tasks appear in playzone games  
✅ Existing standard games are unaffected  

---

## 11. TECHNICAL DEBT & FUTURE ENHANCEMENTS

### Potential Improvements
- Landscape/portrait orientation lock per playground
- Background music/audio for playgrounds
- Multi-device playzone games (future)
- Playzone game templates/library
- Analytics for playzone gameplay

### Technical Improvements
- Extract game mode logic to constants/utils
- Create reusable playground renderer
- Separate playzone from standard game components
- Add type guards for gameMode

---

## END OF PLAN

**Status**: 🟡 **READY FOR IMPLEMENTATION**  
**Estimated Effort**: 3-4 weeks  
**Complexity**: Medium-High  
**Risk Level**: Low (builds on existing features)  

