## Purpose

Provides a centralized, group-based Role-Based Access Control (RBAC) mechanism for Meridian, enabling granular permission assignment to user groups, strict API/WebSocket route gating, and dynamic UI action entitlement.

## ADDED Requirements

### Requirement: User and Group Schema Definition
The system SHALL maintain User and Group entities where users belong to one or more groups and inherit the union of permissions defined across their assigned groups.

#### Scenario: User inherits permissions from assigned groups
- **WHEN** a user belongs to both "L1 Operators" (possessing `dag:advance`) and "Automation Admins" (possessing `ssh:run_probe`)
- **THEN** the system SHALL resolve the user's effective permissions to include both `dag:advance` and `ssh:run_probe`.

#### Scenario: Anonymous or unassigned user access
- **WHEN** an unauthenticated client or user with no assigned groups accesses the system
- **THEN** the system SHALL assign the default "Viewers" group with read-only (`dag:view`) permissions.

### Requirement: Granular Permission Key Matrix
The system SHALL enforce distinct permission keys controlling specific operational actions: `dag:view`, `dag:advance`, `dag:override_ok`, `dag:edit_topology`, `ssh:run_probe`, `ssh:manage_vault`, `automation:manage`, `audit:export`, and `admin:rbac_manage`.

#### Scenario: Validating specific operational capability
- **WHEN** a user requests an action requiring `dag:override_ok`
- **THEN** the system SHALL authorize the operation only if the user's effective permissions explicitly include `dag:override_ok` or `admin:rbac_manage`.

### Requirement: REST Route Authorization Middleware
The system SHALL intercept incoming REST requests on mutation and execution endpoints and reject requests lacking the required permission with HTTP 403 Forbidden.

#### Scenario: Unauthorized attempt to modify DAG topology
- **WHEN** a client sends a request to `POST /api/tasks/edge` without `dag:edit_topology` permission
- **THEN** the server SHALL reject the request with HTTP 403 and return an error message: `"Forbidden: Missing required permission 'dag:edit_topology'"`.

#### Scenario: Authorized SSH test probe execution
- **WHEN** a user possessing `ssh:run_probe` triggers `POST /api/automation/probe`
- **THEN** the server SHALL execute the probe and record an audit log entry detailing the authenticated operator.

### Requirement: WebSocket Action Authorization
The system SHALL validate client identity and permissions for all incoming WebSocket mutative events (`TASK_OVERRIDE`, `EDGE_UPDATE`, `NODE_CREATE`) before applying state changes or broadcasting to connected peers.

#### Scenario: Unauthorized WebSocket task override
- **WHEN** a connected client emits `TASK_OVERRIDE` but lacks `dag:override_ok` permission
- **THEN** the server SHALL reject the action, discard the state mutation, and emit an error notification back to the sender without broadcasting to peers.

### Requirement: Role-Gated User Interface Adaptation
The frontend application SHALL dynamically show, hide, enable, or disable interactive controls based on the current user's resolved permissions.

#### Scenario: User lacks DAG editing permission
- **WHEN** the active user lacks `dag:edit_topology`
- **THEN** the "✏️ Edit DAG" button SHALL be hidden from the canvas toolbar, and node connection drag ports SHALL remain inactive.

#### Scenario: User lacks manual override permission
- **WHEN** an L1 operator without `dag:override_ok` inspects a task card
- **THEN** the "Set to OK" override button SHALL be disabled with a tooltip indicating higher privilege is required.

### Requirement: Operator Switcher and Session Context
The system SHALL provide an operator identity selector in the shell header allowing users to select active personas and verify permission scoping.

#### Scenario: Switching active operator in UI
- **WHEN** an administrator switches the active persona from "L1 Operator" to "Operations Supervisor"
- **THEN** the UI SHALL immediately recalculate effective permissions and reveal supervisory controls ("✏️ Edit DAG", "Set to OK", "Run Live Test Probe") without requiring page reload.
