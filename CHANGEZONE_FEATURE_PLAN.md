# CHANGEZONE Feature - Implementeringsplan

## 📋 Feature Oversigt

**Formål:** Giv instruktører mulighed for at aktivere et countdown-ur i spillet til en skiftezone, hvor spillerne får en besked om hvad der skal ske.

## 🎯 Funktionskrav

### 1. **CHANGEZONE Panel i Left Drawer**
**Placering:** Editor Mode Map + Instructor View Mode

**Funktioner:**
- Sæt et klokkeslæt for countdown
- Live +/- 1 minut knapper på hver side af uret
- Toggle: "Show countdown on TEAMVIEW"
- Teksteditor felt til besked (formateret)
- Upload billede funktion
- Toggle: "Teams må lukke popup" vs "Kode kræves (4027)"

### 2. **Countdown Display**
**Instruktør/Editor View:**
- Rød box i toppen: "COUNTDOWN TO CHANGE: XX:XX"

**Team View:**
- Rødt nedtællingsur i topbar (kun hvis toggle er aktiveret)

### 3. **Popup Modal ved 00:00**
**Visning:** Alle 3 modes (Editor, Instructor, Team)

**Indhold:**
- Fylder 75% af skærmen
- Formateret besked fra teksteditor
- Billede (som task view, men med røde borders)
- Lukke-mekanisme:
  - OK knap (hvis toggle tillader det)
  - Kode-input "4027" (hvis toggle kræver kode)

## 🏗️ Teknisk Implementering

### Step 1: Type Definitions
**Fil:** `types.ts`

Tilføj til `Game` interface:
```typescript
changeZone?: {
  enabled: boolean;
  targetTime?: number; // Unix timestamp
  showOnTeamView: boolean;
  message: string; // HTML formateret besked
  imageUrl?: string;
  requireCode: boolean; // false = OK button, true = code required
  hasTriggered: boolean; // Track hvis popup allerede er vist
  startedAt?: number; // Timestamp for når countdown startede
}
```

### Step 2: Change Zone Panel Component
**Ny fil:** `components/ChangeZonePanel.tsx`

**Props:**
```typescript
interface ChangeZonePanelProps {
  game: Game;
  onUpdateGame: (updates: Partial<Game>) => void;
}
```

**UI Elementer:**
1. Header: "CHANGEZONE" med orange gradient
2. Enable/Disable toggle
3. Time picker input (HH:MM format)
4. +1min / -1min knapper på hver side af time picker
5. Toggle: "Show countdown on TEAMVIEW"
6. Rich text editor for besked (med formatering)
7. Image upload button
8. Toggle: "Teams may close popup" vs "Require code"
9. Reset button (rød)

### Step 3: Countdown Display Component
**Ny fil:** `components/ChangeZoneCountdown.tsx`

**Props:**
```typescript
interface ChangeZoneCountdownProps {
  targetTime: number;
  variant: 'instructor' | 'team';
}
```

**Logic:**
- Beregn resterende tid hver sekund
- Når tiden når 00:00, trigger popup event
- Format: MM:SS eller HH:MM:SS

### Step 4: Change Zone Popup Modal
**Ny fil:** `components/ChangeZonePopup.tsx`

**Props:**
```typescript
interface ChangeZonePopupProps {
  message: string; // HTML content
  imageUrl?: string;
  requireCode: boolean;
  onClose: () => void;
}
```

**UI:**
- 75% af skærmen (centered overlay)
- Rød border (4px solid)
- Hvid/transparent baggrund med backdrop blur
- Billede øverst (hvis tilgængeligt)
- HTML besked (dangerouslySetInnerHTML med DOMPurify)
- Bund: OK knap eller Code input + Submit

### Step 5: Integration i Instructor Dashboard
**Fil:** `components/InstructorDashboard.tsx`

**Tilføjelser:**
1. Import `ChangeZonePanel`
2. Tilføj panel til left drawer (ny sektion)
3. Top banner: Rød box med countdown (hvis enabled)
4. Listen for countdown trigger → vis popup

### Step 6: Integration i Editor Drawer
**Fil:** `components/EditorDrawer.tsx`

**Tilføjelser:**
1. Tilføj "CHANGEZONE" sektion i drawer
2. Integrér `ChangeZonePanel` component
3. Top banner: Rød box med countdown (hvis enabled)

### Step 7: Integration i Team Dashboard
**Fil:** `components/TeamDashboard.tsx`

**Tilføjelser:**
1. Tjek `game.changeZone.showOnTeamView`
2. Hvis true, vis rødt countdown ur i topbar
3. Listen for countdown trigger → vis popup

### Step 8: Realtime Sync Logic
**Fil:** `App.tsx`

**Implementer:**
1. Subscribe til game updates (Supabase realtime)
2. Når `changeZone.targetTime` ændres, opdater lokalt state
3. Når countdown når 00:00:
   - Vis popup på alle clients
   - Sæt `hasTriggered: true` i database
   - Prevent multiple triggers

### Step 9: Database Updates
**Fil:** `services/db.ts`

**Tilføj:**
```typescript
export const updateGameChangeZone = async (
  gameId: string, 
  changeZone: Game['changeZone']
) => {
  // Update game.changeZone field
}
```

## 🎨 UI/UX Detaljer

