# Advanced Task Timing Features - Implementeringsplan

## 📋 Feature Oversigt

### 1. **Scheduled Task Visibility** (Tidsbaseret Aktivering)
Task vises på kort/playzone baseret på:
- Specifik dato/klokkeslæt
- Nedtælling fra spillets start
- Tid før spillet slutter
- Visual marker på pin for timed tasks

### 2. **Info Task Type** (Opgave uden spørgsmål)
- Kun title, billede og tekst (ingen spørgsmål/svar)
- Toggle: Vis én gang eller hold tilgængelig for genaktivering

### 3. **Enhanced Time Limit Display**
- Tydeligt rødt nedtællingsur under task image
- Toggle: "Points vs Time Spend" (reducér points baseret på tid)
- Vibration og lyd de sidste 20 sekunder
- Flash countdown ur

### 4. **Times Up Popup**
- Rød popup ved timeout
- Vibration + countdown lyd (80% volumen)
- Flash effekt de sidste 20 sekunder

## 🏗️ Teknisk Implementering

### Step 1: Type Definitions

**Fil:** `types.ts`

#### 1.1: Scheduled Visibility
```typescript
export type TaskScheduleType = 'datetime' | 'game_start_offset' | 'game_end_offset';

export interface TaskSchedule {
  enabled: boolean;
  scheduleType: TaskScheduleType;
  
  // For 'datetime' mode
  showAtDateTime?: number; // Unix timestamp
  hideAtDateTime?: number; // Optional: auto-hide
  
  // For 'game_start_offset' mode
  showAfterMinutes?: number; // Minutes after game starts
  
  // For 'game_end_offset' mode
  showBeforeEndMinutes?: number; // Minutes before game ends
  
  // Visual indicator
  isScheduled: boolean; // Flag to show on pin
}
```

#### 1.2: Info Task Type
```typescript
export type TaskType = 
  | 'text' 
  | 'multiple_choice' 
  | 'checkbox' 
  | 'boolean' 
  | 'slider' 
  | 'dropdown' 
  | 'multi_select_dropdown' 
  | 'timeline' 
  | 'photo' 
  | 'video'
  | 'info';  // ← NY TYPE

export interface InfoTaskSettings {
  allowMultipleActivations: boolean; // true = re-activate, false = one-time
  showDismissButton: boolean; // Show "OK" button to close
  autoCloseAfterSeconds?: number; // Auto-close after X seconds (optional)
}
```

#### 1.3: Enhanced Time Limits
```typescript
export interface TaskSettings {
  timeLimitSeconds?: number;
  scoreDependsOnSpeed: boolean;
  
  // NEW: Advanced scoring mode
  scoreReductionMode?: 'none' | 'linear' | 'exponential';
  // 'linear': Reduce points evenly over time
  // 'exponential': Reduce points faster near end
  
  // NEW: Audio/Visual warnings
  countdownWarningEnabled?: boolean; // Enable last 20s warnings
  countdownWarningSeconds?: number; // When to start warning (default: 20)
  countdownFlashEnabled?: boolean; // Flash countdown timer
  countdownVibrateEnabled?: boolean; // Vibrate device
  countdownSoundEnabled?: boolean; // Play countdown beep
  countdownSoundVolume?: number; // Volume 0-100 (default: 80)
  
  language: string;
  showAnswerStatus: boolean;
  showCorrectAnswerOnMiss: boolean;
  maxAttempts?: number;
  matchTolerance?: number;
}
```

#### 1.4: GamePoint Updates
```typescript
export interface GamePoint {
  // ... existing fields ...
  
  // NEW: Scheduled visibility
  schedule?: TaskSchedule;
  
  // NEW: Info task settings (only if task.type === 'info')
  infoSettings?: InfoTaskSettings;
  
  // NEW: Track task activations (for info tasks with allowMultipleActivations: false)
  activatedByTeams?: string[]; // Team IDs that have activated this task
}
```

### Step 2: Scheduled Task Components

**Ny fil:** `components/TaskScheduleEditor.tsx`

```typescript
interface TaskScheduleEditorProps {
  point: GamePoint;
  onUpdateSchedule: (schedule: TaskSchedule) => void;
  game?: Game; // For calculating game start/end times
}
```

