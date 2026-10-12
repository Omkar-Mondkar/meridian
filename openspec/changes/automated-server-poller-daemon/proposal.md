## Why

Meridian currently relies on manual operator triggers or overrides to progress through checklist items and unblock dependent tasks. Across a production trading estate with hundreds of critical servers, reports (including beginning-of-day exchange file arrivals) are aggregated to a centralized reporting host. 

Implementing a secure, automated background poller daemon eliminates repetitive manual verification by directly polling status scripts on the central host via SSH, evaluating both status exit codes and stdout text/JSON streams, and automatically updating DAG task states in real-time.

## What Changes

- Add a background automated poller service (`server/poller.ts`) running scheduled health checks on active DAG tasks.
- Add AES-256-GCM encrypted credential vault in MongoDB (`system_settings` collection) to store corporate SSH host, port, username, and key/password credentials securely.
- Add an SSH execution manager (`server/ssh.ts`) with connection pooling, non-blocking execution, and hard command timeouts.
- Extend the Task Inspector UI with an **"Automation & Poller"** configuration panel to customize script paths, evaluation rules (exit code, regex pattern, JSON progress metrics), and poll frequencies per task.
- Add an interactive **"Run Probe Now"** live test runner in the UI allowing operators to execute scripts on demand and inspect stdout/stderr/exit codes immediately.
- Auto-mark matched tasks as completed in MongoDB, append audit events, and broadcast updates over WebSockets across all floor screens.

## Capabilities

### New Capabilities
- `server-poller-daemon`: Automated background poller executing designated verification scripts via SSH, evaluating exit codes and stdout regex/JSON, and updating task completion in real-time.
- `ssh-credential-vault`: Encrypted at-rest storage in MongoDB (`system_settings` collection) using AES-256-GCM to securely manage server connection credentials.
- `task-automation-config`: UI interface within the Task Inspector allowing operators to configure script paths, execution parameters, success criteria, and run live probe diagnostics.

### Modified Capabilities
<!-- None: existing dynamic-tasks-dag, exchange-file-inspector, and backend-persistence capabilities remain fully backwards compatible -->

## Impact

- **Backend**: New modules `server/poller.ts`, `server/ssh.ts`, and `server/crypto.ts`; new REST endpoints (`/api/settings/ssh`, `/api/automation/test`, `/api/automation/:taskId`).
- **Dependencies**: Add `ssh2` and `@types/ssh2` for pure-JavaScript SSH client communication.
- **Frontend**: Updated `ExchangeFileInspector.tsx` with an Automation tab, and new System Settings modal for SSH connection configuration.
- **Security**: Zero plain-text credentials in MongoDB or code; strict command execution timeouts; no arbitrary shell injection.
