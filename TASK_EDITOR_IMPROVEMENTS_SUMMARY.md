# Task Editor Improvements - Visual Summary

## Quick Reference

### 🎯 Overview
This document provides a visual summary of the Task Editor improvements, showing before/after states and key features.

---

## 📋 Change Summary

| Change | Impact | Priority | Estimated Hours |
|--------|--------|----------|-----------------|
| 1. Lock on Map Section | High - Improves UX clarity | High | 2-3 hours |
| 2. InfoTooltips for Activation | High - Better onboarding | High | 3-4 hours |
| 3. Collapsible Sections | Medium - Reduces clutter | Medium | 4-5 hours |
| 4. Settings Conflict Audit | High - Prevents errors | High | 5-6 hours |

**Total Estimated Time**: 17-22 hours

---

## 🔄 Change 1: Lock on Map Section

### BEFORE
```
ACTIVATION TAB
├── GPS Geofence Location
│   ├── Radius Slider (10-500m)
│   ├── SELECT ON MAP button
│   └── LOCKED TO LOCATION button ← Mixed with GPS settings
```

### AFTER
```
ACTIVATION TAB
├── GPS Geofence Location
│   ├── Radius Slider (10-500m)
│   └── SELECT ON MAP button
│
├── Lock on Map ← NEW DEDICATED SECTION
│   ├── Enable Map Lock toggle
│   └── Status indicator
```

### Visual Design (New Section)
```
┌─────────────────────────────────────────────────┐
│ 🔒  LOCK ON MAP                            ⓘ   │
│                                                 │
│ Prevent this task from being moved or          │
│ repositioned on the map                         │
│                                                 │
│ Enable Map Lock              [━━━━━○]          │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ 🔒 This task is locked and cannot be    │   │
│ │    moved on the map                      │   │
│ └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 📝 Change 2: InfoTooltips for Activation Sections

### Sections Getting InfoTooltips

#### ✅ Already Has InfoTooltip
- GPS Geofence Location

#### ➕ Needs InfoTooltip (NEW)

**1. Proximity Trigger**
```tsx
ⓘ Proximity Trigger - Discovery Mechanic
   Hide this task until players physically move within 
   a certain distance. Creates exploration element.
   Example: Hide secret bonus tasks until teams get 
   within 50 meters
```

**2. QR Code Activation**
```tsx
ⓘ QR Code Activation
   Require players to scan a specific QR code to unlock
   Perfect for location-based challenges
   Example: Place QR codes at historical landmarks
```

**3. NFC Tag Activation**
```tsx
ⓘ NFC Tag Activation
   Enable task unlocking via NFC tags. Players tap phone
   on NFC stickers/tags. Perfect for indoor challenges.
   Example: Place NFC tags on information boards
```

**4. iBeacon Activation**
```tsx
ⓘ iBeacon Activation
   Unlock tasks when players enter proximity of Bluetooth
   LE beacons. Works with physical beacon hardware.
   Example: Deploy beacons at checkpoints
