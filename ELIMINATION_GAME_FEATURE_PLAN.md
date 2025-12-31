# 🎯 ELIMINATION GAME MODE - COMPREHENSIVE FEATURE PLAN

**Game Type**: GPS-based Capture The Flag (CTF)  
**Status**: 🔄 **PLANNING PHASE**  
**Estimated Implementation**: 3-4 weeks  
**Complexity**: Medium-High

---

## 📋 EXECUTIVE SUMMARY

**ELIMINATION** is a revolutionary GPS-based Capture The Flag game where:
- Teams hunt for **digitally hidden tasks/flags** on a live map
- **First team to solve a task eliminates it** for all other teams
- Teams build **captured task playgrounds** showing their progress
- **Live real-time leaderboard** based on tasks captured (not points)
- Strategic **bomb/danger zone** system to slow down opponents
- **2-minute cooldown** on failed attempts to force exploration

---

## 🎮 CORE GAME MECHANICS

### 1. **Game Mode: ELIMINATION** 
**GPS-Based, Competitive, Real-Time**

#### Game Features:
```
Setting:        Outdoor, GPS-enabled locations
Players:        2-8 teams simultaneously
Duration:       15-60 minutes (configurable)
Objective:      Capture more tasks than other teams
Victory:        Team with most captured tasks wins
Ranking:        Based on tasks captured, not points
```

#### Key Differentiation from Standard Games:
| Aspect | Standard Game | ELIMINATION |
|--------|---------------|-------------|
| **Navigation** | Map + GPS to find tasks | Map to find tasks |
| **Task Visibility** | Visible to all teams always | Disappears when first team solves |
| **Scoring** | Points per task | Captured task count |
| **Ranking** | High score wins | Most captures wins |
| **Leaderboard** | Points | Captured Tasks |
| **Team Locations** | Optional visibility | ALWAYS visible (solid colors) |
| **Cooldown** | None | 2 min on wrong answer |
| **Team Playgrounds** | No | Yes (shows captured tasks) |

---

## 🗺️ MAP & LOCATION SYSTEM

### Task Placement
```
Initial State:
- All tasks visible on map as numbered pins
- Each task has GPS coordinates (lat/lng)
- Task icons show task type (QR, Click, Multiple choice, etc)
- Teams navigate to task location via GPS

When Task is Solved (First Team):
- Task DISAPPEARS from all other teams' maps
- Added to solving team's "Captured" playground
- Other teams can see it was captured (gray out or remove entirely)
- Task becomes unavailable to other teams for remainder of game
```

### Team Location Tracking
```
Visual Representation:
- Each team: SOLID COLOR marker on map (Blue, Red, Green, Yellow, Orange, Purple, etc)
- Always visible to ALL teams
- Shows real-time team position updates (~5 sec intervals)
- Helps with strategic play (can avoid or pursue opponents)

Team Playground Display:
- Shows team's captured tasks in a side panel
- List: "Team Red captured: Task 1, Task 3, Task 7"
- Count: "3 / 10 tasks captured"
- Visual representation (can be list or grid)
```

---

## 💣 BOMB/DANGER ZONE SYSTEM

### Bomb Feature
**Each team gets 3 bombs per game**

#### Bomb Types (Configurable):
1. **30-Second Bomb** - Fast/Short Duration
2. **1-Minute Bomb** - Medium Duration
3. **2-Minute Bomb** - Long Duration

#### How It Works:
```
Team Action:
1. Team presses "DROP BOMB" button on map
2. Selects bomb duration (30s, 1min, or 2min)
3. Selects location on map (current position or nearby)
4. Bomb placed as DANGER ZONE (red circle, 30m radius)

Effect:
- If opposing team enters danger zone during countdown:
  - Lose 300 points (if using points system)
  - OR marked as "bombed" (status indicator)
  - 2-minute cooldown before next action

Visual:
- Red pulsing circle showing 30m radius
- Countdown timer visible
- Warning when team gets close (enter radius)
- Sound/visual effect when countdown completes
```

#### Strategic Considerations:
- Teams can protect their own base by placing bombs there
- Teams can place bombs near enemy task locations to block opponents
- Teams can force opponents to take longer routes
- Limited to 3 bombs per game (strategic placement matters)

---

## 📊 TEAM IDENTIFICATION & RANKINGS

### Team Colors (Solid, Persistent)
```
Available Team Colors:
1. 🔵 Blue
2. 🔴 Red
3. 🟢 Green
4. 🟡 Yellow
5. 🟠 Orange
6. 🟣 Purple
7. 🩶 Gray
8. 🔶 Pink/Magenta

Automatic Assignment:
- First team: Blue
- Second team: Red
- Third team: Green
- etc...
(Can be randomized or selected during team setup)
```

### Real-Time Leaderboard
```
RANKING VIEW (In-Game, Always Visible):

┌─────────────────────────────┐
│  TEAM     │ CAPTURED │ BOMBS │
├─────────────────────────────┤
│ 🔴 RED    │  7 / 10  │ 💣💣 │
│ 🔵 BLUE   │  5 / 10  │ 💣💣💣 │
│ 🟢 GREEN  │  3 / 10  │ 💣   │
└─────────────────────────────┘

Updates: Real-time (every task capture, bomb placement)
Primary Ranking: Tasks Captured (not points)
Secondary: Time to capture
```

