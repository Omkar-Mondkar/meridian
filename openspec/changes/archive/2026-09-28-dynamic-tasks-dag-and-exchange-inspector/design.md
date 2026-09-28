## Context

See `proposal.md` for motivation. Meridian currently displays a linear checklist table in `src/features/tasks/TasksTab.tsx` backed by `src/stores/useTaskStore.ts`. Tasks are stored in flat arrays per shift (`Morning`, `Evening`, `Night`) without dependency graphs or sub-manifest tracking. The design aesthetic is driven by `src/styles/tokens.css` (dark glassmorphism, `--void`, `--panel`, `--cyan`, `--green`, `--amber`, `--red`).

## Goals / Non-Goals

**Goals:**
- Provide a responsive, hardware-accelerated DAG flowchart using custom SVG Bézier curves and Framer Motion with pulsating edge animations.
- Compute node states (`blocked`, `ready`, `in_progress`, `completed`) dynamically via a dependency resolver.
- Implement an in-depth Exchange File Download Inspector (~200 files) reflecting exact NetApp storage folder hierarchies:
  - `NSE`: `CASH`, `CDS`, `COM`, `FUTURE`, `SLBM`
  - `BSE`: `CASH`, `CDS`, `FUTURE`, `SLBM`
  - `MCX`: `COM`
  - `CCIL`: Fortnightly clearing masters
- Implement an authorized "Manual Set to OK" action that stamps an audit event and unlocks downstream nodes (K2 Mails, Greeksoft BOD, etc.).
- Allow operators to prototype custom nodes with server IP, log path, and grep regex patterns.
- Retain existing shift auto-follow and persona-based RBAC.

**Non-Goals:**
- Direct remote SSH/agent execution to live NetApp/Linux storage in Phase 1 (this phase introduces the verification contract and UI; live network polling is reserved for Phase 3).
- Free-form drag-and-drop node canvas persistence (Phase 2 will introduce coordinate persistence).
- Modifying other tabs (Overview, Timeline, Roster).

## Decisions

### Decision 1: Custom SVG Bézier Engine over Heavy Graph Libraries
- **Choice**: Implement a lightweight SVG connector layer with CSS/Framer Motion animated dash-arrays.
- **Alternatives Considered**: React Flow (`@xyflow/react`), Cytoscape.js.
- **Rationale**: Keeps the codebase zero-dependency, avoids conflicting default stylesheets, perfectly matches `tokens.css` neon aesthetic, and guarantees sub-millisecond renders on wall-mounted NOC displays.

### Decision 2: State Model Architecture in Zustand (`useTaskStore.ts`)
- **Choice**: Extend `useTaskStore.ts` with `dependsOn: string[]`, `fileManifest`, `verification`, and a `viewMode: 'graph' | 'table'` toggle.
- **Alternatives Considered**: Creating an isolated `useDagStore.ts`.
- **Rationale**: Tasks, personas, and audit logs must remain unified. If an operator completes a task in Table View, it must instantly reflect in the DAG View and vice-versa.

### Decision 3: Realistic NetApp Exchange File Catalog Generator
- **Choice**: Create a realistic catalog generator producing ~200 BOD files structured by NetApp paths:
  - `/netapp/NSE/FUTURE/fo_contract.txt`, `/netapp/NSE/FUTURE/fo_secban.csv`, `/netapp/NSE/FUTURE/spancirc.dat`
  - `/netapp/NSE/CASH/security.csv`, `/netapp/NSE/CASH/bhavcopy.csv`
  - `/netapp/BSE/CASH/bse_eq_scrip.csv`, `/netapp/BSE/CDS/bse_currency.txt`
  - `/netapp/MCX/COM/mcx_master.csv`, `/netapp/MCX/COM/span_margin.dat`
  - `/netapp/CCIL/SETTLEMENT/ccil_fortnightly_settle.csv` (flagged fortnightly)
- **Rationale**: Matches the exact production environment described by the ops team, providing immediate familiarity during daily operations.

### Decision 4: Dependency State Engine
- **Choice**: Reactive topological state calculation. A task is marked `blocked` if any `dependsOn` ID is not `completed`. It transitions to `ready` once all prerequisites are fulfilled. Manual "Set to OK" overrides the status and immediately propagates through the graph.

## Risks / Trade-offs

- **[Risk] High node density on smaller screens** → **Mitigation**: Layout nodes into structured pipeline swimlanes (Exchange Data, Market Feeds, Execution, Infra) with smooth horizontal scrolling and a persistent "Table View" toggle.
- **[Risk] Accidental "Set to OK" trigger** → **Mitigation**: Require a confirmation dialog with operator persona verification before setting status to completed.
- **[Risk] Cyclic dependencies from user custom nodes** → **Mitigation**: Implement a cycle-detection check (DFS) before allowing an edge to be added in the custom node builder.
