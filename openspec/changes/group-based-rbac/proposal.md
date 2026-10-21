## Why

Meridian is evolving from a single-operator checklist viewer into a multi-operator trading operations dashboard with automated SSH probes, DAG pipeline restructuring, and sensitive credential vaults. Currently, any client connected to the application can execute overrides, modify the DAG topology, trigger server-side script probes, or view SSH settings.

To ensure strict operational integrity, compliance auditability, and team segregation across L1 operators, L2 engineers, supervisors/VPs, and administrators, Meridian requires a robust, group-based Role-Based Access Control (RBAC) model. Users belong to functional groups with granular permissions that gate backend operations and dynamically adapt the UI.

## What Changes

- **User and Group Entities**: Introduce User and Group schemas with many-to-many group membership and granular permission assignments.
- **Granular Permission Matrix**: Establish dedicated permission keys covering DAG viewing (`dag:view`), status progression (`dag:advance`), manual overrides (`dag:override_ok`), DAG topology editing (`dag:edit_topology`), SSH test probing (`ssh:run_probe`), SSH vault management (`ssh:manage_vault`), and automation rule configuration (`automation:manage`).
- **Pre-Seeded Operational Groups**: Provide default system groups (`Viewers`, `L1 Operators`, `L2 Engineers`, `Supervisors / VP`, and `System Admins`) with immediate sensible defaults.
- **Backend Route & Socket Middleware**: Protect REST endpoints (`/api/tasks/override`, `/api/tasks/edge`, `/api/tasks/custom-node`, `/api/automation/probe`, `/api/settings/ssh`) and incoming WebSocket actions by validating user entitlements against group permissions.
- **Audit Event Enrichment**: All audit log entries will record the authenticated operator ID, display name, and active group role.
- **Frontend Permission-Aware UI**: Adapt UI components (hide or disable "✏️ Edit DAG", "Set to OK", "Run Live Test Probe", and "⚙ SSH Vault") based on the current user's aggregated permission set.
- **Active User & Group Switcher**: Provide an intuitive persona/user switch mechanism in the shell header to test, audit, and transition between active operator roles.

## Capabilities

### New Capabilities
- `group-based-rbac`: User and group schemas, granular permission matrix, permission aggregation, REST/WebSocket authorization guards, and access management UI.

### Modified Capabilities
- `dynamic-tasks-dag`: Guard DAG edge modifications, node creation, and manual task status overrides behind specific permission requirements (`dag:edit_topology`, `dag:override_ok`).

## Impact

- **Backend**:
  - `server/db.ts`: Add `UserRecord`, `GroupRecord`, and persistence methods in MongoDB (`users`, `groups` collections) with local JSON fallback.
  - `server/auth.ts`: Authentication & authorization resolver, permission aggregation helpers, and route middleware.
  - `server/index.ts`: Gate operational endpoints with permission checks.
  - `server/socket.ts`: Authenticate client actions before dispatching state mutations.
- **Frontend**:
  - `src/stores/useTaskStore.ts` & `src/stores/useAuthStore.ts`: Track authenticated user and compute effective permissions.
  - `src/features/tasks/TaskDagCanvas.tsx`: Gate Edit DAG mode and edge dragging.
  - `src/features/tasks/TaskNodeCard.tsx`: Gate quick Set-to-OK and port interactions.
  - `src/components/shell/Header.tsx`: Display active user/group badge and user switcher.
- **Data & Migration**:
  - Pre-seed default groups and demo users in local storage/MongoDB on startup.
