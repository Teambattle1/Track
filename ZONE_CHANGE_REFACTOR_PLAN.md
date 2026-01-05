# Zone Change Feature Refactoring - Implementation Plan

## 🎯 Objectives

1. **Support MULTIPLE zone changes** (not just one)
2. **Add dedicated "ZONE CHANGE" tab** in Game Settings (GameCreator)
3. **Remove floating button** from Instructor Dashboard
4. **Make countdown always visible** when zone changes are active
5. **Improve UX** with drawer-based configuration

---

## 📋 Current State Analysis

### Current Implementation
**File**: `types.ts` (lines 695-706)
```typescript
changeZone?: {
  enabled: boolean;
  targetTime?: number; // Unix timestamp
  showOnTeamView: boolean;
  message: string; // HTML
  imageUrl?: string;
  requireCode: boolean;
  hasTriggered: boolean;
  startedAt?: number;
};
```

**Problem**: Only supports ONE zone change per game

### Current UI Locations
1. **InstructorDashboard.tsx**: Floating button + floating panel (lines 632-660)
2. **ChangeZonePanel.tsx**: Standalone panel component
3. **ChangeZoneCountdown.tsx**: Countdown display
4. **ChangeZonePopup.tsx**: Player-facing popup
5. **TeamDashboard.tsx**: Team view countdown

---

## 🔄 New Type Structure

### Updated Game Interface

**File**: `types.ts`

```typescript
// NEW: Individual Zone Change Entry
export interface ZoneChangeEvent {
  id: string; // Unique identifier (e.g., "zc-1234567890")
  title: string; // e.g., "Switch to City Center", "Move to Park"
  enabled: boolean;
  targetTime?: number; // Unix timestamp for countdown
  showOnTeamView: boolean;
  message: string; // HTML formatted popup message
  imageUrl?: string; // Optional popup image
  requireCode: boolean; // Require code "4027" to dismiss
  hasTriggered: boolean; // Track if popup has been shown
  startedAt?: number; // When countdown started
  order: number; // Display order (0, 1, 2, ...)
  createdAt: number; // Timestamp
}

// Game Interface Update
export interface Game {
  // ... existing fields
  
  // DEPRECATED (keep for backwards compatibility, auto-migrate on load)
  changeZone?: {
    enabled: boolean;
    targetTime?: number;
    showOnTeamView: boolean;
    message: string;
    imageUrl?: string;
    requireCode: boolean;
    hasTriggered: boolean;
    startedAt?: number;
  };
  
  // NEW: Multiple zone changes support
  zoneChanges?: ZoneChangeEvent[];
}
```

---

## 🎨 New UI Structure

### 1. Game Settings Tab: "ZONE CHANGE"

**Location**: `components/GameCreator.tsx`

**Add to TABS array** (line 115):
```typescript
const TABS = [
    { id: 'GAME', label: 'Game', icon: Gamepad2 },
    { id: 'TEAMS', label: 'Teams', icon: Users },
    { id: 'VOTE', label: 'Vote', icon: Users },
    { id: 'MAP', label: 'Mapstyle', icon: MapIcon },
    { id: 'TIMING', label: 'Timing', icon: Clock },
    { id: 'ZONECHANGE', label: 'Zone Change', icon: MapPin }, // ← NEW TAB
    { id: 'PLAY', label: 'Play', icon: PlayCircle },
    // ... rest of tabs
];
```

### 2. Zone Change Tab Content

**New Section in GameCreator.tsx**:

```tsx
{effectiveTab === 'ZONECHANGE' && (
    <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-900 to-red-900 p-6 rounded-2xl border border-orange-700">
            <div className="flex items-center gap-3 mb-3">
                <MapPin className="w-8 h-8 text-orange-300" />
                <div>
                    <h2 className="text-xl font-black text-white uppercase">Zone Change Events</h2>
                    <p className="text-sm text-orange-200">
                        Schedule automatic zone changes with countdown timers and custom messages
                    </p>
                </div>
            </div>
            
            {/* Info Box */}
            <div className="bg-orange-950/50 border border-orange-800 rounded-xl p-4 mt-4">
                <p className="text-xs text-orange-200">
                    <strong>How it works:</strong> Create countdown events that trigger automatic 
                    notifications to teams. Perfect for scheduled zone transitions, time-based 
                    challenges, or multi-stage games.
                </p>
            </div>
        </div>

        {/* Zone Changes List */}
        <div className="space-y-4">
            {zoneChanges.length === 0 ? (
                <div className="bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl p-12 text-center">
                    <MapPin className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-300 mb-2">No Zone Changes Yet</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Create your first zone change event to get started
                    </p>
                    <button
                        type="button"
                        onClick={handleAddZoneChange}
                        className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold uppercase tracking-wide transition-all flex items-center gap-2 mx-auto"
                    >
                        <Plus className="w-5 h-5" />
                        Create First Zone Change
                    </button>
                </div>
            ) : (
                <>
                    {/* Existing Zone Changes */}
                    {zoneChanges.map((zc, index) => (
                        <ZoneChangeCard
                            key={zc.id}
                            zoneChange={zc}
                            index={index}
                            onUpdate={(updates) => handleUpdateZoneChange(zc.id, updates)}
                            onDelete={() => handleDeleteZoneChange(zc.id)}
                            onMoveUp={index > 0 ? () => handleMoveZoneChange(index, -1) : undefined}
                            onMoveDown={index < zoneChanges.length - 1 ? () => handleMoveZoneChange(index, 1) : undefined}
                        />
                    ))}
                    
                    {/* Add More Button */}
                    <button
                        type="button"
                        onClick={handleAddZoneChange}
                        className="w-full py-4 border-2 border-dashed border-orange-600 hover:border-orange-500 rounded-xl text-orange-400 hover:text-orange-300 font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Add Another Zone Change
                    </button>
                </>
            )}
        </div>
    </div>
)}
```

---

## 🎴 ZoneChangeCard Component

**New File**: `components/ZoneChangeCard.tsx`