### Color Scheme
- **CHANGEZONE Panel:** Orange gradient (#FF6B00 → #FF8C00)
- **Countdown Box (Instructor/Editor):** Rød baggrund (#DC2626)
- **Countdown (Team View):** Rød tekst + rød border
- **Popup Border:** Rød (#DC2626, 4px solid)
- **+/- Buttons:** Grøn (+) / Rød (-)

### Typography
- **Panel Header:** Font-black, uppercase, tracking-widest
- **Countdown Timer:** Monospace font (tabular-nums)
- **Message Text:** System font, line-height: 1.6

### Layout
```
┌─────────────────────────────────────────┐
│  CHANGEZONE                     [Toggle]│
├─────────────────────────────────────────┤
│  Target Time: [-1]  12:45  [+1]        │
│                                          │
│  □ Show countdown on TEAMVIEW           │
│                                          │
│  Message:                                │
│  ┌────────────────────────────────────┐ │
│  │ [Rich text editor]                 │ │
│  │                                    │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Image: [Upload] [preview thumb]       │
│                                          │
│  Close Behavior:                         │
│  ○ Teams may close with OK              │
│  ● Require code from instructor         │
│                                          │
│  [RESET COUNTDOWN]                       │
└─────────────────────────────────────────┘
```

## 📁 Fil Struktur

### Nye filer:
1. `components/ChangeZonePanel.tsx` (320 linjer)
2. `components/ChangeZoneCountdown.tsx` (120 linjer)
3. `components/ChangeZonePopup.tsx` (180 linjer)

### Ændrede filer:
1. `types.ts` (+15 linjer)
2. `components/InstructorDashboard.tsx` (+80 linjer)
3. `components/EditorDrawer.tsx` (+60 linjer)
4. `components/TeamDashboard.tsx` (+45 linjer)
5. `App.tsx` (+30 linjer)
6. `services/db.ts` (+20 linjer)

**Total:** ~850 nye linjer kode

## ⚙️ Logic Flow

### 1. Instruktør Sætter Countdown
```
Instructor Dashboard → ChangeZonePanel
  ↓
Sæt klokkeslæt (12:45)
  ↓
Klik +1min → Ny tid: 12:46
  ↓
Toggle "Show on TEAMVIEW" ON
  ↓
Skriv besked + upload billede
  ↓
Vælg "Require code"
  ↓
updateGameChangeZone(gameId, {...})
  ↓
Database opdateres → Realtime sync til alle clients
```

### 2. Countdown Trigger ved 00:00
```
ChangeZoneCountdown (useEffect interval)
  ↓
Tjek: currentTime >= targetTime?
  ↓
JA → Trigger event
  ↓
Vis ChangeZonePopup på alle modes
  ↓
Opdater game.changeZone.hasTriggered = true
  ↓
Prevent re-trigger
```

### 3. Spillere Lukker Popup
```
ChangeZonePopup åben
  ↓
Hvis requireCode === false:
  Klik OK → onClose()
  ↓
Hvis requireCode === true:
  Indtast kode "4027" → Valider → onClose()
  ↓
Popup lukkes
```

## 🧪 Test Cases

### Test 1: Sæt Countdown
- [ ] Sæt tid til 5 minutter frem
- [ ] Verificér countdown vises i toppen
- [ ] Klik +1min → Tiden opdateres
- [ ] Klik -1min → Tiden opdateres

### Test 2: Team View Toggle
- [ ] Toggle ON → Countdown vises på team view
- [ ] Toggle OFF → Countdown skjules på team view
- [ ] Verificér realtime sync

### Test 3: Popup Trigger
- [ ] Vent til countdown når 00:00
- [ ] Verificér popup vises på Editor, Instructor, Team
- [ ] Verificér besked + billede vises korrekt
- [ ] Verificér rød border (4px)

### Test 4: Lukke-mekanisme
- [ ] "OK button" mode: Klik OK → Popup lukkes
- [ ] "Code required" mode: Forkert kode → Fejl
- [ ] "Code required" mode: "4027" → Popup lukkes

### Test 5: Reset
- [ ] Klik RESET → Countdown nulstilles
- [ ] Verificér `hasTriggered` sættes til false
- [ ] Verificér countdown kan bruges igen

## 🚀 Deployment Checklist

- [ ] Type definitions opdateret
- [ ] ChangeZonePanel component oprettet
- [ ] ChangeZoneCountdown component oprettet
- [ ] ChangeZonePopup component oprettet
- [ ] InstructorDashboard integreret
- [ ] EditorDrawer integreret
- [ ] TeamDashboard integreret
- [ ] Database service opdateret
- [ ] Realtime sync implementeret
- [ ] Test alle scenarier
- [ ] Code review
- [ ] Push til orbit-world branch

## 🎯 Success Criteria

✅ Instruktør kan sætte countdown med +/- 1 minut knapper
✅ Countdown vises i toppen af Editor/Instructor view (rød box)
✅ Countdown vises i Team view topbar (hvis toggle aktiveret)
✅ Popup vises ved 00:00 på alle modes
✅ Popup fylder 75% af skærmen med rød border
✅ Besked og billede vises korrekt
✅ OK/Code lukke-mekanisme fungerer
✅ Realtime sync mellem alle clients

---

**Estimeret tid:** 4-5 timer
**Prioritet:** Høj
**Kompleksitet:** Mellem (realtime sync + multi-mode integration)