```

### Visual Examples

#### Before (No Tooltip)
```
┌─────────────────────────────┐
│ 🎯 QR Code Activation       │  ← No help available
│ Attach a QR code string...  │
└─────────────────────────────┘
```

#### After (With Tooltip)
```
┌─────────────────────────────┐
│ 🎯 QR Code Activation  ⓘ   │  ← Click ⓘ for help
│ Attach a QR code string...  │
│                             │
│ ┌────────────────────────┐  │
│ │ ⓘ QR Code Activation  │  │ ← Tooltip popup
│ │ Require players to... │  │
│ │ Example: Place QR...  │  │
│ └────────────────────────┘  │
└─────────────────────────────┘
```

---

## 🎛️ Change 3: Collapsible Sections with Indicators

### Auto-Collapse Behavior

**When opening ACTIVATION tab:**
- ALL sections start collapsed
- Only active sections show green glowing indicator
- Click any section header to expand

### Visual States

#### Inactive Section (Collapsed)
```
┌──────────────────────────────────────────┐
│ 🎯 QR Code Activation           ⌄       │  ← Collapsed
│ Attach a QR code string to...           │
└──────────────────────────────────────────┘
```

#### Active Section (Collapsed)
```
┌──────────────────────────────────────────┐
│ 🎯 QR Code Activation  🟢       ⌄       │  ← Green indicator
│ Attach a QR code string to...           │
└──────────────────────────────────────────┘
```

#### Active Section (Expanded)
```
┌──────────────────────────────────────────┐
│ 🎯 QR Code Activation  🟢       ⌃       │  ← Expanded
│ Attach a QR code string to...           │
├──────────────────────────────────────────┤
│ 📱 QR CODE STRING                        │
│ [HOUSE_001________________]              │
│                                          │
│ 📤 DOWNLOADABLE QR CODE                  │
│    [QR Code Image]                       │
│    [DOWNLOAD]                            │
└──────────────────────────────────────────┘
```

### Indicator Logic

| Section | Shows Green Dot When... |
|---------|-------------------------|
| GPS Geofence | Location exists AND radius activation enabled |
| Lock on Map | `isLocationLocked === true` |
| Proximity Trigger | `proximityTriggerEnabled === true` |
| QR Code | `qrCodeString` has value |
| NFC Tag | `nfcTagId` has value |
| iBeacon | `ibeaconUUID` has value |

### Animation
- Smooth 200ms transition on expand/collapse
- Chevron rotates 180° when expanding
- Content fades in with slide animation
- Green indicator pulses continuously

---

## ⚠️ Change 4: Settings Conflict Warnings

### Conflict Scenarios

#### Scenario 1: Global Time Limit Active

**In Task Editor TIMER Tab:**
```
┌─────────────────────────────────────────────┐
│ ⚠️ GLOBAL TIME LIMIT ACTIVE                 │
│                                             │
│ This game uses a 300s limit for ALL tasks. │
│ Task-specific time limits are disabled.     │
│                                             │
│ [Edit in Game Settings →]                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ ⏱️ Time Limit                               │
│ Duration (Seconds)                          │
│ [∞ (No limit)________] ← DISABLED           │
└─────────────────────────────────────────────┘
```

**In Game Settings:**
```
┌─────────────────────────────────────────────┐
│ ℹ️ TIME LIMIT CONFIGURATION                 │
│                                             │
│ Mode: [●] Global  [ ] Task-Specific         │
│ Global Limit: [300] seconds                 │
│                                             │
│ ⚠️ This setting affects ALL tasks in game   │
│    Individual task time limits disabled     │
└─────────────────────────────────────────────┘
```

#### Scenario 2: Answer Correctness Override

**In Task Editor SETTINGS Tab:**
```
┌─────────────────────────────────────────────┐
│ ℹ️ ANSWER CORRECTNESS DISPLAY               │
│                                             │
│ Game-level setting: "Always Show"          │
│ This task will always show answer status    │
│                                             │
│ [Edit in Game Settings →]                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Show Answer Status                          │
│ [✓] Enabled ← FORCED BY GAME SETTING        │
└─────────────────────────────────────────────┘
```

### Warning Banner Component Design

```tsx
// Type 1: Game Setting Overrides Task Setting
┌─────────────────────────────────────────────┐
│ 🔵 GAME-LEVEL SETTING ACTIVE                │
│                                             │
│ [Setting description and impact]            │
│ [Edit in Game Settings →]                   │
└─────────────────────────────────────────────┘

// Type 2: Task Setting Conflicts with Game
┌─────────────────────────────────────────────┐
│ ⚠️ POTENTIAL CONFLICT                       │
│                                             │
│ [Conflict description]                      │
│ [View Game Settings →]                      │
└─────────────────────────────────────────────┘

