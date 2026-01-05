# Task Editor Improvements - Quick Start Implementation Guide

> **Quick Reference**: Step-by-step guide for developers implementing the Task Editor improvements

---

## 🎯 Prerequisites

Before starting:
- [ ] Read `TASK_EDITOR_IMPROVEMENTS_PLAN.md` (full specification)
- [ ] Read `TASK_EDITOR_IMPROVEMENTS_SUMMARY.md` (visual guide)
- [ ] Familiarize yourself with `components/TaskEditor.tsx`
- [ ] Understand `InfoTooltip.tsx` component usage
- [ ] Review existing activation sections (Proximity Trigger as reference)

---

## 🚀 Quick Implementation Steps

### TASK 1: Lock on Map Section (2-3 hours)

#### Step 1.1: Locate Current Lock Button
```bash
# Find the current implementation
File: components/TaskEditor.tsx
Lines: ~2618-2642
Section: GPS Geofence Location
```

#### Step 1.2: Create New Section
Add this code AFTER the GPS Geofence section (around line 2660):

```tsx
{/* LOCK ON MAP - NEW DEDICATED SECTION */}
<div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 rounded-2xl border-2 border-amber-200 dark:border-amber-800">
    <button
        type="button"
        onClick={() => setExpandedActivations({...expandedActivations, lockOnMap: !expandedActivations.lockOnMap})}
        className="w-full flex items-start gap-4 text-left hover:opacity-80 transition-opacity"
    >
        <div className="w-12 h-12 bg-amber-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
            <Lock className="w-6 h-6" />
        </div>
        <div className="flex-1">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm uppercase tracking-wide">Lock on Map</h3>
                    {editedPoint.isLocationLocked && (
                        <div className="relative">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                        </div>
                    )}
                    <InfoTooltip
                        title="Lock on Map"
                        description="Prevent this task pin from being moved or dragged on the map editor. When locked, the task location becomes fixed and cannot be accidentally repositioned."
                        example="Lock historical landmark tasks to ensure they stay at exact GPS coordinates"
                    />
                </div>
                <ChevronDown className={`w-5 h-5 text-amber-600 transition-transform ${expandedActivations.lockOnMap ? 'rotate-180' : ''}`} />
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Prevent this task from being moved or repositioned on the map
            </p>
        </div>
    </button>

    {expandedActivations.lockOnMap && (
        <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-700">
            <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-bold text-amber-900 dark:text-amber-100">Enable Map Lock</label>
                <label className="flex items-center gap-2 cursor-pointer" onClick={() => {
                    setEditedPoint({...editedPoint, isLocationLocked: !editedPoint.isLocationLocked});
                }}>
                    <div className={`w-12 h-7 rounded-full transition-all ${editedPoint.isLocationLocked ? 'bg-amber-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${editedPoint.isLocationLocked ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                </label>
            </div>
            
            {editedPoint.isLocationLocked && (
                <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg p-3">
                    <p className="text-xs text-amber-900 dark:text-amber-200 font-bold flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        This task is locked and cannot be moved on the map
                    </p>
                </div>
            )}
        </div>
    )}
</div>
```

#### Step 1.3: Update State
Add to `expandedActivations` state (around line 167):
```tsx
const [expandedActivations, setExpandedActivations] = useState<Record<string, boolean>>({
    click: false,
    location: false,
    proximity: false,
    qr: false,
    nfc: false,
    ibeacon: false,
    lockOnMap: false  // ← ADD THIS
});
```

#### Step 1.4: Remove Old Lock Button
Delete lines ~2618-2642 (the old lock button in GPS Geofence section)

#### Step 1.5: Test
- [ ] Lock toggle works
- [ ] Green indicator shows when locked
- [ ] Section expands/collapses
- [ ] InfoTooltip opens on click

---

### TASK 2: Add InfoTooltips (3-4 hours)

#### Step 2.1: Proximity Trigger
Find line ~2679, add InfoTooltip to heading:

```tsx
<h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
    Proximity Trigger
    <InfoTooltip
        title="Proximity Trigger - Discovery Mechanic"
        description="Hide this task until players physically move within a certain distance. Creates an exploration/discovery element where hidden tasks are revealed as players explore the area."
        example="Hide a secret bonus task until teams get within 50 meters, creating a treasure hunt experience"
    />
</h3>
```

#### Step 2.2: QR Code Activation
Find line ~2765, add InfoTooltip:

```tsx
<h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
    QR Code Activation
    <InfoTooltip
        title="QR Code Activation"
        description="Require players to scan a specific QR code to unlock this task. Perfect for location-based challenges where QR codes are placed at physical locations."
        example="Place QR codes at historical landmarks - teams must visit and scan to unlock the task"
    />
</h3>
```

#### Step 2.3: NFC Tag Activation
Search for "NFC TAG ACTIVATION" heading, add InfoTooltip:

```tsx
<h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
    NFC Tag Activation
    <InfoTooltip
        title="NFC Tag Activation"
        description="Enable task unlocking via NFC (Near Field Communication) tags. Players tap their phone on NFC stickers/tags to unlock tasks. Perfect for indoor challenges."
        example="Place NFC tags on information boards, doors, or objects for contactless activation"
    />
