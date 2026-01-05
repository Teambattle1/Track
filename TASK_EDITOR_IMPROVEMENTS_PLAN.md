# Task Editor Improvements - Development Plan

## Executive Summary
This document outlines the implementation plan for four major improvements to the Task Editor:
1. Reorganize Location Lock feature into a dedicated "LOCK ON MAP" section
2. Add InfoTooltip components to all Activation sections
3. Implement collapsible Activation sections with visual indicators
4. Audit and mark conflicting settings between Game Settings and Task Editor

---

## TASK 1: Reorganize Location Lock Feature

### Current State
- The `isLocationLocked` feature is currently embedded within the "GPS Geofence Location" section
- Located at line ~2547 in `TaskEditor.tsx`
- Current heading: "GPS Geofence Location"
- Function: Prevents task pins from being moved/dragged on the map

### Proposed Changes
**Create a new dedicated section called "LOCK ON MAP"**

#### Visual Design
```tsx
{/* LOCK ON MAP - NEW SECTION */}
<div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 rounded-2xl border-2 border-amber-200 dark:border-amber-800">
    <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 bg-amber-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
            <Lock className="w-6 h-6" />
        </div>
        <div className="flex-1">
            <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                Lock on Map
                <InfoTooltip
                    title="Lock on Map"
                    description="Prevent this task pin from being moved or dragged on the map editor. When locked, the task location becomes fixed and cannot be accidentally repositioned."
                    example="Lock historical landmark tasks to ensure they stay at exact GPS coordinates"
                />
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Prevent this task from being moved or repositioned on the map
            </p>
        </div>
    </div>
    
    {/* Toggle Switch */}
    <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-amber-900 dark:text-amber-100">Enable Map Lock</label>
        <label className="flex items-center gap-2 cursor-pointer" onClick={() => {
            setEditedPoint({...editedPoint, isLocationLocked: !editedPoint.isLocationLocked});
        }}>
            <div className={`w-12 h-7 rounded-full transition-all ${editedPoint.isLocationLocked ? 'bg-amber-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${editedPoint.isLocationLocked ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
        </label>
    </div>
    
    {/* Status Message */}
    {editedPoint.isLocationLocked && (
        <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg p-3 mt-4">
            <p className="text-xs text-amber-900 dark:text-amber-200 font-bold flex items-center gap-2">
                <Lock className="w-4 h-4" />
                This task is locked and cannot be moved on the map
            </p>
        </div>
    )}
</div>
```

#### Changes Required
1. **Remove** lock button from GPS Geofence section (lines ~2618-2642)
2. **Create** new "Lock on Map" section before or after GPS Geofence
3. **Update** visual styling to match new section design
4. **Add** InfoTooltip for lock feature

#### File Locations
- **Primary File**: `components/TaskEditor.tsx` (lines 2520-2660)
- **Section**: ACTIVATION tab

---

## TASK 2: Add InfoTooltips to Activation Sections

### Sections Requiring InfoTooltips

#### 2.1 GPS Geofence Location
**Current**: Has InfoTooltip ✓  
**Action**: Verify and enhance if needed

#### 2.2 Proximity Trigger (Line ~2665)
**Current**: No InfoTooltip on main heading  
**Add**:
```tsx
<InfoTooltip
    title="Proximity Trigger - Discovery Mechanic"
    description="Hide this task until players physically move within a certain distance. Creates an exploration/discovery element where hidden tasks are revealed as players explore the area."
    example="Hide a secret bonus task until teams get within 50 meters, creating a treasure hunt experience"
/>
```

#### 2.3 QR Code Activation (Line ~2758)
**Current**: No InfoTooltip  
**Add**:
```tsx
<InfoTooltip
    title="QR Code Activation"
    description="Require players to scan a specific QR code to unlock this task. Perfect for location-based challenges where QR codes are placed at physical locations."
    example="Place QR codes at historical landmarks - teams must visit and scan to unlock the task"
/>
```

**Sub-fields needing tooltips**:
- QR Code String field (line ~2770)
- Download QR button explanation

#### 2.4 NFC Tag Activation (Line ~2850+)
**Current**: No InfoTooltip  
**Add**:
```tsx
<InfoTooltip
    title="NFC Tag Activation"
    description="Enable task unlocking via NFC (Near Field Communication) tags. Players tap their phone on NFC stickers/tags to unlock tasks. Perfect for indoor challenges."
    example="Place NFC tags on information boards, doors, or objects for contactless activation"
/>
```

**Sub-fields needing tooltips**:
- NFC Tag ID (unique identifier explanation)
- NFC Tag Data (optional JSON data explanation)

#### 2.5 iBeacon Activation (Line ~2900+)
**Current**: No InfoTooltip  
**Add**:
```tsx
<InfoTooltip
    title="iBeacon Activation"
    description="Unlock tasks when players enter proximity of Bluetooth LE beacons. Works with physical beacon hardware for indoor/outdoor proximity detection."
    example="Deploy beacons at checkpoints - tasks unlock automatically when teams get close"
/>
```

**Sub-fields needing tooltips**:
- iBeacon UUID (what it is and format)
- iBeacon Major/Minor (organizational hierarchy)
- Proximity Level (immediate/near/far ranges)

---

## TASK 3: Collapsible Activation Sections

### Requirements
1. All activation sections under ACTIVATION tab should be collapsible
2. Auto-collapse ALL sections by default when opening ACTIVATION tab
3. Show glowing green indicator dot when section is actively used
4. Smooth expand/collapse animations

### Implementation Strategy

#### 3.1 State Management
```tsx
// Add to TaskEditor component state (already exists for proximity)
const [expandedActivations, setExpandedActivations] = useState<Record<string, boolean>>({
    location: false,      // GPS Geofence
    lockOnMap: false,     // NEW: Lock on Map section
    proximity: false,     // Proximity Trigger
    qr: false,           // QR Code
    nfc: false,          // NFC Tag
    ibeacon: false       // iBeacon
});
```

#### 3.2 Active Indicator Logic
```tsx
// Helper function to determine if section is "active" (in use)
const isSectionActive = (section: string): boolean => {
    switch(section) {
        case 'location':
            return editedPoint.location !== null && editedPoint.activationTypes.includes('radius');
        case 'lockOnMap':
            return editedPoint.isLocationLocked === true;
        case 'proximity':
            return editedPoint.proximityTriggerEnabled === true;
        case 'qr':
            return !!editedPoint.qrCodeString && editedPoint.qrCodeString.length > 0;
        case 'nfc':
            return !!editedPoint.nfcTagId && editedPoint.nfcTagId.length > 0;
        case 'ibeacon':
            return !!editedPoint.ibeaconUUID && editedPoint.ibeaconUUID.length > 0;
        default:
            return false;
    }
};
```

#### 3.3 Visual Indicator Component
```tsx
{/* Green glowing dot when active */}
{isSectionActive('qr') && (
    <div className="relative">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
    </div>
)}
```

#### 3.4 Collapsible Header Pattern
```tsx
<button
    type="button"
    onClick={() => setExpandedActivations({...expandedActivations, qr: !expandedActivations.qr})}
    className="w-full flex items-start gap-4 text-left hover:opacity-80 transition-opacity"
>
    <div className="w-12 h-12 bg-purple-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
        <QrCode className="w-6 h-6" />
    </div>
    <div className="flex-1">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <h3 className="font-black text-sm uppercase tracking-wide">QR Code Activation</h3>
                {isSectionActive('qr') && (
                    <div className="relative">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                    </div>
                )}
                <InfoTooltip {...tooltipProps} />
            </div>
            <ChevronDown className={`w-5 h-5 text-purple-600 transition-transform ${expandedActivations.qr ? 'rotate-180' : ''}`} />
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Attach a QR code string to this task
        </p>
    </div>
</button>

{expandedActivations.qr && (
    <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
        {/* Section content here */}
    </div>
)}
```

### Sections to Convert
1. ✅ **Proximity Trigger** - Already collapsible (line 2665)
2. **GPS Geofence Location** - Add collapse (line 2520)
3. **Lock on Map** - New section, add collapse
4. **QR Code Activation** - Add collapse (line 2758)
5. **NFC Tag Activation** - Add collapse
6. **iBeacon Activation** - Add collapse

---

## TASK 4: Game Settings vs Task Editor Audit

### Conflicting/Overlapping Settings

#### 4.1 TIME LIMITS

**Game Level** (`GameTaskConfiguration`):
- `timeLimitMode`: 'none' | 'global' | 'task_specific'
- `globalTimeLimit`: number (seconds)

**Task Level** (`TaskSettings`):
- `timeLimitSeconds`: number | undefined

**Conflict Analysis**:
- If game has `timeLimitMode: 'global'`, task-level time limits should be disabled/hidden
- If game has `timeLimitMode: 'task_specific'`, show task-level controls
- If game has `timeLimitMode: 'none'`, grey out task-level time controls

**UI Solution**:
```tsx
{/* In TIMER tab of TaskEditor */}
{activeGame?.taskConfig?.timeLimitMode === 'global' && (
    <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <p className="text-xs text-yellow-900 dark:text-yellow-200 font-bold">
                Global Time Limit Active: This game uses a {activeGame.taskConfig.globalTimeLimit}s limit for ALL tasks.
                <button 
                    type="button"
                    onClick={() => onOpenGameSettings?.()}
                    className="ml-2 underline hover:text-yellow-700"
                >
                    Edit in Game Settings →
                </button>
            </p>
        </div>
    </div>
)}
```

#### 4.2 ANSWER CORRECTNESS DISPLAY

**Game Level** (`GameTaskConfiguration`):
- `showAnswerCorrectnessMode`: 'never' | 'always' | 'task_specific'

**Task Level** (`TaskSettings`):
- `showAnswerStatus`: boolean

**Conflict**: Game-level setting should override task-level when set to 'never' or 'always'

**UI Solution**: Add warning banner similar to time limits

#### 4.3 CORRECT ANSWER REVEAL

**Game Level** (`GameTaskConfiguration`):
- `showCorrectAnswerMode`: 'never' | 'always' | 'task_specific'

**Task Level** (`TaskSettings`):
- `showCorrectAnswerOnMiss`: boolean

**Conflict**: Same as above

#### 4.4 HINTS

**Game Level** (`GameTaskConfiguration`):
- `limitHints`: boolean
- `hintLimit`: number | undefined

**Task Level** (`TaskFeedback`):
- `hint`: string
- `hintCost`: number

**Conflict**: If game limits hints globally, show warning about global limit

#### 4.5 LANGUAGE

**Game Level** (`Game`):
- `language`: Language

**Task Level** (`TaskSettings`):
- `language`: string

**Potential Conflict**: Tasks might have different language than game default

**UI Solution**: Show game's default language and allow override per task

### Settings Relationship Matrix

| Setting | Game Level | Task Level | Conflict Type | Solution |
|---------|-----------|------------|---------------|----------|
| Time Limit | `timeLimitMode`, `globalTimeLimit` | `timeLimitSeconds` | Override | Disable task control if global |
| Show Correctness | `showAnswerCorrectnessMode` | `showAnswerStatus` | Override | Warning banner |
| Show Answer | `showCorrectAnswerMode` | `showCorrectAnswerOnMiss` | Override | Warning banner |
| Hints | `limitHints`, `hintLimit` | `hint`, `hintCost` | Limit | Warning if exceeds |
| Penalty | `penaltyMode` | N/A | Info | Show game's mode |
| Team Voting | `teamVotingMode` | N/A | Info | Show game's mode |
| Language | `language` | `language` | Override | Allow per-task override |

### Implementation Locations

**Files to Modify**:
1. `components/TaskEditor.tsx` - Add warning banners and conflict indicators
2. `components/GameManager.tsx` - Add conflict indicators in game settings
3. Create `components/SettingsConflictWarning.tsx` - Reusable warning component

**Warning Component**:
```tsx
interface SettingsConflictWarningProps {
    type: 'time_limit' | 'answer_correctness' | 'answer_reveal' | 'hints';
    gameValue: any;
    onNavigateToGameSettings?: () => void;
}

const SettingsConflictWarning: React.FC<SettingsConflictWarningProps> = ({
    type,
    gameValue,
    onNavigateToGameSettings
}) => {
    const messages = {
        time_limit: `Global time limit of ${gameValue}s is active for all tasks`,
        answer_correctness: `Answer correctness display is ${gameValue} for all tasks`,
        answer_reveal: `Correct answer reveal is ${gameValue} for all tasks`,
        hints: `Hint usage is limited to ${gameValue} hints per game`
    };

    return (
        <div className="bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-1">
                        Game-Level Setting Active
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                        {messages[type]}
                    </p>
                    {onNavigateToGameSettings && (
                        <button
                            type="button"
                            onClick={onNavigateToGameSettings}
                            className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                            Edit in Game Settings
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
```

---

## Implementation Checklist

### Phase 1: Lock on Map Section (2-3 hours)
- [ ] Create new "Lock on Map" section in ACTIVATION tab
- [ ] Move `isLocationLocked` toggle from GPS Geofence to new section
- [ ] Add InfoTooltip for lock feature
- [ ] Update visual styling (amber theme)
- [ ] Add collapse/expand functionality
- [ ] Add active indicator (green dot) when locked
- [ ] Test in both standard and playzone modes
- [ ] Update `README.md` documentation

### Phase 2: InfoTooltips (3-4 hours)
- [ ] Add InfoTooltip to Proximity Trigger heading
- [ ] Add InfoTooltip to QR Code Activation heading
- [ ] Add InfoTooltip to QR Code String field
- [ ] Add InfoTooltip to NFC Tag Activation heading
- [ ] Add InfoTooltip to NFC Tag ID field
- [ ] Add InfoTooltip to NFC Tag Data field
- [ ] Add InfoTooltip to iBeacon Activation heading
- [ ] Add InfoTooltip to iBeacon UUID field
- [ ] Add InfoTooltip to iBeacon Major/Minor fields
- [ ] Add InfoTooltip to iBeacon Proximity field
- [ ] Verify all tooltips display correctly
- [ ] Test tooltip positioning on mobile/tablet

### Phase 3: Collapsible Sections (4-5 hours)
- [ ] Extend `expandedActivations` state for all sections
- [ ] Create `isSectionActive()` helper function
- [ ] Convert GPS Geofence to collapsible
- [ ] Convert QR Code section to collapsible
- [ ] Convert NFC section to collapsible
- [ ] Convert iBeacon section to collapsible
- [ ] Implement green glowing indicator dot
- [ ] Add smooth expand/collapse animations
- [ ] Test auto-collapse on tab switch
- [ ] Ensure indicators update in real-time

### Phase 4: Settings Conflict Audit (5-6 hours)
- [ ] Create `SettingsConflictWarning` component
- [ ] Audit Time Limit conflicts
- [ ] Add warning banner for global time limits in TIMER tab
- [ ] Audit Answer Correctness conflicts
- [ ] Add warning for answer correctness in SETTINGS tab
- [ ] Audit Correct Answer Reveal conflicts
- [ ] Add warning for answer reveal in SETTINGS tab
- [ ] Audit Hint conflicts
- [ ] Add warning for hint limits in ANSWER tab
- [ ] Add "Edit in Game Settings" navigation buttons
- [ ] Add reverse indicators in GameManager
- [ ] Document all conflicts in ADVANCED_FEATURES_GUIDE.md
- [ ] Create settings conflict flowchart

### Phase 5: Testing & Documentation (3-4 hours)
- [ ] Test all changes in standard game mode
- [ ] Test all changes in playzone mode
- [ ] Test all changes in elimination mode
- [ ] Verify no regressions in existing features
- [ ] Test on mobile, tablet, and desktop
- [ ] Update ADVANCED_FEATURES_GUIDE.md
- [ ] Create user-facing documentation
- [ ] Add screenshots to documentation
- [ ] Code review and optimization

---

## Total Estimated Time: 17-22 hours

## Dependencies
- `InfoTooltip.tsx` component (already exists)
- `ChevronDown`, `Lock`, `Info`, `AlertTriangle` icons from lucide-react
- Access to `activeGame` prop in TaskEditor (may need to pass from parent)

## Risks & Mitigation
1. **Risk**: Breaking existing activation logic  
   **Mitigation**: Thorough testing of each activation type

2. **Risk**: State management complexity with many collapsible sections  
   **Mitigation**: Use single `expandedActivations` object, helper functions

3. **Risk**: Performance issues with many tooltips  
   **Mitigation**: Lazy render tooltip content, memoize components

4. **Risk**: Conflicting game/task settings causing confusion  
   **Mitigation**: Clear visual warnings, disable conflicting controls

---

## Success Criteria
✅ Lock on Map feature is in dedicated, clearly labeled section  
✅ All activation sections have helpful InfoTooltips  
✅ All activation sections are collapsible with green indicators  
✅ Game settings conflicts are clearly marked in both places  
✅ No regressions in existing functionality  
✅ Documentation is complete and accurate  
✅ User testing confirms improved usability
