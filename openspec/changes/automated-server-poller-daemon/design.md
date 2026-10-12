## Context

See `proposal.md` for motivation. Currently, task advancement in Meridian is manual or manually overridden. A central corporate reporting host aggregates health, master files, and process states across ~200 operational servers. This design specifies how Meridian securely communicates with that host via SSH to automate task verification.

## Goals / Non-Goals

**Goals:**
- Provide a single, resilient SSH client connection to the central reporting server using the pure-JavaScript `ssh2` driver (zero Windows binary dependencies).
- Encrypt connection secrets at rest in MongoDB using AES-256-GCM (`system_settings` collection).
- Enable operators to configure script paths, arguments, expected exit codes, and stdout regex or JSON matching rules dynamically from the UI Task Inspector.
- Provide a live interactive "Run Probe Now" terminal runner in the UI to test scripts on demand.
- Run a background daemon in `server/poller.ts` that automatically polls eligible tasks, verifies rules, logs audits, and triggers WebSocket DAG updates across all open screens.

**Non-Goals:**
- Connecting directly to 200 individual server IPs simultaneously (all status reports and checks route through the central host).
- Exposing an arbitrary interactive Bash shell to client browsers.

## Decisions

### 1. Pure-JavaScript `ssh2` Driver vs System CLI Execution
- **Decision**: Use `ssh2` npm package.
- **Rationale**: Completely self-contained within Node.js, runs identically on Windows dev workstations and Linux servers, and provides programmatic access to stdout, stderr, and exit codes without shell escaping issues.
- **Alternatives Considered**: Spawning `child_process.spawn('ssh', ...)` was rejected due to Windows PATH inconsistencies, OpenSSH version fragmentation, and injection risks.

### 2. At-Rest AES-256-GCM Credential Encryption
- **Decision**: Encrypt SSH private keys and passwords before inserting into MongoDB `system_settings`.
- **Rationale**: MongoDB stores application data, but database exports or backups must not leak infrastructure keys. AES-256-GCM provides confidentiality and integrity (tamper detection via authentication tags).
- **Key Derivation**: Uses `ENCRYPTION_KEY` from `.env`. If none is specified, generates a secure 32-byte hex key on first run and saves it to `.env`.

### 3. DAG-Aware Intelligent Polling Queue
- **Decision**: The poller evaluates only "candidate" tasks:
  1. Root tasks currently in `open` or `in_progress` state (e.g., M1).
  2. Non-root tasks whose upstream parents are all `completed` (e.g., M4 is only probed after M3 is completed).
- **Rationale**: Eliminates unnecessary SSH commands against the server for tasks whose prerequisites have not yet started.

### 4. Interactive "Run Probe Now" UI Terminal
- **Decision**: Add a test endpoint `POST /api/automation/test` that executes the configured script on demand and streams stdout, stderr, exit code, and match boolean back to the client.
- **Rationale**: Enables operators to verify that a script path, flags, and regex matcher work before enabling automated periodic polling.

## Risks / Trade-offs

- [Hanging Remote Script] → Hard execution timeout of 8000ms enforced via SSH channel kill.
- [Network Disconnect to Central Server] → Circuit breaker with exponential backoff pauses daemon cycles after 3 failures; surfaces status on UI chip.
- [Command Injection] → Script execution strictly passes path and argument tokens without `sh -c` shell wrapping.