</h3>
```

#### Step 2.4: iBeacon Activation
Search for "IBEACON ACTIVATION" heading, add InfoTooltip:

```tsx
<h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
    iBeacon Activation
    <InfoTooltip
        title="iBeacon Activation"
        description="Unlock tasks when players enter proximity of Bluetooth LE beacons. Works with physical beacon hardware for indoor/outdoor proximity detection."
        example="Deploy beacons at checkpoints - tasks unlock automatically when teams get close"
    />
</h3>
```

#### Step 2.5: Test All Tooltips
- [ ] All tooltips display correctly
- [ ] Content is helpful and clear
- [ ] Examples make sense
- [ ] Tooltips close on outside click
- [ ] Mobile: tooltips don't overflow

---

### TASK 3: Make Sections Collapsible (4-5 hours)

#### Step 3.1: GPS Geofence - Make Collapsible
Find GPS Geofence section (~line 2540), wrap in collapsible button:

```tsx
{/* GPS GEOFENCE LOCATION */}
<div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-2xl border-2 border-green-200 dark:border-green-800">
    <button
        type="button"
        onClick={() => setExpandedActivations({...expandedActivations, location: !expandedActivations.location})}
        className="w-full flex items-start gap-4 text-left hover:opacity-80 transition-opacity"
    >
        <div className="w-12 h-12 bg-green-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
            <MapPin className="w-6 h-6" />
        </div>
        <div className="flex-1">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm uppercase tracking-wide">GPS Geofence Location</h3>
                    {(editedPoint.location && editedPoint.activationTypes.includes('radius')) && (
                        <div className="relative">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                        </div>
                    )}
                    <InfoTooltip {...} />
                </div>
                <ChevronDown className={`w-5 h-5 text-green-600 transition-transform ${expandedActivations.location ? 'rotate-180' : ''}`} />
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Set GPS location and activation radius for this task
            </p>
        </div>
    </button>

    {expandedActivations.location && (
        <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
            {/* Existing GPS content here */}
        </div>
    )}
</div>
```

#### Step 3.2: QR Code - Make Collapsible
Find QR Code section (~line 2758), apply same pattern:

```tsx
<div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-2 border-purple-200 dark:border-purple-800">
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
                    {editedPoint.qrCodeString && (
                        <div className="relative">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                        </div>
                    )}
                    <InfoTooltip {...} />
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
            {/* Existing QR content here */}
        </div>
    )}
</div>
```

#### Step 3.3: NFC & iBeacon
Repeat the same pattern for NFC and iBeacon sections

#### Step 3.4: Test Collapsible Behavior
- [ ] All sections start collapsed
- [ ] Click expands/collapses correctly
- [ ] Chevron rotates smoothly
- [ ] Green indicators show when active
- [ ] Indicators update in real-time

---

### TASK 4: Settings Conflict Warnings (5-6 hours)

#### Step 4.1: Create Warning Component
Create new file: `components/SettingsConflictWarning.tsx`

```tsx
import React from 'react';
import { Info, AlertTriangle, ChevronRight } from 'lucide-react';

interface SettingsConflictWarningProps {
    type: 'info' | 'warning' | 'override';
    title: string;
    message: string;
    gameValue?: string | number;
    onNavigateToGameSettings?: () => void;
}

