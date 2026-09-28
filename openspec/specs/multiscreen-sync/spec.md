# multiscreen-sync Specification

## Purpose
Provides real-time bidirectional WebSocket event synchronization across all connected market operations trade floor dashboards.
## Requirements
### Requirement: Real-Time Task State Broadcast
The system SHALL broadcast task status updates and DAG unblocking events to all active connected clients over WebSockets within 500 milliseconds.

#### Scenario: State change on screen A appears on screen B
- **WHEN** an operator on screen A completes or overrides a task
- **THEN** screen B receives a `TASK_UPDATED` WebSocket message and immediately updates its DAG canvas without page refresh

### Requirement: Broadcast Override Events
The system SHALL broadcast "Manual Set to OK" events with operator name and timestamp to all connected clients.

#### Scenario: Real-time alert on manual override
- **WHEN** an operator overrides task M1 (Exchange File Download) on one workstation
- **THEN** all connected dashboards update node M1 to completed and trigger the unlock animation on dependent nodes M2 and M3

### Requirement: Connection Status and Resilient Reconnect
The system SHALL surface connection health in the client interface and automatically reconnect with backoff when the network connection drops.

#### Scenario: Reconnection sync
- **WHEN** a client temporarily loses connection and reconnects
- **THEN** the client immediately requests the latest snapshot and updates its local task state seamlessly