**UI Design:**
```
┌─────────────────────────────────────────┐
│ ⏰ TASK SCHEDULE                        │
├─────────────────────────────────────────┤
│ □ Enable Scheduled Visibility           │
│                                          │
│ Mode:                                    │
│ ○ Specific Date/Time                    │
│   Show at: [📅 2024-12-25] [⏰ 10:30]  │
│   Hide at: [📅 2024-12-25] [⏰ 12:00]  │
│                                          │
│ ● Offset from Game Start                │
│   Show after: [  30  ] minutes          │
│                                          │
│ ○ Before Game Ends                      │
│   Show: [  15  ] minutes before end    │
│                                          │
│ ☑ Show "⏰" icon on task pin            │
└─────────────────────────────────────────┘
```

### Step 3: Info Task Type Implementation

**Fil:** `components/TaskModal.tsx`

**Tilføj Info Task Mode:**
```typescript
// Detect info task
const isInfoTask = point.task.type === 'info';

// If info task, skip answer submission logic
if (isInfoTask) {
  return (
    <div className="info-task-modal">
      {/* Image */}
      {point.task.imageUrl && (
        <img src={point.task.imageUrl} />
      )}
      
      {/* Title */}
      <h2>{point.title}</h2>
      
      {/* Description/Text */}
      <div dangerouslySetInnerHTML={{ 
        __html: DOMPurify.sanitize(point.task.question) 
      }} />
      
      {/* Dismiss Button (if enabled) */}
      {point.infoSettings?.showDismissButton && (
        <button onClick={handleInfoTaskDismiss}>
          OK, GOT IT
        </button>
      )}
    </div>
  );
}
```

**Auto-close Logic:**
```typescript
useEffect(() => {
  if (isInfoTask && point.infoSettings?.autoCloseAfterSeconds) {
    const timer = setTimeout(() => {
      onClose();
    }, point.infoSettings.autoCloseAfterSeconds * 1000);
    
    return () => clearTimeout(timer);
  }
}, [isInfoTask, point.infoSettings]);
```

**One-time Activation Logic:**
```typescript
const handleInfoTaskDismiss = async () => {
  if (!point.infoSettings?.allowMultipleActivations) {
    // Mark as activated for this team
    await db.markTaskActivatedByTeam(point.id, teamId);
  }
  onClose();
};
```

### Step 4: Enhanced Countdown Timer

**Ny fil:** `components/TaskCountdownTimer.tsx`

```typescript
interface TaskCountdownTimerProps {
  totalSeconds: number;
  onTimeUp: () => void;
  settings: TaskSettings;
}

const TaskCountdownTimer: React.FC<TaskCountdownTimerProps> = ({
  totalSeconds,
  onTimeUp,
  settings
}) => {
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [isWarningPhase, setIsWarningPhase] = useState(false);
  const [flash, setFlash] = useState(false);
  
  const warningThreshold = settings.countdownWarningSeconds || 20;
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        
        // Check if entering warning phase
        if (newTime === warningThreshold && settings.countdownWarningEnabled) {
          setIsWarningPhase(true);
          startWarnings();
        }
        
        // Time up
        if (newTime <= 0) {
          clearInterval(interval);
          onTimeUp();
          return 0;
        }
        
        return newTime;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const startWarnings = () => {
    // Vibration
    if (settings.countdownVibrateEnabled) {
      vibratePattern();
    }
    
    // Sound
    if (settings.countdownSoundEnabled) {
      playCountdownBeep();
    }
    
    // Flash
    if (settings.countdownFlashEnabled) {
      startFlashing();
    }
  };
  
  const vibratePattern = () => {
    const pattern = [200, 100, 200]; // Vibrate-pause-vibrate
    const interval = setInterval(() => {
      if (timeLeft > 0) {
        navigator.vibrate(pattern);
      } else {
        clearInterval(interval);
      }
    }, 2000); // Every 2 seconds
  };
  
  const playCountdownBeep = () => {
    const beepInterval = setInterval(() => {
      if (timeLeft > 0) {
        const volume = (settings.countdownSoundVolume || 80) / 100;
        playSound('countdown_beep', volume);
      } else {
        clearInterval(beepInterval);
      }
    }, 1000); // Every second
  };
  
  const startFlashing = () => {
    const flashInterval = setInterval(() => {
      setFlash(prev => !prev);
    }, 500); // Flash every 500ms
    
    setTimeout(() => clearInterval(flashInterval), warningThreshold * 1000);
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className={`countdown-timer ${isWarningPhase ? 'warning' : ''} ${flash ? 'flash' : ''}`}>
      <div className="countdown-display">
        <span className="countdown-time">{formatTime(timeLeft)}</span>
      </div>
    </div>
  );
};
```