const SettingsConflictWarning: React.FC<SettingsConflictWarningProps> = ({
    type,
    title,
    message,
    gameValue,
    onNavigateToGameSettings
}) => {
    const styles = {
        info: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200',
        warning: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200',
        override: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-900 dark:text-orange-200'
    };

    const Icon = type === 'info' ? Info : AlertTriangle;

    return (
        <div className={`${styles[type]} border-2 rounded-xl p-4 mb-4`}>
            <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm font-bold mb-1">{title}</p>
                    <p className="text-xs">{message}</p>
                    {gameValue && (
                        <p className="text-xs font-mono mt-1 opacity-75">
                            Game Value: {gameValue}
                        </p>
                    )}
                    {onNavigateToGameSettings && (
                        <button
                            type="button"
                            onClick={onNavigateToGameSettings}
                            className="mt-2 text-xs font-bold hover:underline flex items-center gap-1"
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

export default SettingsConflictWarning;
```

#### Step 4.2: Add to TIMER Tab (Time Limit Conflict)
In TaskEditor.tsx, TIMER tab, add before time limit input:

```tsx
{/* Check for global time limit conflict */}
{activeGame?.taskConfig?.timeLimitMode === 'global' && (
    <SettingsConflictWarning
        type="override"
        title="Global Time Limit Active"
        message={`This game uses a ${activeGame.taskConfig.globalTimeLimit}s limit for ALL tasks. Task-specific time limits are disabled.`}
        gameValue={`${activeGame.taskConfig.globalTimeLimit} seconds`}
        onNavigateToGameSettings={onOpenGameSettings}
    />
)}
```

#### Step 4.3: Add to SETTINGS Tab (Answer Correctness)
```tsx
{/* Check for answer correctness conflict */}
{activeGame?.taskConfig?.showAnswerCorrectnessMode === 'always' && (
    <SettingsConflictWarning
        type="override"
        title="Answer Correctness Display Forced"
        message="Game-level setting forces answer correctness to always be shown for all tasks."
        gameValue="Always Show"
        onNavigateToGameSettings={onOpenGameSettings}
    />
)}
```

#### Step 4.4: Pass Required Props
Ensure TaskEditor receives `activeGame` and `onOpenGameSettings` props:

```tsx
interface TaskEditorProps {
    // ... existing props
    activeGame?: Game;  // ADD THIS
    onOpenGameSettings?: () => void;  // ADD THIS
}
```

Update parent component (App.tsx or TaskMaster.tsx) to pass these props.

#### Step 4.5: Test Conflict Warnings
- [ ] Warning shows for global time limit
- [ ] Warning shows for answer correctness
- [ ] "Edit in Game Settings" navigates correctly
- [ ] Warnings show correct game values
- [ ] Warnings disappear when not applicable

---

## 📝 Code Review Checklist

Before submitting PR:

### Code Quality
- [ ] No console.log statements
- [ ] Proper TypeScript types
- [ ] Comments for complex logic
- [ ] Consistent code style
- [ ] No duplicate code

### Functionality
- [ ] All features work as specified
- [ ] No regressions in existing features
- [ ] Edge cases handled
- [ ] Error handling present

### UI/UX
- [ ] Consistent with existing design
- [ ] Animations are smooth
- [ ] Accessible (keyboard navigation)
- [ ] Mobile responsive
- [ ] Dark mode works

### Performance
- [ ] No unnecessary re-renders
- [ ] Memoization where needed
- [ ] No memory leaks
- [ ] Fast load times

### Testing
- [ ] Manual testing complete
- [ ] All items in testing checklist ✓
- [ ] No browser console errors
- [ ] Works in all supported browsers

---

## 🐛 Common Issues & Solutions

### Issue 1: Green Indicator Not Showing
**Problem**: Indicator dot doesn't appear when section is active  
**Solution**: Check the conditional logic - ensure state is being read correctly
```tsx
{editedPoint.qrCodeString && editedPoint.qrCodeString.length > 0 && (
    <div className="relative">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
    </div>
)}
```

### Issue 2: Section Won't Collapse
**Problem**: Section stays expanded when clicking header  
**Solution**: Make sure button has `type="button"` to prevent form submission
```tsx
<button
    type="button"  // ← CRITICAL
    onClick={() => setExpandedActivations({...expandedActivations, qr: !expandedActivations.qr})}
    className="..."
>
```

### Issue 3: InfoTooltip Doesn't Close
**Problem**: Tooltip stays open when clicking outside  
**Solution**: Verify InfoTooltip component has click-outside handler (should already exist)

### Issue 4: Warning Shows When It Shouldn't
**Problem**: Conflict warning displays incorrectly  
**Solution**: Check conditional logic and ensure activeGame is passed correctly
```tsx
{activeGame?.taskConfig?.timeLimitMode === 'global' && (
    <SettingsConflictWarning ... />
)}
```

### Issue 5: Chevron Doesn't Rotate
**Problem**: Chevron icon doesn't rotate on expand/collapse  
**Solution**: Verify class name and state variable
```tsx
<ChevronDown className={`w-5 h-5 text-purple-600 transition-transform ${expandedActivations.qr ? 'rotate-180' : ''}`} />
```

---

## 📦 Files to Modify

| File | Changes | Lines Affected |
|------|---------|----------------|
| `components/TaskEditor.tsx` | Primary changes | ~2500-2900 |
| `components/SettingsConflictWarning.tsx` | New file | N/A (create new) |
| `types.ts` | Props updates (if needed) | N/A |
| `App.tsx` or parent component | Pass new props | Varies |

---

## 🎯 Final Verification

Before marking as complete:

1. **Visual Check**
   - [ ] All sections look polished
   - [ ] Colors match design tokens
   - [ ] Spacing is consistent
   - [ ] Icons are aligned

2. **Functional Check**
   - [ ] Lock on Map works independently
   - [ ] All tooltips are helpful
   - [ ] All sections collapse/expand
   - [ ] Green indicators appear correctly
   - [ ] Conflict warnings show when appropriate

3. **Documentation Check**
   - [ ] Code comments added
   - [ ] README updated (if needed)
   - [ ] ADVANCED_FEATURES_GUIDE updated

4. **User Testing**
   - [ ] Ask colleague to test
   - [ ] Check with non-technical user
   - [ ] Verify instructions are clear

---

## 📞 Need Help?

- **Full Specification**: See `TASK_EDITOR_IMPROVEMENTS_PLAN.md`
- **Visual Guide**: See `TASK_EDITOR_IMPROVEMENTS_SUMMARY.md`
- **Questions**: Contact development team lead
- **Bug Reports**: Create issue with screenshots and steps to reproduce

---

**Estimated Total Time**: 17-22 hours  
**Recommended Approach**: Complete tasks in order (1 → 2 → 3 → 4)  
**Break Points**: After each task, commit and test before proceeding