```tsx
import React, { useState } from 'react';
import { ZoneChangeEvent } from '../types';
import { 
    MapPin, Clock, ChevronUp, ChevronDown, Trash2, 
    Eye, EyeOff, Upload, Image as ImageIcon, AlertTriangle,
    Check, X, Code as CodeIcon
} from 'lucide-react';
import { uploadImage } from '../services/storage';
import DOMPurify from 'dompurify';

interface ZoneChangeCardProps {
    zoneChange: ZoneChangeEvent;
    index: number;
    onUpdate: (updates: Partial<ZoneChangeEvent>) => void;
    onDelete: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
}

const ZoneChangeCard: React.FC<ZoneChangeCardProps> = ({
    zoneChange,
    index,
    onUpdate,
    onDelete,
    onMoveUp,
    onMoveDown
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleTimeChange = (timeString: string) => {
        const [hours, minutes] = timeString.split(':').map(Number);
        const now = new Date();
        const target = new Date(now);
        target.setHours(hours, minutes, 0, 0);
        
        // If time is in the past, assume next day
        if (target.getTime() < now.getTime()) {
            target.setDate(target.getDate() + 1);
        }
        
        onUpdate({ targetTime: target.getTime() });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploading(true);
        try {
            const url = await uploadImage(file);
            if (url) onUpdate({ imageUrl: url });
        } finally {
            setIsUploading(false);
        }
    };

    const getTimeString = () => {
        if (!zoneChange.targetTime) return '';
        const date = new Date(zoneChange.targetTime);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const getTimeRemaining = () => {
        if (!zoneChange.targetTime) return 'Not set';
        const now = Date.now();
        const diff = zoneChange.targetTime - now;
        if (diff < 0) return 'Passed';
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    return (
        <div className={`bg-slate-900 border-2 rounded-2xl overflow-hidden transition-all ${
            zoneChange.enabled 
                ? 'border-orange-500 shadow-lg shadow-orange-500/20' 
                : 'border-slate-700'
        }`}>
            {/* Header */}
            <div className="p-4 flex items-center gap-3">
                {/* Order Controls */}
                <div className="flex flex-col gap-1">
                    <button
                        type="button"
                        onClick={onMoveUp}
                        disabled={!onMoveUp}
                        className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onMoveDown}
                        disabled={!onMoveDown}
                        className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>

                {/* Number Badge */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                    zoneChange.enabled 
                        ? 'bg-orange-600 text-white' 
                        : 'bg-slate-800 text-slate-500'
                }`}>
                    {index + 1}
                </div>

                {/* Title & Time */}
                <div className="flex-1">
                    <input
                        type="text"
                        value={zoneChange.title}
                        onChange={(e) => onUpdate({ title: e.target.value })}
                        placeholder="e.g., Switch to Park Zone"
                        className="w-full bg-transparent border-none text-white font-bold text-lg outline-none focus:ring-2 focus:ring-orange-500 rounded px-2"
                    />
                    <p className="text-xs text-slate-500 px-2">
                        {zoneChange.targetTime ? (
                            <>Time: {getTimeString()} ({getTimeRemaining()} remaining)</>
                        ) : (
                            'No time set'
                        )}
                    </p>
                </div>

                {/* Status Indicators */}
                <div className="flex items-center gap-2">
                    {zoneChange.hasTriggered && (
                        <div className="px-3 py-1 bg-green-900 border border-green-700 rounded-lg text-xs font-bold text-green-300">
                            TRIGGERED
                        </div>
                    )}
                    {zoneChange.showOnTeamView && (
                        <Eye className="w-4 h-4 text-blue-400" title="Visible to teams" />
                    )}
                </div>

                {/* Toggle Enable */}
                <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`w-12 h-7 rounded-full transition-all ${
                        zoneChange.enabled ? 'bg-orange-600' : 'bg-slate-700'
                    }`}>
                        <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${
                            zoneChange.enabled ? 'translate-x-6' : 'translate-x-0.5'
                        } translate-y-0.5`} />
                    </div>
                </label>

                {/* Expand/Collapse */}
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 hover:bg-slate-700 rounded-lg"
                >
                    <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Delete */}
                <button
                    type="button"
                    onClick={onDelete}
                    className="p-2 hover:bg-red-900 rounded-lg text-red-400 hover:text-red-300"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>

            {/* Expanded Configuration */}
            {isExpanded && (
                <div className="border-t border-slate-700 p-6 space-y-6 bg-slate-950">
                    {/* Time Configuration */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                            <Clock className="w-4 h-4 inline mr-1" />
                            Countdown Target Time
                        </label>
                        <input
                            type="time"
                            value={getTimeString()}
                            onChange={(e) => handleTimeChange(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                            Countdown will reach 00:00 at this time
                        </p>
                    </div>

                    {/* Show on Team View */}
                    <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl">
                        <div>
                            <label className="text-sm font-bold text-white">Show Countdown to Teams</label>
                            <p className="text-xs text-slate-500 mt-1">
                                Display countdown timer in team dashboard
                            </p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <div className={`w-12 h-7 rounded-full transition-all ${
                                zoneChange.showOnTeamView ? 'bg-blue-600' : 'bg-slate-700'
                            }`}>
                                <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${
                                    zoneChange.showOnTeamView ? 'translate-x-6' : 'translate-x-0.5'
                                } translate-y-0.5`} />
                            </div>
                        </label>
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                            Popup Message (HTML)
                        </label>
                        <textarea
                            value={zoneChange.message}
                            onChange={(e) => onUpdate({ message: e.target.value })}
                            rows={4}
                            placeholder="<h2>Time to Move!</h2><p>Head to the park zone now.</p>"
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                            Use HTML for formatting (e.g., &lt;strong&gt;, &lt;p&gt;, &lt;h2&gt;)
                        </p>
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                            <ImageIcon className="w-4 h-4 inline mr-1" />
                            Popup Image (Optional)
                        </label>
                        
                        {zoneChange.imageUrl ? (
                            <div className="relative group">
                                <img 
                                    src={zoneChange.imageUrl} 
                                    alt="Zone Change" 
                                    className="w-full h-40 object-cover rounded-xl border-2 border-slate-700"
                                />
                                <button
                                    type="button"
                                    onClick={() => onUpdate({ imageUrl: undefined })}
                                    className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        ) : (
                            <label className="block w-full p-8 border-2 border-dashed border-slate-700 hover:border-orange-500 rounded-xl cursor-pointer transition-all text-center">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                                {isUploading ? (
                                    <p className="text-sm text-slate-400">Uploading...</p>
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                                        <p className="text-sm text-slate-400">Click to upload image</p>
                                    </>
                                )}
                            </label>
                        )}
                    </div>

                    {/* Require Code */}
                    <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl">
                        <div>
                            <label className="text-sm font-bold text-white flex items-center gap-2">
                                <CodeIcon className="w-4 h-4" />
                                Require Code to Dismiss
                            </label>
                            <p className="text-xs text-slate-500 mt-1">
                                Teams must enter code "4027" to close the popup
                            </p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <div className={`w-12 h-7 rounded-full transition-all ${
                                zoneChange.requireCode ? 'bg-purple-600' : 'bg-slate-700'
                            }`}>
                                <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${
                                    zoneChange.requireCode ? 'translate-x-6' : 'translate-x-0.5'
                                } translate-y-0.5`} />
                            </div>
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZoneChangeCard;
```

