## Purpose

Executes scheduled background health check probes via SSH on a centralized reporting server, evaluates exit code and stdout output against task rules, and automatically transitions task statuses in real-time.

## ADDED Requirements

### Requirement: Automated Periodic Script Execution
The poller daemon SHALL periodically execute configured verification scripts over SSH against the centralized reporting host only for eligible tasks whose prerequisite dependencies are completed or open.

#### Scenario: Eligible task is probed on schedule
- **WHEN** task M1 is open or task M4 has prerequisite M3 completed and its polling interval arrives
- **THEN** the poller executes the task's configured script path on the remote server within a hard 8-second execution timeout

### Requirement: Multi-Criteria Success Evaluation
The poller daemon SHALL evaluate both the process exit code and the standard output text/JSON stream against the task's configured automation rule.

#### Scenario: Script exit code and regex match triggers auto-completion
- **WHEN** the remote probe returns an exit code matching the expected status code and standard output matching the regex pattern
- **THEN** the poller updates the task status to completed in the database and logs an auto-poll audit event

#### Scenario: JSON progress stream extraction
- **WHEN** a script outputs a JSON payload containing downloaded and total counts
- **THEN** the poller updates the task manifest progress metrics in the store without prematurely completing the task until total is reached

### Requirement: DAG Unblocking and Real-Time Broadcast
The system SHALL broadcast automated status transitions over WebSockets to all connected client screens within 500 milliseconds of evaluation.

#### Scenario: Background auto-completion unblocks dependent tasks
- **WHEN** the poller marks M1 as completed
- **THEN** all connected dashboards update node M1 to completed and immediately unlock dependent nodes M2 and M3
