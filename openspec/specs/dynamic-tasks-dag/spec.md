# dynamic-tasks-dag Specification

## Purpose
Provides a dynamic, interactive Directed Acyclic Graph (DAG) flowchart for Market Operations tasks, allowing operators to visually trace task dependencies, observe animated live flow, identify pipeline bottlenecks, and customize nodes and prerequisites.
## Requirements
### Requirement: Visual DAG Task Rendering
The system SHALL display shift tasks as an interconnected Directed Acyclic Graph (DAG) with visual nodes and connecting directed edges showing upstream-to-downstream process execution flow.

#### Scenario: Displaying Morning shift dependency graph
- **WHEN** the user selects the Morning shift or auto-follows into it
- **THEN** the system renders the task topology showing root nodes (such as Exchange File Download, TBT Adaptor, Fast feed) and their respective downstream dependent nodes with connecting edges.

### Requirement: Automated Upstream Dependency State Resolution
The system SHALL compute the executable state of each task node based on the completion status of its prerequisite tasks defined in `dependsOn`.

#### Scenario: Upstream prerequisite incomplete
- **WHEN** an upstream task (such as Exchange File Download) is not yet completed
- **THEN** all downstream dependent tasks (such as K2 Mails, Greeksoft BOD) SHALL transition to a `blocked` state with distinct warning visuals and disabled execution triggers.

#### Scenario: Upstream prerequisite completes
- **WHEN** all prerequisite tasks for a blocked node are marked completed
- **THEN** the downstream node SHALL automatically unlock and transition to `ready` or `open` state, enabling action execution by authorized roles.

### Requirement: Animated Flow Edges
The system SHALL render connecting edges with live pulsating visual animations indicating the state of data transmission between nodes.

#### Scenario: Flowing active edge
- **WHEN** an upstream task finishes and delivers output to an unlocked successor
- **THEN** the connecting SVG edge SHALL display an active animated pulsating stroke flow directed toward the successor node.

### Requirement: Dual View Mode Toggle
The system SHALL provide a view toggle allowing operators to switch seamlessly between the DAG Flowchart View and the classical Checklist Table View.

#### Scenario: Switching from DAG to Table
- **WHEN** the operator clicks the "Table View" toggle
- **THEN** the system renders the tabular checklist without losing the active shift selection, persona, or completed task states.

### Requirement: DAG Node & Dependency Customizer
The system SHALL allow authorized users to add custom task nodes and dynamically configure prerequisite dependencies.

#### Scenario: Adding a custom task node with prototype verification
- **WHEN** an operator creates a new node and inputs a process name, time, prerequisite parent IDs, target server IP, log path, and grep regex pattern
- **THEN** the system SHALL insert the node into the active shift's graph, draw edges from the specified parents, and save the verification configuration for prototype testing.