---

## ⏱️ FAILURE & COOLDOWN SYSTEM

### Wrong Answer Mechanic
```
Team attempts task and answers INCORRECTLY:
1. Feedback: "❌ Incorrect answer"
2. Status: Task remains on map
3. Cooldown: 2-MINUTE countdown before retry
4. During cooldown:
   - Team can still solve OTHER tasks
   - Cannot retry THIS specific task
   - Visual indicator shows time remaining
5. After cooldown:
   - Team can retry the task
   - Full points (or captured status) if solved
```

### Strategic Impact
```
Why 2-minute cooldown?
- Forces teams to explore more tasks
- Prevents "brute force" guessing
- Encourages team coordination
- Creates meaningful risk/reward
- Prevents single team from dominating

Example Flow:
- Team A attempts Task 1: Wrong ❌ (2-min cooldown)
- Team A moves to Task 2 while waiting
- Team A solves Task 2: Captured! ✅
- (1 minute passes)
- Team B attempts Task 1: Correct! ✅ (Captured by Team B)
- Task 1 disappears from all maps
- (1 minute passes)
- Team A can now retry Task 1, but it's gone
```

---

## 🏆 TEAM PLAYGROUNDS (Captured Tasks Display)

### Playground Structure
```
Team Playground = Personal Hall of Fame

Display:
┌─ TEAM RED'S CAPTURED TASKS ─────┐
│                                  │
│ Task 1: "Find the Hidden Code"   │
│ ✅ Captured at 2:34 PM          │
│                                  │
│ Task 3: "Answer the Question"    │
│ ✅ Captured at 3:12 PM          │
│                                  │
│ Task 7: "Solve the Riddle"       │
│ ✅ Captured at 4:01 PM          │
│                                  │
│ Progress: 3 / 10 Tasks Captured  │
└──────────────────────────────────┘
```

### Visibility
```
Team's Own Playground:
- Full details visible to team members
- Shows all captured tasks with timestamps
- Shows progress percentage

Other Teams' Playgrounds:
- Can see captured count (e.g., "Red: 3 captured")
- Can see task list (knowing which tasks are eliminated)
- Helps strategy (avoid already-captured tasks)
```

---

## 🎯 ENHANCED FEATURES & VISUAL IMPROVEMENTS

### 1. **Real-Time Team Tracking**
```
Map Visualization:
- Solid color circle = team position
- Color matches team color
- Updates every 5 seconds
- Shows direction arrow (optional)
- Distance to nearest task
```

### 2. **Threat Detection**
```
When enemies are close:
- Audio alert: "⚠️ Team Red is 50m away"
- Visual pulse on team marker
- Danger zone warning if approaching bomb
```

### 3. **Task Priority Indicator**
```
Show task difficulty level:
⭐ Easy (1 star)
⭐⭐ Medium (2 stars)
⭐⭐⭐ Hard (3 stars)

Helps teams decide which tasks to prioritize
```

### 4. **Eliminated Task Indicators**
```
When task is captured:
- Becomes gray/transparent on map
- Shows "✅ Captured by Team Red"
- Can be hidden or shown (team preference)
- Helps avoid wasted navigation
```

### 5. **Bomb Countdown Visualization**
```
Visual effects:
- Red pulsing circle = danger zone radius
- Numbers counting down inside
- Sound effect at milestone (30s remaining, 10s, 5s)
- Explosion animation when detonated
```

---

## 🔧 TECHNICAL ARCHITECTURE

### New Components Required
```
1. EliminationGameMode.tsx
   - Main game view (map + leaderboard)
   - Real-time updates

2. EliminationLeaderboard.tsx
   - Live ranking display
   - Team colors & captured counts

3. TeamPlaygroundView.tsx
   - Shows captured tasks per team
   - Accessible during gameplay

4. BombPlacementModal.tsx
   - Select bomb type
   - Choose location on map
   - Countdown management

5. EliminationTaskCard.tsx
   - Task info on map
   - Elimination status
   - Difficulty level
```

### Data Model Extensions
```typescript
interface EliminationGame extends Game {
  gameMode: 'elimination';
  teamColors: Record<string, string>; // Team ID -> Color
  capturedTasks: Record<string, string>; // Task ID -> Team ID who captured
  failedAttempts: Record<string, {teamId: string; timestamp: number}[]>;
  bombs: {
    teamId: string;
    location: Coordinate;
    duration: 30 | 60 | 120; // seconds
    createdAt: number;
    detonatesAt: number;
  }[];
  teamPlaygrounds: Record<string, string[]>; // Team ID -> Captured Task IDs
}
```

---

## 🎮 GAME FLOW

### Pre-Game Setup
```
1. Game Creator:
   - Selects ELIMINATION mode
   - Configures task locations (GPS coordinates)
   - Adds 8-15 tasks to game
   - Sets game duration (15-60 min)

2. Team Setup:
   - Assign team colors
   - Assign team names
   - Enter QR/team name to join

3. Game Briefing:
   - Show all teams initial map
   - Explain rules (2-min cooldown, bombs, etc)
   - Countdown to start (30 seconds)
```