**CSS (Tailwind):**
```css
.countdown-timer {
  @apply bg-slate-800 rounded-xl p-4 mb-4;
}

.countdown-timer.warning {
  @apply bg-red-900/30 border-2 border-red-500;
}

.countdown-time {
  @apply text-4xl font-mono font-black text-red-500 tabular-nums;
}

.countdown-timer.flash .countdown-time {
  @apply animate-pulse;
}

@keyframes flash-urgent {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.countdown-timer.warning.flash {
  animation: flash-urgent 0.5s infinite;
}
```

### Step 5: Times Up Popup

**Ny fil:** `components/TimesUpPopup.tsx`

```typescript
interface TimesUpPopupProps {
  onClose: () => void;
}

const TimesUpPopup: React.FC<TimesUpPopupProps> = ({ onClose }) => {
  useEffect(() => {
    // Vibrate
    navigator.vibrate([500, 200, 500, 200, 500]);
    
    // Play failure sound
    playSound('time_up', 0.9);
    
    // Auto-close after 3 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 animate-in fade-in">
      <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-3xl p-12 max-w-md w-full mx-4 shadow-2xl border-4 border-red-400 animate-in zoom-in-95">
        <div className="text-center space-y-6">
          {/* Icon */}
          <div className="w-24 h-24 bg-red-900 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <AlertCircle className="w-16 h-16 text-white" />
          </div>
          
          {/* Title */}
          <h2 className="text-5xl font-black text-white uppercase tracking-wider">
            TIMES UP!
          </h2>
          
          {/* Message */}
          <div className="space-y-2">
            <p className="text-xl font-bold text-red-100">
              SORRY YOU MISSED THE TIME...
            </p>
            <p className="text-2xl font-black text-white">
              KEEP FIGHTING!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Step 6: Score Reduction Logic

**Fil:** `components/TaskModal.tsx`

**Calculate Score Based on Time:**
```typescript
const calculateTimeBasedScore = (
  basePoints: number,
  timeSpent: number,
  timeLimit: number,
  mode: 'linear' | 'exponential'
): number => {
  if (timeSpent >= timeLimit) return 0;
  
  const timeRatio = timeSpent / timeLimit;
  
  if (mode === 'linear') {
    // Linear reduction: 100% → 0% evenly
    return Math.round(basePoints * (1 - timeRatio));
  } else {
    // Exponential reduction: Faster drop near end
    return Math.round(basePoints * Math.pow(1 - timeRatio, 2));
  }
};

// Usage when submitting answer
const handleSubmit = () => {
  let finalScore = point.points;
  
  if (point.settings?.scoreDependsOnSpeed && point.settings?.timeLimitSeconds) {
    const timeSpent = (Date.now() - taskStartTime) / 1000;
    const mode = point.settings.scoreReductionMode || 'linear';
    
    finalScore = calculateTimeBasedScore(
      point.points,
      timeSpent,
      point.settings.timeLimitSeconds,
      mode
    );
  }
  
  onComplete(point.id, finalScore);
};
```

### Step 7: Scheduled Visibility Logic

**Fil:** `utils/taskScheduling.ts`

```typescript
export const isTaskVisibleNow = (
  point: GamePoint,
  game?: Game
): boolean => {
  if (!point.schedule?.enabled) return true;
  
  const now = Date.now();
  
  switch (point.schedule.scheduleType) {
    case 'datetime':
      const showAt = point.schedule.showAtDateTime || 0;
      const hideAt = point.schedule.hideAtDateTime || Infinity;
      return now >= showAt && now < hideAt;
      
    case 'game_start_offset':
      if (!game?.state || game.state !== 'active') return false;
      const gameStart = game.startedAt || 0;
      const showAfterMs = (point.schedule.showAfterMinutes || 0) * 60 * 1000;
      return now >= gameStart + showAfterMs;
      
    case 'game_end_offset':
      if (!game?.endingAt) return false;
      const showBeforeMs = (point.schedule.showBeforeEndMinutes || 0) * 60 * 1000;
      return now >= game.endingAt - showBeforeMs && now < game.endingAt;
      
    default:
      return true;
  }
};

