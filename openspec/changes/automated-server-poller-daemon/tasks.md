## 1. Security & SSH Engine

- [x] 1.1 Install `ssh2` and `@types/ssh2` dependencies
- [x] 1.2 Implement AES-256-GCM crypto utility in `server/crypto.ts` with automatic key derivation
- [x] 1.3 Implement SSH connection manager and runner in `server/ssh.ts` with execution timeouts and error handling

## 2. MongoDB Credential Vault & REST Endpoints

- [x] 2.1 Extend `server/db.ts` with `system_settings` and `automation_rules` storage methods
- [x] 2.2 Add SSH settings and test handshake endpoints (`GET/POST /api/settings/ssh`, `POST /api/settings/ssh/test`) in `server/index.ts`
- [x] 2.3 Add task automation rule endpoints (`GET/PUT /api/automation/:taskId`, `POST /api/automation/test`) in `server/index.ts`

## 3. UI Automation Configuration & Live Probe Runner

- [x] 3.1 Create SSH Connection Settings modal in `src/components/shell/SshSettingsModal.tsx`
- [x] 3.2 Add Automation & Poller configuration tab in `ExchangeFileInspector.tsx` for script paths, exit codes, and regex/JSON rules
- [x] 3.3 Add interactive "Run Probe Now" terminal runner in the inspector displaying stdout, stderr, and match evaluation

## 4. Background Poller Daemon & Real-Time Broadcast

- [x] 4.1 Implement automated polling loop in `server/poller.ts` with DAG-aware queue and circuit breaker
- [x] 4.2 Wire auto-completion events to MongoDB audit log and WebSocket broadcast hub
- [x] 4.3 Add Poller status chip (`POLLER: ACTIVE`) in the dashboard header

## 5. Testing & Verification

- [x] 5.1 Test interactive probe runner against target script paths
- [x] 5.2 Validate TypeScript compilation and production build cleanliness
