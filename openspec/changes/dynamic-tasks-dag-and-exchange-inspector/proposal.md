## Why

In high-stakes Market Operations, a flat task checklist obscures upstream root causes: when tasks like K2 Mails or Greeksoft BOD fail or lag, operators cannot immediately tell if the root cause is delayed exchange master files or an application crash. Transforming the Tasks view into an interactive dependency DAG with live pulsating flows and a deep Exchange File Ingestion Inspector (~200 files across NSE, BSE, MCX, CCIL on NetApp storage) allows operators to instantly isolate bottlenecks, verify file arrival, and manually unblock downstream operations with full RBAC and audit logging.

## What Changes

- **Tasks Tab Dynamic Flowchart (DAG)**: Transform the task display into an interconnected dependency graph with pulsating flow edges indicating data readiness and progress.
- **Dependency State Resolver**: Compute node status (`blocked`, `ready`, `in_progress`, `completed`) automatically based on prerequisite parent tasks.
- **Dual View Support**: Seamless toggle between the new visual DAG Flowchart view and the classical Checklist Table view.
- **Exchange File Download Inspector**: A dedicated deep-dive inspector for task M1 displaying the complete manifest of ~200 BOD exchange files categorized across NetApp directory structures (NSE: CASH, CDS, COM, FUTURE, SLBM; BSE: CASH, CDS, FUTURE, SLBM; MCX: COM; CCIL fortnightly files).
- **Manual "Set to OK" Override**: An operational button to mark Exchange File Download as OK/Completed with operator confirmation and audit stamping.
- **DAG Node & Prototype Builder**: Ability to create custom prototype task nodes and link dependencies dynamically, with configurable server IP, log path, and grep regex patterns for future telemetry automation.
- **Shift & RBAC Continuity**: Preserve automatic shift following (Morning, Evening, Night), persona-based execution gates, and audit log generation.

## Capabilities

### New Capabilities
- `dynamic-tasks-dag`: Interactive visual dependency graph for shift tasks, status derivation based on upstream prerequisites, pulsating connecting edges, dual-view toggle, and prototype node builder.
- `exchange-file-inspector`: In-depth BOD file manifest inspector tracking ~200 exchange files across NetApp folder structures (NSE, BSE, MCX, CCIL) with progress metrics, filtering, and manual "Set to OK" override.

### Modified Capabilities
<!-- None: No existing specs exist in openspec/specs. -->

## Impact

- `src/stores/useTaskStore.ts`: Extended state to manage DAG edges (`dependsOn`), node positions, file manifests, prototype verification configs, and manual overrides.
- `src/features/tasks/`: New DAG visualization canvas, pulsating SVG edge renderer, Exchange File Inspector drawer/modal, and node builder modal.
- `src/data/roster.ts`: Seed checklist enhanced with prerequisite relationships (`dependsOn`) and BOD file manifests for NetApp exchange directories.
- Zero new external runtime dependencies: Built using existing React 18, Zustand, and Framer Motion with custom lightweight SVG styling aligned with `tokens.css`.
