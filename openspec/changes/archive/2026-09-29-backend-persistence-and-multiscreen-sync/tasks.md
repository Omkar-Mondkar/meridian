## 1. Backend Server & Persistence Engine (MongoDB + Fallback)

- [x] 1.1 Install backend dependencies (`mongodb`, `ws`, `@types/ws`) and add npm dev scripts (`dev:server`, `dev:all`) in `package.json`
- [x] 1.2 Build resilient database adapter in `server/db.ts` connecting to MongoDB (`mongodb://localhost:27017/meridian`) with automatic local JSON fallback (`data/meridian_state.json`)
- [x] 1.3 Implement HTTP REST endpoints (`GET /api/tasks`, `POST /api/tasks/override`, `GET /api/tasks/audit`, `GET /api/health`) in `server/index.ts`

## 2. Real-Time WebSocket Protocol

- [x] 2.1 Implement WebSocket connection manager and broadcast engine in `server/socket.ts`
- [x] 2.2 Wire server event dispatchers for `SYNC_INIT`, `TASK_UPDATE`, `TASK_OVERRIDE`, and `NODE_CREATE`

## 3. Frontend Client Integration & State Hydration

- [x] 3.1 Create WebSocket sync client in `src/lib/syncClient.ts` with auto-reconnect and state change listener
- [x] 3.2 Update `src/stores/useTaskStore.ts` to hydrate from server and synchronize mutations in real-time
- [x] 3.3 Add connection status chip (`LIVE SYNC` / `LOCAL CACHE`) in `AppShell` header or `TasksTab` toolbar

## 4. Multi-Screen Verification & Testing

- [x] 4.1 Verify multi-screen real-time synchronization between two browser sessions
- [x] 4.2 Verify persistence across page refresh and server restarts
- [x] 4.3 Validate TypeScript compilation and build cleanliness