// Filter tasks by visibility
export const getVisibleTasks = (
  points: GamePoint[],
  game?: Game
): GamePoint[] => {
  return points.filter(point => isTaskVisibleNow(point, game));
};
```

### Step 8: Pin Marker for Scheduled Tasks

**Fil:** `components/GameMap.tsx`

**Add visual indicator:**
```typescript
{point.schedule?.isScheduled && (
  <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
    <Clock className="w-4 h-4 text-white" />
  </div>
)}
```

### Step 9: Task Editor Integration

**Fil:** `components/TaskEditor.tsx`

**Add tabs/sections:**
1. **SCHEDULE** tab (new)
2. **INFO TASK** toggle (for task.type === 'info')
3. **TIME LIMITS** enhancements

**Schedule Section:**
```tsx
<div className="schedule-section">
  <h3>⏰ TASK SCHEDULE</h3>
  
  <TaskScheduleEditor
    point={point}
    onUpdateSchedule={(schedule) => {
      onUpdatePoint({ ...point, schedule });
    }}
    game={game}
  />
</div>
```

**Info Task Section:**
```tsx
{point.task.type === 'info' && (
  <div className="info-task-settings">
    <h3>ℹ️ INFO TASK SETTINGS</h3>
    
    <label>
      <input
        type="checkbox"
        checked={point.infoSettings?.allowMultipleActivations}
        onChange={(e) => onUpdatePoint({
          ...point,
          infoSettings: {
            ...point.infoSettings,
            allowMultipleActivations: e.target.checked
          }
        })}
      />
      Allow Multiple Activations (Re-activate after viewing)
    </label>
    
    <label>
      Auto-close after:
      <input
        type="number"
        value={point.infoSettings?.autoCloseAfterSeconds || 0}
        onChange={(e) => onUpdatePoint({
          ...point,
          infoSettings: {
            ...point.infoSettings,
            autoCloseAfterSeconds: Number(e.target.value)
          }
        })}
      />
      seconds (0 = manual close)
    </label>
  </div>
)}
```

**Enhanced Time Limits Section:**
```tsx
<div className="time-limits-enhanced">
  <h3>⏱️ TIME LIMITS</h3>
  
  <label>
    Time Limit:
    <input type="number" value={point.settings?.timeLimitSeconds || 0} />
    seconds
  </label>
  
  <label>
    Score Reduction Mode:
    <select
      value={point.settings?.scoreReductionMode || 'none'}
      onChange={(e) => onUpdatePoint({
        ...point,
        settings: {
          ...point.settings,
          scoreReductionMode: e.target.value as any
        }
      })}
    >
      <option value="none">No Reduction</option>
      <option value="linear">Linear (Even reduction)</option>
      <option value="exponential">Exponential (Faster near end)</option>
    </select>
  </label>
  
  <div className="countdown-warnings">
    <h4>⚠️ Countdown Warnings (Last 20s)</h4>
    
    <label>
      <input type="checkbox" checked={point.settings?.countdownWarningEnabled} />
      Enable Warnings
    </label>
    
    <label>
      <input type="checkbox" checked={point.settings?.countdownFlashEnabled} />
      Flash Timer
    </label>
    
    <label>
      <input type="checkbox" checked={point.settings?.countdownVibrateEnabled} />
      Vibrate Device
    </label>
    
    <label>
      <input type="checkbox" checked={point.settings?.countdownSoundEnabled} />
      Play Countdown Sound
    </label>
    
    <label>
      Sound Volume:
      <input
        type="range"
        min="0"
        max="100"
        value={point.settings?.countdownSoundVolume || 80}
      />
      {point.settings?.countdownSoundVolume || 80}%
    </label>
  </div>