// Type 3: Informational (No Conflict)
┌─────────────────────────────────────────────┐
│ ℹ️ RELATED GAME SETTING                     │
│                                             │
│ [Related setting info]                      │
│ [View Game Settings →]                      │
└─────────────────────────────────────────────┘
```

---

## 📊 Settings Conflict Matrix

### Complete Relationship Map

| Task Setting | Game Setting | Conflict? | Behavior |
|-------------|--------------|-----------|----------|
| **Time Limit** | | | |
| `timeLimitSeconds` | `timeLimitMode: 'global'` | ⚠️ YES | Task control disabled |
| `timeLimitSeconds` | `timeLimitMode: 'task_specific'` | ✅ NO | Task control enabled |
| `timeLimitSeconds` | `timeLimitMode: 'none'` | ℹ️ INFO | Task control shown but grayed |
| `scoreDependsOnSpeed` | `timeLimitMode: 'none'` | ⚠️ YES | Warning: needs time limit |
| **Answer Display** | | | |
| `showAnswerStatus` | `showAnswerCorrectnessMode: 'always'` | ⚠️ YES | Forced enabled |
| `showAnswerStatus` | `showAnswerCorrectnessMode: 'never'` | ⚠️ YES | Forced disabled |
| `showAnswerStatus` | `showAnswerCorrectnessMode: 'task_specific'` | ✅ NO | Task control enabled |
| **Correct Answer** | | | |
| `showCorrectAnswerOnMiss` | `showCorrectAnswerMode: 'always'` | ⚠️ YES | Forced enabled |
| `showCorrectAnswerOnMiss` | `showCorrectAnswerMode: 'never'` | ⚠️ YES | Forced disabled |
| `showCorrectAnswerOnMiss` | `showCorrectAnswerMode: 'task_specific'` | ✅ NO | Task control enabled |
| **Hints** | | | |
| `hint`, `hintCost` | `limitHints: true` | ℹ️ INFO | Show global limit warning |
| `hint`, `hintCost` | `limitHints: false` | ✅ NO | No restriction |
| **Other** | | | |
| `language` | Game `language` | ℹ️ INFO | Can override per task |
| N/A | `penaltyMode` | ℹ️ INFO | Show game's penalty mode |
| N/A | `teamVotingMode` | ℹ️ INFO | Show game's voting mode |

**Legend:**
- ⚠️ YES = Conflict requiring warning/disable
- ✅ NO = No conflict, task setting works independently
- ℹ️ INFO = Related setting, show info banner

---

## 🎨 Visual Design Tokens

### Color Scheme by Section

| Section | Primary Color | Use Case |
|---------|---------------|----------|
| Lock on Map | Amber (#f59e0b) | New dedicated section |
| GPS Geofence | Green (#10b981) | Location-based |
| Proximity | Cyan (#06b6d4) | Discovery mechanic |
| QR Code | Purple (#8b5cf6) | Scan-based |
| NFC Tag | Green (#10b981) | Touch-based |
| iBeacon | Blue (#3b82f6) | Bluetooth-based |

### Indicator States

```css
/* Active Indicator - Glowing Green Dot */
.active-indicator {
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.active-indicator::after {
  content: '';
  position: absolute;
  inset: 0;
  background: #22c55e;
  border-radius: 50%;
  animation: ping 2s infinite;
}
```

### Warning Banner Colors

```css
/* Game Setting Active (Blue) */
.warning-game-active {
  background: #dbeafe;
  border: 2px solid #93c5fd;
  color: #1e3a8a;
}

/* Conflict Warning (Yellow) */
.warning-conflict {
  background: #fef3c7;
  border: 2px solid #fcd34d;
  color: #78350f;
}

/* Error/Override (Red) */
.warning-error {
  background: #fee2e2;
  border: 2px solid #fca5a5;
  color: #7f1d1d;
}
```

---

## 🧪 Testing Checklist

### Functional Testing

#### Lock on Map Section
- [ ] Toggle works correctly
- [ ] Status message updates
- [ ] Pin cannot be dragged when locked
- [ ] Pin can be dragged when unlocked
- [ ] Lock state persists on save
- [ ] Works in both standard and playzone modes

#### InfoTooltips
- [ ] All tooltips render correctly
- [ ] Click opens tooltip
- [ ] Click outside closes tooltip
- [ ] Tooltip content is readable
- [ ] Examples are helpful
- [ ] Mobile: tooltips don't overflow screen

#### Collapsible Sections
- [ ] All sections start collapsed
- [ ] Click header expands/collapses
- [ ] Chevron rotates correctly
- [ ] Animation is smooth
- [ ] Green indicator shows when active
- [ ] Indicator updates in real-time
- [ ] State persists during editor session

#### Settings Conflicts
- [ ] Warning shows for global time limit
- [ ] Task controls disabled when overridden
- [ ] "Edit in Game Settings" navigates correctly
- [ ] Warning shows for answer correctness
- [ ] Warning shows for answer reveal
- [ ] Info banner shows for hints
- [ ] All warnings display correct game values

### Visual Testing
- [ ] Colors match design tokens
- [ ] Spacing is consistent
- [ ] Icons align properly
- [ ] Text is readable
- [ ] Dark mode looks good
- [ ] Mobile responsive
- [ ] Tablet responsive

### Integration Testing
- [ ] No regressions in existing features
- [ ] Activation types still work
- [ ] Task saving works correctly
- [ ] Game settings sync works
- [ ] Multi-user editing (if applicable)

### Performance Testing
- [ ] Editor loads quickly
- [ ] No lag when toggling sections
- [ ] Tooltips render fast
- [ ] Memory usage acceptable

---

## 📚 Documentation Updates Required

### Files to Update

1. **ADVANCED_FEATURES_GUIDE.md**
   - Add "Lock on Map" section
   - Update Activation section with new visuals
   - Add Settings Conflict section

2. **README.md**
   - Update feature list
   - Add screenshots

3. **QUICK_START_REFERENCE.md**
   - Add Lock on Map quick reference
   - Update Activation quick reference

4. **New File: SETTINGS_CONFLICTS.md**
   - Complete conflict documentation
   - Flowcharts for each scenario
   - Troubleshooting guide

### Screenshots Needed
1. Lock on Map section (collapsed)
2. Lock on Map section (expanded, locked)
3. Activation tab with all sections collapsed
4. Activation tab with green indicators
5. InfoTooltip examples (3-4 different sections)
6. Warning banner examples (all 3 types)
7. Game Settings page with indicators

---

## 🚀 Deployment Plan

### Phase 1: Development (Weeks 1-2)
- Implement Lock on Map section
- Add all InfoTooltips
- Implement collapsible sections
- Complete settings audit

### Phase 2: Testing (Week 3)
- Internal QA testing
- Fix bugs
- Performance optimization
- Documentation completion

### Phase 3: Beta (Week 4)
- Limited user testing
- Gather feedback
- Make refinements

### Phase 4: Production (Week 5)
- Full rollout
- Monitor for issues
- Support users

---

## 📞 Support & Questions

For questions about this implementation plan, contact the development team or refer to:
- Main Plan: `TASK_EDITOR_IMPROVEMENTS_PLAN.md`
- Technical Docs: `ADVANCED_FEATURES_GUIDE.md`
- Code Comments: See inline documentation in `components/TaskEditor.tsx`
