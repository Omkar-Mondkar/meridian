## Why

Meridian is currently running as a purely client-side React single-page application. When multiple market operations team members (e.g., L1 operators, shift leads, and managers) have the dashboard open simultaneously on trade floor screens or personal workstations, task completions, "Manual Set to OK" overrides, and custom node additions are not shared across screens and vanish upon browser refresh.

Providing a lightweight persistence and multi-screen synchronization backend ensures that:
1. All trade floor screens stay perfectly synchronized in real time (<500ms latency).
2. All manual status overrides, execution events, and audit logs are persistently recorded on disk.
3. The dashboard remains resilient and gracefully falls back to client-side state if the backend is unreachable.

## What Changes

- Add a lightweight Node.js/TypeScript backend service (`server/`) with REST APIs and WebSocket server.
- Add persistent storage for task states, "Manual Set to OK" audit logs, and custom dynamic nodes.
- Implement real-time WebSocket event broadcasting for task status transitions, manual overrides, and node creation.
- Add client-side WebSocket client hook/store adapter in `useTaskStore.ts` with auto-reconnection, optimistic UI updates, and server synchronization on connect.
- Add a live connectivity status indicator in the dashboard header (`LIVE SYNC` / `LOCAL CACHE`).

## Capabilities

### New Capabilities
- `backend-persistence`: Persistent storage engine and REST API for checklist task states, audit logs ("Manual Set to OK" reason/timestamp/persona), and operator-created nodes.
- `multiscreen-sync`: Real-time bidirectional WebSocket synchronization protocol broadcasting task transitions, node creation, and manual overrides to all active clients.

### Modified Capabilities
<!-- None: existing dynamic-tasks-dag and exchange-file-inspector requirements remain fully compatible -->

## Impact

- **Backend**: New lightweight backend server running on port 3001 (or configurable) with WebSocket support.
- **Frontend Stores**: `useTaskStore.ts` updated to hydrate initial state from backend REST API and listen/emit via WebSocket, maintaining offline resilience.
- **Dependencies**: Add lightweight runtime packages (`ws` or native WebSocket, `better-sqlite3` or file-backed JSON/SQLite store) and dev scripts (`npm run dev:all`).
- **UI**: Added subtle connection status chip in dashboard header.
