## 1. Database & Schema Foundation

- [x] 1.1 Define `PermissionKey`, `GroupRecord`, and `UserRecord` TypeScript interfaces in `server/db.ts`
- [x] 1.2 Implement pre-seeded default system groups (`Viewers`, `L1 Operators`, `L2 Engineers`, `Supervisors / VP`, `System Admins`) and default initial operators
- [x] 1.3 Add CRUD and lookup methods (`getUsers`, `getUserById`, `saveUser`, `getGroups`, `saveGroup`, `getUserPermissions`) to `MeridianDatabase` with MongoDB and JSON fallback persistence
- [x] 1.4 Add REST endpoints `GET /api/rbac/users`, `GET /api/rbac/groups`, `POST /api/rbac/user`, and `POST /api/rbac/group` in `server/index.ts`

## 2. Server Authorization Middleware & WebSocket Guard

- [x] 2.1 Create `server/auth.ts` with operator resolution and authorization guard middleware (`requirePermission`)
- [x] 2.2 Wire permission checks into REST endpoints in `server/index.ts`: `/api/tasks/override` (`dag:override_ok`), `/api/tasks/edge` (`dag:edit_topology`), `/api/tasks/custom-node` (`dag:edit_topology`), `/api/automation/probe` (`ssh:run_probe`), and `/api/settings/ssh` (`ssh:manage_vault`)
- [x] 2.3 Add authorization validation to `MeridianSocketHub` in `server/socket.ts` for incoming `TASK_OVERRIDE`, `EDGE_UPDATE`, and `NODE_CREATE` events
- [x] 2.4 Include authenticated operator identity, display name, and active group role on all generated audit log records

## 3. Frontend Store & Permissions Hook

- [x] 3.1 Create `src/stores/useAuthStore.ts` managing active user, group assignments, and cached effective permissions
- [x] 3.2 Update `src/lib/syncClient.ts` to transmit active operator identity in HTTP headers (`X-Operator-Id`) and WebSocket `CLIENT_HELLO`
- [x] 3.3 Create a `usePermissions` hook providing convenience check functions (`hasPermission(perm)`, `canEditDag`, `canOverrideOk`, `canRunProbe`, `canManageVault`)

## 4. UI Components & Entitlement Gating

- [x] 4.1 Update `src/components/shell/Header.tsx` with active operator badge and persona/group switcher dropdown
- [x] 4.2 Gate the "✏️ Edit DAG" button and drag-and-drop connection ports in `src/features/tasks/TaskDagCanvas.tsx` and `src/features/tasks/TaskNodeCard.tsx` behind `dag:edit_topology`
- [x] 4.3 Gate the "Set to OK" quick buttons and Inspector manual override actions behind `dag:override_ok` with explanatory disabled tooltips
- [x] 4.4 Gate the "Run Live Test Probe" button in `src/features/tasks/AutomationPollerTab.tsx` behind `ssh:run_probe`
- [x] 4.5 Gate the `⚙ SSH Vault` modal in `src/components/shell/SshSettingsModal.tsx` behind `ssh:manage_vault`

## 5. Verification & End-to-End Validation

- [x] 5.1 Verify that Viewers can only observe and cannot edit DAG, advance tasks, or run probes
- [x] 5.2 Verify that L1 Operators can advance tasks but cannot perform manual OK overrides or edit DAG topology
- [x] 5.3 Verify that L2 Engineers can perform manual OK overrides and run script probes
- [x] 5.4 Verify that Supervisors can edit DAG edges via drag-and-drop and add custom nodes
- [x] 5.5 Verify that System Admins have full access to SSH Vault and automation rule configurations
- [x] 5.6 Run complete TypeScript build (`npm run build`) and verify end-to-end multi-operator behavior
