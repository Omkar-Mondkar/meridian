# backend-persistence Specification

## Purpose
Provides persistent disk storage and REST API endpoints for checklist task states, audit logs, and operator-defined custom DAG nodes.
## Requirements
### Requirement: Task State Persistence
The system SHALL persist task status updates (`pending`, `in_progress`, `completed`, `blocked`) across application reboots and client reconnections.

#### Scenario: Server restart preserves task statuses
- **WHEN** tasks are updated or marked complete and the backend server restarts
- **THEN** clients fetching `/api/tasks` receive the saved statuses rather than initial default states

### Requirement: Manual Override Audit Logging
The system SHALL append every "Manual Set to OK" action to an immutable audit trail capturing the task ID, operator persona, timestamp, and justification reason.

#### Scenario: Manual Set to OK creates an audit log
- **WHEN** an operator invokes "Manual Set to OK" with a reason note
- **THEN** an audit record is stored and queryable via `/api/tasks/audit`

### Requirement: Custom Dynamic Node Persistence
The system SHALL persist user-created custom DAG nodes including their upstream prerequisites, schedule time, and server IP / log inspection configs.

#### Scenario: Custom node survives reload
- **WHEN** an operator adds a custom DAG task node via the Node Builder
- **THEN** the custom node is stored and returned to all clients on subsequent loads

