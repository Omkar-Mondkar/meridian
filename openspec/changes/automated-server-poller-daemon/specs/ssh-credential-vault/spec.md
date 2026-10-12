## Purpose

Stores and retrieves corporate server SSH connection parameters (host, port, username, authentication keys/passwords) encrypted at rest in MongoDB using AES-256-GCM.

## ADDED Requirements

### Requirement: Encrypted Credential Persistence
The system SHALL encrypt sensitive connection secrets (private keys, passwords, passphrases) using AES-256-GCM before persisting them to the `system_settings` collection in MongoDB.

#### Scenario: Saving connection credentials encrypts secret payload
- **WHEN** an operator submits SSH server credentials from the settings interface
- **THEN** the backend encrypts the sensitive key/password using the system encryption secret and stores only the ciphertext, initialization vector, and authentication tag

### Requirement: Safe In-Memory Decryption
The backend SHALL decrypt connection secrets only in memory during active SSH handshake initiation, and SHALL NEVER return unencrypted keys or passwords over client REST APIs.

#### Scenario: Client requests connection configuration
- **WHEN** an authorized client fetches `/api/settings/ssh`
- **THEN** the response includes host, port, username, and key presence status, but redacts all private key and password fields

### Requirement: Interactive Connection Handshake Test
The system SHALL provide a test endpoint to validate network reachability and authentication against the target server on demand.

#### Scenario: Operator tests connection parameters
- **WHEN** an operator triggers "Test Connection" from the settings UI
- **THEN** the backend performs an SSH handshake against the configured server and returns latency and success/failure status within 5 seconds
