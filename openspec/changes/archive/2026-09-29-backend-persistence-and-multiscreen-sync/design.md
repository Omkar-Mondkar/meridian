## Context

See `proposal.md` for motivation. Meridian currently runs as a standalone client-side SPA. To support multi-screen trade operations, we need a lightweight backend service that persists operational state and propagates updates to all screens in real-time.

## Goals / Non-Goals

**Goals:**
- Provide a zero-friction lightweight backend server in TypeScript/Node that can run via `npm run dev:server` or concurrently with Vite (`npm run dev:all`).
- Store operational checklist statuses, custom DAG nodes, and "Manual Set to OK" audit logs persistently on disk in `data/meridian_state.json` / SQLite.
- Maintain sub-100ms real-time broadcast of all state mutations via WebSocket to all connected browser tabs and screens.
- Keep the frontend fully operational even if the backend is down (graceful degradation, optimistic updates, auto-reconnect).

**Non-Goals:**
- Heavy enterprise auth/SSO migration (handled in Phase 7).
- Full market data feed ingestion over this socket (market feeds use separate dedicated proxies).
- Cloud-hosted external database dependencies (e.g. Atlas or AWS RDS) for local dev.

## Decisions

### 1. MongoDB Primary with Resilient Local JSON Fallback
- **Decision**: Use MongoDB as the primary persistent data store (`mongodb://localhost:27017/meridian` via `mongodb` driver) with an automatic embedded JSON fallback (`data/meridian_state.json`).
- **Rationale**:
  - Aligns with Design Doc §9.5 (`task_completion_events` collection).
  - Perfect document model for dynamic DAG nodes, variable audit metadata, and NetApp manifest snapshots.
  - Resilience: If MongoDB is restarting or temporarily unreachable, the store automatically falls back to an embedded local JSON store so the dashboard never crashes or drops writes.
- **Collections**:
  - `tasks`: active task statuses and override states
  - `task_events`: append-only audit trail (`taskId`, `action`, `operator`, `reason`, `timestamp`)
  - `custom_nodes`: operator-created dynamic DAG nodes

### 2. Native WebSocket Protocol with Typed Action Payloads
- **Decision**: Use the standard `ws` library with strongly typed action packets:
  - `SYNC_INIT`: Sent to newly connected clients with full tasks snapshot, custom nodes, audit logs, and db status (`mongodb` or `fallback`).
  - `TASK_UPDATE`: Broadcast when task status changes.
  - `TASK_OVERRIDE`: Broadcast when an operator manually sets a task to OK with audit metadata.
  - `NODE_CREATE`: Broadcast when an operator adds a custom DAG verification node.
- **Rationale**: Minimal latency, low overhead, no complex framework lock-in.

### 3. Optimistic UI Updates with Offline Resilience in Zustand
- **Decision**: Frontend applies state mutations optimistically in `useTaskStore.ts` before emitting the socket event. If offline, mutations persist in browser memory and local storage, and the header displays a `LOCAL (OFFLINE)` indicator.
- **Rationale**: Prevents any UI lag on user clicks; network drops do not block operators from viewing or working with the DAG.

## Risks / Trade-offs

- [MongoDB Disconnect During Operations] → Mitigate with graceful fallback to in-memory/JSON queue and auto-reconnect back to MongoDB when restored.
- [Network Disconnect During Operations] → Mitigate with exponential backoff auto-reconnect and instant state resynchronization (`SYNC_INIT`) upon reconnection.
- [Concurrent Overwrite / Race Conditions] → Server applies monotonic timestamp checks on task state updates so earlier timestamps cannot overwrite later timestamps.
