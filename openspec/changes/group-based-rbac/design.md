## Context

See [proposal.md](proposal.md) for motivation.

Meridian's architecture uses a Node.js/TypeScript backend (`server/index.ts`, `server/socket.ts`, `server/db.ts`) with MongoDB persistence and resilient local JSON fallback, paired with a React 18/Vite frontend using Zustand stores. Currently, any operator action (such as manual task override, DAG edge linking, custom node creation, and SSH script probing) executes with a generic `"Operator"` identifier without role or capability restrictions.

## Goals / Non-Goals

**Goals:**
- Provide a clean, maintainable Group-Based Access Control model where users belong to groups, and groups hold granular permissions.
- Calculate effective user permissions via the mathematical union of all groups to which a user belongs.
- Protect all sensitive backend REST endpoints and WebSocket mutative messages with server-side authorization middleware.
- Adapt the frontend dynamically: hide or disable controls that the active operator does not possess permission to execute.
- Include pre-seeded default system groups (`Viewers`, `L1 Operators`, `L2 Engineers`, `Supervisors / VP`, `System Admins`) with immediate operational utility.
- Maintain full offline resilience: user and group definitions persist in both MongoDB and the local fallback `meridian_state.json`.

**Non-Goals:**
- Integrating enterprise OAuth2/OIDC/SAML providers (e.g. Okta, Azure AD) in this phase.
- Implementing row-level access control on specific individual task IDs (permissions are capability-based across pipelines).
- Requiring database password hashes for local operator switching (users are selected via active operational personas/profiles for streamlined trading desk usability).

## Decisions

### 1. Group-Based Inheritance over Flat Roles
- **Decision:** Users are assigned to one or more `GroupRecord` instances. Each group contains an array of `PermissionKey` strings. A user's effective permissions are computed as the union set of permissions from all assigned groups.
- **Rationale:** A flat single-role enum (e.g., just `L1`, `L2`) lacks the flexibility to grant cross-functional responsibilities (such as granting an L1 operator temporary permission to run an automation script probe without giving full supervisor rights).
- **Alternatives Considered:** Direct user-to-permission mapping (hard to manage at scale; groups provide natural organizational grouping).

### 2. Namespaced String Identifiers for Permissions
- **Decision:** Use strings formatted as `<domain>:<action>` (e.g. `dag:view`, `dag:advance`, `dag:override_ok`, `dag:edit_topology`, `ssh:run_probe`, `ssh:manage_vault`, `automation:manage`, `audit:export`, `admin:rbac_manage`).
- **Rationale:** Human-readable, self-documenting in audit logs and MongoDB documents, and easily expandable.
- **Alternatives Considered:** Bitmask flags (faster in memory, but difficult to inspect in MongoDB and brittle when adding permissions).

### 3. Dual-Layer Enforcement (Server Middleware + Frontend Hook)
- **Decision:** Enforce authorization on the backend (REST HTTP 403 status + WebSocket rejection) AND on the frontend (via a `usePermissions` hook and Zustand state that controls UI element rendering).
- **Rationale:** UI hiding improves UX, but server-side rejection is mandatory to prevent unauthorized network requests or malicious WebSocket payloads.

### 4. Operator Identity Transport via Header & Socket Hello
- **Decision:** Clients pass their active user identifier via the `X-Operator-Id` HTTP header for REST calls, and inside the initial `CLIENT_HELLO` WebSocket handshake.
- **Rationale:** Allows seamless pairing with Meridian's existing trading shift persona switcher, without requiring complex JWT cookie ceremony during local offline operation.

## Data Models

```typescript
export type PermissionKey =
  | 'dag:view'             // View DAG flowchart, shifts, and file manifests
  | 'dag:advance'          // Advance task from Open -> In Progress -> Completed
  | 'dag:override_ok'      // Execute manual "Set to OK" with reason
  | 'dag:edit_topology'    // Drag-and-drop link/unlink edges, create custom nodes
  | 'ssh:run_probe'        // Run interactive SSH test probe
  | 'ssh:manage_vault'     // View/edit central server SSH credentials
  | 'automation:manage'    // Configure script paths, intervals, and match patterns
  | 'audit:export'         // Export compliance audit trails
  | 'admin:rbac_manage';   // Manage users, groups, and role assignments

export interface GroupRecord {
  id: string;               // e.g., 'grp_l1_operators'
  name: string;             // 'L1 Operations'
  description: string;
  permissions: PermissionKey[];
  isSystem?: boolean;
  createdAt: string;
}

export interface UserRecord {
  id: string;               // e.g., 'usr_omkar'
  username: string;         // 'omkar.m'
  displayName: string;      // 'Omkar Mondkar'
  roleTitle: string;        // 'Morning Shift Lead'
  groupIds: string[];       // Many-to-many group assignments
  isActive: boolean;
  createdAt: string;
}
```

## Pre-Seeded Default System Groups

| Group ID | Display Name | Assigned Permissions |
|---|---|---|
| `grp_viewers` | Viewers | `dag:view` |
| `grp_l1_operators` | L1 Operators | `dag:view`, `dag:advance` |
| `grp_l2_engineers` | L2 Engineers | `dag:view`, `dag:advance`, `dag:override_ok`, `ssh:run_probe` |
| `grp_supervisors` | Supervisors / VP | `dag:view`, `dag:advance`, `dag:override_ok`, `dag:edit_topology`, `ssh:run_probe`, `audit:export` |
| `grp_admins` | System Admins | All permissions (`admin:rbac_manage`, `ssh:manage_vault`, `automation:manage`, etc.) |

## Risks / Trade-offs

- **[Risk]** Clients might forge `X-Operator-Id` if running in an untrusted network.
  → **Mitigation:** In corporate trading intranet environments, Meridian operates behind reverse proxy authentication. For high-security setups, an optional shared API secret/session cookie can be enabled in `.env`.
- **[Risk]** Pre-seeded groups could be accidentally modified or deleted by users.
  → **Mitigation:** System groups will carry `isSystem: true` which prevents deletion from the UI or API.
- **[Risk]** Missing permissions could cause silent UI failures.
  → **Mitigation:** Buttons that are disabled due to permissions will display clear, actionable tooltips (e.g., *"Requires 'dag:override_ok' permission (L2 / Supervisor)"*).

## Migration Plan

1. On server startup, `MeridianDatabase` checks the `groups` and `users` collections (or fallback JSON).
2. If empty, the system automatically inserts the default system groups and initial operators.
3. Existing task states, custom nodes, audit logs, and edge overrides remain 100% backward-compatible and unaffected.
