# Project Configuration

## Workflow Preferences
- When the user selects/prioritizes a specific task from a list, always continue with the remaining tasks automatically after completing the selected one. Never stop after just the prioritized task.

## Startup
- At the start of every conversation, run `npm install` (if node_modules is missing) and then `npx vite --open` in the background so the app is always live in the browser with HMR.

## Code Sync
- Always merge the latest code from all other branches/worktrees before starting work. The user always wants the newest version.
- Keep commits, local files, and GitHub in sync. Commit and push regularly so nothing is out of date.
