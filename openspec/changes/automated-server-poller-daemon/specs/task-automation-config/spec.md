## Purpose

Provides a user-facing configuration interface and live terminal runner within the Task Inspector allowing operators to configure, update, and test verification script paths and evaluation criteria.

## ADDED Requirements

### Requirement: Task Automation Rule Configuration
The system SHALL allow operators to define and update a task's remote script path, arguments, polling interval, expected exit code, and stdout regex or JSON matching criteria directly from the Task Inspector.

#### Scenario: Updating script path and criteria
- **WHEN** an operator navigates to the Automation tab of a task and updates the script path to `/opt/scripts/bod_check.sh`
- **THEN** the updated automation configuration is saved to MongoDB and immediately used by subsequent poller cycles

### Requirement: Interactive On-Demand Probe Execution
The system SHALL provide an interactive "Run Probe Now" action that triggers immediate execution of the configured script and renders stdout, stderr, and exit code in the UI terminal.

#### Scenario: Operator runs on-demand script test
- **WHEN** an operator clicks "Run Probe Now" in the Task Inspector
- **THEN** the backend executes the script via SSH and streams the resulting exit code, standard output, standard error, and match evaluation status back to the client interface within 8 seconds

### Requirement: Configuration Audit Stamping
The system SHALL log an audit event whenever an operator modifies a task's automation configuration.

#### Scenario: Modifying automation configuration creates audit entry
- **WHEN** an operator saves updated script paths or evaluation rules for a task
- **THEN** an audit event of type `AUTOMATION_CONFIG_UPDATED` is recorded with the operator's persona and timestamp
