# Project Configuration

## Workflow Preferences
- When the user selects/prioritizes a specific task from a list, always continue with the remaining tasks automatically after completing the selected one. Never stop after just the prioritized task.

## Branch Strategy
- Always work directly on the `orbit-world` branch. Do NOT create new branches or worktrees.
- Push commits directly to `origin/orbit-world`.

## Startup
- At the start of every conversation, run `npm install` (if node_modules is missing) and then `npx vite --open` in the background so the app is always live in the browser with HMR.
