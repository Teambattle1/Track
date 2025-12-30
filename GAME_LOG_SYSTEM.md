# Game Change Log System

A comprehensive game change tracking system with defensive coding practices for tracking major modifications, user actions, and timestamps.

## Overview

The game logging system automatically tracks:
- **Who** made changes (user ID and name)
- **When** changes occurred (timestamp)
- **What** was changed (action description)
- **Detailed metadata** about specific changes

## Components

### 1. Core Utility Functions (`utils/gameLog.ts`)

Defensive coding with explicit handling of null, undefined, and empty states.

#### `createGameLogEntry()`
Creates a new log entry with validation.

```typescript
const entry = createGameLogEntry(
  action: "Updated task scoring system",
  userId: "user-123",
  userName: "John Smith",
  details?: { oldScore: 100, newScore: 150 }
);
```

**Defensive Features:**
- Validates action is non-empty string
- Validates userId exists and is string
- Defaults userName to "Unknown User" if invalid
- Filters out circular references in metadata
- Returns null if validation fails

**Parameters:**
- `action` (string | null | undefined): Description of the change
- `userId` (string | null | undefined): User ID who made the change
- `userName` (string | null | undefined): Display name of user
- `details` (object, optional): Additional change metadata

**Returns:** `GameChangeLogEntry | null`

#### `logGameChange()`
One-step function to create and add a log entry to a game.

```typescript
const updatedGame = logGameChange(
  game,
  "Added 10 new tasks",
  authUser?.id,
  authUser?.name,
  { taskCount: 10, totalTasks: 45 }
);
```

**Returns:** Updated game object with new log entry, or null if failed

#### `getFormattedLogs()`
Retrieves formatted log entries for display.

```typescript
const logs = getFormattedLogs(game, limit?: 50);

// Returns array of objects:
// {
//   timestamp: 1234567890,
//   date: "Jan 15, 2024",
//   time: "02:30:45 PM",
//   user: "user-123",
//   action: "Updated game title"
// }
```

**Features:**
- Safely validates all log entries
- Formats timestamps into readable date/time
- Sorts by newest first
- Optional limit parameter
- Returns empty array if no logs found

#### `getGameLogStats()`
Gets statistics about game changes.

```typescript
const stats = getGameLogStats(game);

// Returns:
// {
//   totalChanges: 42,
//   uniqueUsers: 3,
//   latestChange: Date object,
//   earliestChange: Date object
// }
```

#### `exportGameLog()`
Exports logs as JSON for external use.

```typescript
const json = exportGameLog(game);
// Returns JSON string or null if failed
// Includes game metadata and all log entries
```

#### `clearGameLog()`
Administrative function to clear change history.

```typescript
const clearedGame = clearGameLog(game, "Migration to new system");
```

### 2. UI Component (`components/GameLogViewer.tsx`)

React component to display game change logs in the Game Creator.

**Features:**
- Stats dashboard (total changes, contributors, date range)
- Sortable log list with user/date/time/action
- Export to JSON functionality
- Empty state messaging
- Responsive design
- Defensive rendering (handles null/undefined game)

**Props:**
```typescript
interface GameLogViewerProps {
  game: Game | null | undefined;
}
```

**Usage:**
```tsx
<GameLogViewer game={currentGame} />
```

## Integration in App

### Where Logs Are Created

Currently, logs are created in `components/App.tsx` in the `updateActiveGame` function:

```typescript
const changeEntry: GameChangeLogEntry = {
    timestamp: Date.now(),
    user: authUser?.name || 'Unknown',
    action: changeDescription
};

const gameToSave = {
    ...updatedGame,
    changeLog: [...(updatedGame.changeLog || []), changeEntry]
};
```

### Adding Custom Logs

To log additional game changes in the future:

```typescript
import { logGameChange } from '../utils/gameLog';

// When making a game update
const updatedGame = logGameChange(
  game,
  "Deleted 5 tasks",
  authUser?.id,
  authUser?.name,
  { deletedTaskIds: ['t1', 't2', 't3', 't4', 't5'] }
);

// Use the updated game with log entry
await updateActiveGame(updatedGame, "Deleted 5 tasks");
```

## Defensive Coding Practices

The system implements comprehensive defensive coding:

### 1. Null/Undefined Checks
```typescript
// Input validation
if (!game || typeof game !== 'object') {
  return null;
}

// Type guards
const changeLog = Array.isArray(game.changeLog) ? game.changeLog : [];
```

