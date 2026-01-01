# Team History Map Feature Guide

## Overview
The Team History Map feature visualizes historical team movement and task performance on the game map. It shows team paths (breadcrumb trails) and task attempt markers with color-coded status indicators.

## Feature Components

### 1. TypeScript Interfaces (`types/teamHistory.ts`)
Defines the data structure for team movement history:

```typescript
interface TaskAttempt {
  id: string;
  coordinate: { lat: number; lng: number };
  status: 'CORRECT' | 'WRONG' | 'SUBMITTED';
  timestamp: number;
  taskTitle?: string;
}

interface TeamHistory {
  teamId: string;
  teamName: string;
  color: string; // Hex color for the team's path
  path: Array<{ lat: number; lng: number; timestamp: number }>;
  tasks: TaskAttempt[];
}
```

### 2. TeamHistoryOverlay Component (`components/TeamHistoryOverlay.tsx`)
React component that renders:
- **Polylines** for team movement paths (colored per team)
- **CircleMarkers** for task attempts with traffic light colors:
  - 🟢 Green = CORRECT
  - 🔴 Red = WRONG
  - 🟡 Yellow = SUBMITTED

### 3. UI Integration

#### Access Point
- **Location**: Editor Mode → Map Toolbar → SHOW section
- **Button**: "PATH" toggle (appears only in EDIT mode)
- **Icon**: Route icon

#### How to Use
1. Open a game in **Editor Mode** (Edit View)
2. Locate the draggable **SHOW** toolbar (purple box with 4-5 buttons)
3. Click the **PATH** button (rightmost button with route icon)
4. Toggle ON to display team movement history
5. Toggle OFF to hide the overlay

### 4. Visual Display

#### Team Paths (Polylines)
- Each team has a distinct colored line
- Line weight: 4px
- Line opacity: 0.7
- Shows complete movement trail with timestamps
- Hoverable with tooltip showing team name and position count

#### Task Markers (CircleMarkers)
- Radius: 8px
- White border (2px)
- Fill color based on status:
  - **Green (#22c55e)**: Correct answer
  - **Red (#ef4444)**: Wrong answer
  - **Yellow (#eab308)**: Submitted (neutral tasks like photos)
- Tooltip displays:
  - Team name
  - Task status
  - Task title (if available)
  - Timestamp

## Demo Data Service

### Current Implementation (`services/teamHistoryDemo.ts`)
A demo service generates sample team history for testing:

```typescript
generateDemoTeamHistory(
  gameCenter: Coordinate,
  numTeams: number = 3
): TeamHistory[]
```

**Features**:
- Generates realistic movement paths between task locations
- Randomized task statuses (CORRECT/WRONG/SUBMITTED)
- 5-8 tasks per team
- Travel time simulation (5-15 minutes between tasks)
- Path interpolation for smooth trails

### Replacing with Real Data

To integrate actual team history from your database:

1. Create a new service file: `services/teamHistory.ts`
2. Implement data fetching function:

```typescript
export const fetchTeamHistory = async (
  gameId: string
): Promise<TeamHistory[]> => {
  // Query your database for:
  // - Team movement logs (GPS breadcrumbs)
  // - Task submission records
  // - Transform to TeamHistory format
  
  return teamHistoryData;
};
```

3. Update `App.tsx`:

```typescript
// Replace this:
const demoTeamHistory = useMemo(() => {
  if (!activeGame || !showTeamPaths) return [];
  const gameCenter = activeGame.points?.[0]?.location || { lat: 55.6761, lng: 12.5683 };
  return generateDemoTeamHistory(gameCenter, 3);
}, [activeGame, showTeamPaths]);

// With this:
const [teamHistory, setTeamHistory] = useState<TeamHistory[]>([]);

useEffect(() => {
  if (!activeGame || !showTeamPaths) return;
  
  fetchTeamHistory(activeGame.id).then(setTeamHistory);
}, [activeGame, showTeamPaths]);
```

## File Structure

```
types/
  └── teamHistory.ts           # TypeScript interfaces

components/
  └── TeamHistoryOverlay.tsx   # Visualization component
  └── GameMap.tsx              # Updated to render overlay
  └── GameHUD.tsx              # Updated with PATH toggle

services/
  └── teamHistoryDemo.ts       # Demo data generator

App.tsx                        # State management and wiring
```

## Technical Details

### Props Flow

```
App.tsx
  ├─> showTeamPaths (state)
  ├─> demoTeamHistory (generated data)
  │
  ├─> GameHUD
  │    ├─> showTeamPaths
  │    └─> onToggleTeamPaths={() => setShowTeamPaths(!showTeamPaths)}
  │
  └─> GameMap
       ├─> teamHistory={demoTeamHistory}
       └─> showTeamPaths={showTeamPaths}
            │
            └─> TeamHistoryOverlay
                 ├─> teams={teamHistory}
                 └─> visible={showTeamPaths}
```

### Map Bounds
The overlay uses standard React-Leaflet components (Polyline, CircleMarker) which automatically integrate with the map's bounds calculation.

## Future Enhancements

### Database Schema Recommendations

For real-time team tracking, consider these tables:

#### `team_locations` table
```sql
CREATE TABLE team_locations (
  id UUID PRIMARY KEY,
  team_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  accuracy DECIMAL(6, 2)
);
```

#### `task_attempts` table
```sql
CREATE TABLE task_attempts (
  id UUID PRIMARY KEY,
  team_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  status TEXT NOT NULL, -- 'CORRECT', 'WRONG', 'SUBMITTED'
  timestamp TIMESTAMPTZ NOT NULL,
  answer JSONB
);
```

### Additional Features
- Time-based filtering (show only last N hours)
- Team selection (toggle individual team visibility)
- Playback controls (animate path over time)
- Heat maps for popular areas
- Path comparison between teams
- Export path data as GPX files

## Troubleshooting

### PATH button not visible
- Ensure you're in **Editor Mode** (not Play/Instructor mode)
- Check that `onToggleTeamPaths` prop is passed to GameHUD

### No paths showing after toggle
- Verify `showTeamPaths` state is true
- Check that `teamHistory` data is not empty
- Look for console errors in TeamHistoryOverlay

### Performance issues with many teams
- Consider limiting the number of path points
- Implement path simplification (Douglas-Peucker algorithm)
- Use clustering for task markers when zoomed out

## Summary

The Team History Map feature is now fully integrated and functional with demo data. The PATH toggle button in the SHOW toolbar (EDIT mode only) controls the visibility of team movement trails and task attempt markers. The system is designed for easy replacement of demo data with real database queries when ready.