</div>
```

## 📁 Fil Oversigt

### Nye Filer
```
components/
├── TaskScheduleEditor.tsx         (NY - ~250 linjer)
├── TaskCountdownTimer.tsx         (NY - ~180 linjer)
└── TimesUpPopup.tsx               (NY - ~80 linjer)

utils/
└── taskScheduling.ts              (NY - ~60 linjer)

sounds/
├── countdown_beep.mp3             (NY - lyd fil)
└── time_up.mp3                    (NY - lyd fil)
```

### Ændrede Filer
```
types.ts                           (+80 linjer)
components/TaskModal.tsx           (+150 linjer)
components/TaskEditor.tsx          (+200 linjer)
components/GameMap.tsx             (+20 linjer)
services/db.ts                     (+30 linjer)
```

**Total:** ~1050 nye linjer kode

## 🧪 Test Cases

### Scheduled Tasks
- [ ] Test 1: Sæt datetime schedule → Task vises kun i tidsvinduet
- [ ] Test 2: Game start offset → Task vises efter X minutter
- [ ] Test 3: Game end offset → Task vises X minutter før slut
- [ ] Test 4: Clock ikon vises på pin
- [ ] Test 5: Task skjules automatisk efter hideAtDateTime

### Info Tasks
- [ ] Test 6: Opret info task (ingen spørgsmål)
- [ ] Test 7: Vis kun én gang → Kan ikke aktiveres igen
- [ ] Test 8: Allow multiple activations → Kan aktiveres flere gange
- [ ] Test 9: Auto-close efter 10 sekunder
- [ ] Test 10: Manual dismiss med OK knap

### Enhanced Countdown
- [ ] Test 11: Rødt nedtællingsur vises under billede
- [ ] Test 12: Linear score reduction → Jævn reduktion
- [ ] Test 13: Exponential score reduction → Hurtigere ved slutning
- [ ] Test 14: Sidste 20s → Vibration starter
- [ ] Test 15: Sidste 20s → Countdown beep (80% volumen)
- [ ] Test 16: Sidste 20s → Flash effekt på timer
- [ ] Test 17: Time up → "TIMES UP!" popup vises
- [ ] Test 18: Time up popup → Auto-close efter 3 sekunder

### Integration
- [ ] Test 19: Scheduled + countdown → Begge fungerer sammen
- [ ] Test 20: Info task + schedule → Info task vises på schedule
- [ ] Test 21: Multiple tasks med forskellige schedules

## 🚀 Implementation Order

1. **Phase 1: Type Definitions** (30 min)
   - Opdater types.ts
   - Test compile errors

2. **Phase 2: Info Task Type** (1 time)
   - TaskModal info mode
   - TaskEditor toggle
   - Database support

3. **Phase 3: Enhanced Countdown** (2 timer)
   - TaskCountdownTimer component
   - Flash/vibrate/sound logic
   - TimesUpPopup component
   - Score reduction logic

4. **Phase 4: Scheduled Visibility** (2 timer)
   - TaskScheduleEditor component
   - taskScheduling.ts utility
   - GameMap pin marker
   - Filter logic in App.tsx

5. **Phase 5: Testing & Polish** (1 time)
   - Run all test cases
   - Fix bugs
   - Polish UI/UX

**Total estimeret tid:** 6-7 timer

## ✅ Success Criteria

- [x] Tasks kan scheduleres med 3 forskellige modes
- [x] Clock ikon vises på scheduled task pins
- [x] Info task type virker (ingen spørgsmål)
- [x] Info tasks kan vises én gang eller multiple gange
- [x] Rødt countdown ur under task billede
- [x] Linear og exponential score reduction
- [x] Vibration sidste 20 sekunder
- [x] Countdown beep lyd (80% volumen)
- [x] Flash effekt på timer
- [x] "TIMES UP!" popup ved timeout
- [x] Auto-close popup efter 3 sekunder

---

**Status:** 📝 Plan klar til implementering  
**Prioritet:** Høj  
**Kompleksitet:** Mellem-Høj (mange features, men velafgrænset)