### 2. Safe String Handling
```typescript
// Trim and validate
const trimmedAction = action.trim();
if (trimmedAction.length === 0) {
  console.warn('[gameLog] Action string is empty');
  return null;
}

// Default fallback
const user = entry.user && typeof entry.user === 'string' 
  ? entry.user 
  : 'Unknown User';
```

### 3. Safe Type Conversion
```typescript
// Date validation
let dateObj: Date;
try {
  dateObj = new Date(entry.timestamp);
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }
} catch (e) {
  console.warn('[gameLog] Invalid timestamp:', entry.timestamp);
  dateObj = new Date();
}
```

### 4. Safe Serialization
```typescript
// Try to serialize, but don't fail if it can't
try {
  (logEntry as any).metadata = JSON.stringify(details);
} catch (e) {
  console.warn('[gameLog] Could not stringify metadata:', e);
  // Continue without metadata
}
```

### 5. Array Length Limits
```typescript
// Prevent unbounded growth
const MAX_HISTORY = 1000;
if (changeLog.length > MAX_HISTORY) {
  console.warn(`[gameLog] Change log exceeded ${MAX_HISTORY} entries`);
  changeLog.splice(0, changeLog.length - MAX_HISTORY);
}
```

## Database Schema

The `GameChangeLogEntry` type in `types.ts`:

```typescript
export interface GameChangeLogEntry {
    timestamp: number;      // Unix timestamp in milliseconds
    user: string;           // User ID or name
    action: string;         // Description of the change
}
```

Games store logs in the `changeLog` array:

```typescript
export interface Game {
    // ... other fields ...
    changeLog?: GameChangeLogEntry[];
}
```

## Usage Examples

### Example 1: Track Task Addition
```typescript
const newTask: GamePoint = { /* ... */ };

const updatedGame = logGameChange(
  currentGame,
  `Added task: "${newTask.title}"`,
  authUser?.id,
  authUser?.name,
  {
    taskId: newTask.id,
    taskTitle: newTask.title,
    points: newTask.points
  }
);
```

### Example 2: Track Game Settings Change
```typescript
const updatedGame = logGameChange(
  game,
  "Changed game language from Danish to English",
  authUser?.id,
  authUser?.name,
  {
    oldLanguage: 'Danish',
    newLanguage: 'English'
  }
);
```

### Example 3: Track Bulk Operations
```typescript
const deletedTaskIds = ['task1', 'task2', 'task3'];

const updatedGame = logGameChange(
  game,
  `Deleted ${deletedTaskIds.length} tasks`,
  authUser?.id,
  authUser?.name,
  { deletedTaskIds }
);
```

### Example 4: View Game History
```tsx
function GameSettings({ game }) {
  return (
    <div>
      <GameLogViewer game={game} />
    </div>
  );
}
```

## Best Practices

1. **Always include a descriptive action**
   ```typescript
   // Good
   "Updated task 'Hidden Flag' scoring from 100 to 150 points"
   
   // Bad
   "Modified game"
   ```

2. **Include relevant metadata when possible**
   ```typescript
   // Good
   logGameChange(game, "Deleted zone", userId, userName, {
     zoneName: "Central Park",
     taskCount: 5
   })
   ```

3. **Use consistent action descriptions**
   ```typescript
   // Start with action verb
   "Added ...", "Updated ...", "Deleted ...", "Changed ..."
   ```

4. **Handle errors gracefully**
   ```typescript
   const result = logGameChange(game, action, userId, userName);
   if (!result) {
     console.error('Failed to log change');
     // Still save game, just without log entry
   }
   ```

## Troubleshooting

### Log entries not appearing
- Check that game has `changeLog` array defined
- Verify user ID and name are not null
- Check browser console for warning messages

### Performance issues with large logs
- Logs are automatically trimmed at 1000 entries
- Use `getFormattedLogs(game, limit: 50)` to limit display
- Export and archive old logs periodically

### Export not working
- Ensure game object is valid and not null
- Check that changeLog entries are serializable
- Verify browser can create/download files

## Future Enhancements

Potential improvements to the logging system:

1. **Diff Tracking**: Store before/after state for complex changes
2. **User IP Logging**: Track IP address for security audit
3. **Webhook Integration**: Send logs to external audit system
4. **Log Retention Policy**: Automatic archival of old logs
5. **Log Signing**: Cryptographic signature for tamper detection
6. **Filtered Exports**: Export logs filtered by user or date range

## Related Files

- `utils/gameLog.ts` - Core logging utilities
- `components/GameLogViewer.tsx` - UI component
- `components/GameCreator.tsx` - Integration point (LOGS tab)
- `components/App.tsx` - Where logs are created
- `types.ts` - GameChangeLogEntry type definition