---

## 🔧 Implementation Steps

### Phase 1: Type Updates (1 hour)
- [ ] Update `types.ts` with new `ZoneChangeEvent` interface
- [ ] Add `zoneChanges?: ZoneChangeEvent[]` to Game interface
- [ ] Keep old `changeZone` for backwards compatibility

### Phase 2: Migration Logic (1 hour)
- [ ] Create `utils/zoneChangeMigration.ts`
- [ ] Auto-migrate old single `changeZone` to new `zoneChanges[]` array
- [ ] Add migration on game load

### Phase 3: ZoneChangeCard Component (3 hours)
- [ ] Create `components/ZoneChangeCard.tsx`
- [ ] Implement all configuration options
- [ ] Add image upload functionality
- [ ] Test all toggles and inputs

### Phase 4: GameCreator Integration (2 hours)
- [ ] Add "ZONE CHANGE" tab to TABS array
- [ ] Add state management for `zoneChanges`
- [ ] Implement add/update/delete/reorder functions
- [ ] Add tab content rendering

### Phase 5: InstructorDashboard Updates (2 hours)
- [ ] Remove floating button (lines 640-660)
- [ ] Remove floating panel (lines 632-660)
- [ ] Update countdown banner to handle multiple events
- [ ] Show active zone changes in always-visible section

### Phase 6: Countdown Updates (2 hours)
- [ ] Update `ChangeZoneCountdown.tsx` to handle multiple events
- [ ] Show all active countdowns
- [ ] Update trigger logic for multiple events

### Phase 7: Testing & Documentation (2 hours)
- [ ] Test creating multiple zone changes
- [ ] Test countdown behavior
- [ ] Test team view visibility
- [ ] Update documentation

---

## Total Estimated Time: 13-15 hours

---

## 🎯 Success Criteria

✅ Can create MULTIPLE zone change events  
✅ Zone changes configured in Game Settings tab  
✅ No floating buttons - all in drawer  
✅ Countdowns always visible when active  
✅ Each event can be enabled/disabled independently  
✅ Events can be reordered  
✅ Backwards compatible with old single `changeZone`  
✅ Clean, professional UI matching existing design

