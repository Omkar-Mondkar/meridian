## 1. Data Schema & Store Architecture

- [x] 1.1 Extend `src/data/roster.ts` checklist data model with `dependsOn`, `verification`, and NetApp segment definitions
- [x] 1.2 Generate realistic NetApp BOD exchange file manifest (~200 files for NSE, BSE, MCX, and CCIL fortnightly)
- [x] 1.3 Upgrade `src/stores/useTaskStore.ts` with DAG dependency resolution, viewMode toggle (`graph` | `table`), and manual override actions

## 2. Dynamic Flowchart & DAG Canvas Components

- [x] 2.1 Build custom SVG connector layer with animated Bézier curves and pulsating neon gradient flows
- [x] 2.2 Create interactive `TaskNodeCard` component with status glow, time badge, role badge, and execution pills
- [x] 2.3 Assemble `TaskDagCanvas` with organized pipeline swimlanes (Exchange Data, Market Feeds, Execution, Infra)
- [x] 2.4 Add view toggle (DAG Flowchart ↔ Classical Table) in `TasksTab.tsx` toolbar

## 3. Exchange File Download Inspector Sub-System

- [x] 3.1 Build `ExchangeFileInspector` modal/drawer displaying the NetApp directory structure and file ingestion metrics
- [x] 3.2 Implement segment filter tabs (NSE: CASH/CDS/COM/FUTURE/SLBM; BSE: CASH/CDS/FUTURE/SLBM; MCX: COM; CCIL) and filename search
- [x] 3.3 Add CCIL fortnightly cycle indicator and schedule logic
- [x] 3.4 Implement "Manual Set to OK" action with confirmation modal, persona audit stamping, and immediate downstream unblocking

## 4. Custom Node & Prototype Verification Builder

- [x] 4.1 Create `NodeBuilderModal` allowing operators to add custom task nodes dynamically
- [x] 4.2 Support multi-select prerequisite linking with dependency validation
- [x] 4.3 Add prototype configuration fields for server IP, log path, and grep regex patterns

## 5. Integration, Polish & Verification

- [x] 5.1 Verify shift auto-switching (Morning, Evening, Night) and persona RBAC compatibility
- [x] 5.2 Validate that completing or setting M1 to OK immediately pulses and unlocks M2 (K2 Mails) and M3 (Greeksoft BOD)
- [x] 5.3 Run full TypeScript verification and test in browser