### During Game
```
1. Real-time Map:
   - See all tasks (numbered pins)
   - See all team locations (colored circles)
   - See danger zones (red circles with countdown)
   - See captured tasks status

2. Team Actions:
   - Navigate to task location
   - Solve task (answer question, scan QR, etc)
   - If correct: Task captured ✅
   - If incorrect: 2-min cooldown ❌

3. Strategic Actions:
   - Drop bombs near enemy locations
   - Avoid danger zones
   - Plan route to uncaptured tasks
   - Check team playground progress

4. Leaderboard Updates:
   - Real-time ranking
   - Team captured count
   - Bombs remaining
```

### End Game
```
1. Game Ends When:
   - All tasks captured, OR
   - Time runs out, OR
   - One team captures 5+ tasks (if configurable)

2. Final Results:
   - Team with most captured tasks: WINNER 🏆
   - Show final leaderboard
   - Show each team's captured playground
   - Option to play again
```

---

## 📋 FEATURE COMPARISON: Playzone vs ELIMINATION

| Feature | Playzone | ELIMINATION |
|---------|----------|-------------|
| **Navigation Type** | Indoor, touch-based | Outdoor, GPS |
| **Map View** | Hidden | Central (showing all) |
| **Task Visibility** | Always visible to team | Disappears when captured |
| **Team Locations** | Hidden | Always visible (all teams) |
| **Leaderboard** | Task count | Captured task count |
| **Cooldown** | None | 2 minutes on fail |
| **Bombs** | No | Yes (3 per team) |
| **Teamplaygrounds** | Yes (side popup) | Yes (central leaderboard) |
| **Real-Time Updates** | Periodic | Instant |
| **Competitive** | Semi | Highly |
| **Strategy Depth** | Low-Medium | High |

---

## 🎯 SUCCESS CRITERIA

### Functional Requirements
- ✅ GPS-based task placement on map
- ✅ Real-time team location tracking
- ✅ Task elimination when captured
- ✅ 2-minute cooldown on wrong answers
- ✅ Bomb/danger zone system (3 per team)
- ✅ Team color assignment (solid colors)
- ✅ Captured task leaderboard (real-time)
- ✅ Team playgrounds showing captured tasks
- ✅ Live in-game updates

### User Experience
- ✅ Intuitive map interface
- ✅ Clear team identification (colors)
- ✅ Real-time feedback on actions
- ✅ Strategic depth (bombs, cooldowns)
- ✅ Competitive engagement
- ✅ Mobile-optimized gameplay

### Performance
- ✅ <200ms map update latency
- ✅ Smooth real-time team tracking
- ✅ Responsive UI during gameplay

---

## 🚀 IMPLEMENTATION PHASES

### Phase 1: Core Map System (Week 1)
- [ ] Extend Game type with elimination fields
- [ ] Create EliminationGameMode component
- [ ] Implement GPS task placement
- [ ] Show team locations on map

### Phase 2: Task Elimination (Week 1-2)
- [ ] Implement task capture logic
- [ ] Hide/gray eliminated tasks
- [ ] 2-minute cooldown system
- [ ] Show captured status in leaderboard

### Phase 3: Team Playgrounds & Leaderboard (Week 2)
- [ ] Create TeamPlaygroundView component
- [ ] Real-time leaderboard display
- [ ] Team color assignment
- [ ] Captured task tracking

### Phase 4: Bomb System (Week 2-3)
- [ ] Create BombPlacementModal
- [ ] Implement danger zone visualization
- [ ] 300-point penalty system
- [ ] Bomb countdown management

### Phase 5: Polish & Enhancement (Week 3-4)
- [ ] Threat detection (proximity warnings)
- [ ] Task difficulty indicators
- [ ] Visual improvements
- [ ] Performance optimization
- [ ] Testing & bug fixes

---

## 🎨 VISUAL CONCEPTS

### Map Visualization
```
Legend:
  📍 = Task location (numbered: 1, 2, 3, etc)
  🔵 = Team location (solid color per team)
  ❌ = Captured task (grayed out)
  💣 = Danger zone (red pulsing circle)
  🏁 = Team base/spawn point
```

### Team Colors (Unique per Team)
```
Team 1: 🔵 Blue (#3B82F6)
Team 2: 🔴 Red (#EF4444)
Team 3: 🟢 Green (#10B981)
Team 4: 🟡 Yellow (#FBBF24)
Team 5: 🟠 Orange (#F97316)
Team 6: 🟣 Purple (#A855F7)
Team 7: 🩶 Gray (#6B7280)
Team 8: 🔶 Pink (#EC4899)
```

---

## 📊 NEXT STEPS

1. **Planning Review** - Approve this plan
2. **Database Schema** - Design elimination game data model
3. **API Endpoints** - Create endpoints for:
   - Task capture
   - Bomb placement
   - Real-time team location
   - Cooldown management
4. **UI Implementation** - Build components
5. **Testing** - Comprehensive testing
6. **Deployment** - Launch ELIMINATION mode

---

