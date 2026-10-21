## MODIFIED Requirements

### Requirement: DAG Node & Dependency Customizer
The system SHALL allow authorized users possessing the `dag:edit_topology` permission to add custom task nodes and dynamically configure prerequisite dependencies via drag-and-drop or configuration builders.

#### Scenario: Adding a custom task node with prototype verification
- **WHEN** an authorized operator possessing `dag:edit_topology` creates a new node and inputs a process name, time, prerequisite parent IDs, target server IP, log path, and grep regex pattern
- **THEN** the system SHALL insert the node into the active shift's graph, draw edges from the specified parents, and save the verification configuration for prototype testing.

#### Scenario: Unauthorized operator attempting to customize DAG
- **WHEN** a user without `dag:edit_topology` attempts to toggle Edit DAG mode or drag connection ports
- **THEN** the system SHALL disable the editing controls and reject any edge modification attempts.
