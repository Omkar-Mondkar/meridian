## Purpose

Provides a detailed BOD exchange file manifest inspector for Exchange File Download across NetApp storage hierarchies for NSE, BSE, MCX, and CCIL segments, with progress tracking and manual operational override capabilities.

## ADDED Requirements

### Requirement: NetApp Segment Folder Manifest Display
The system SHALL catalog and display all BOD exchange files (~200 files) structured under their respective NetApp directory paths for the following segments:
- `NSE`: `CASH`, `CDS`, `COM`, `FUTURE`, `SLBM`
- `BSE`: `CASH`, `CDS`, `FUTURE`, `SLBM`
- `MCX`: `COM`
- `CCIL`: Fortnightly settlement & clearing masters

#### Scenario: Inspecting Exchange File Download node
- **WHEN** an operator clicks on the "Exchange File Download" task node in the DAG or checklist
- **THEN** the system SHALL open the Exchange File Inspector displaying the full directory hierarchy, total file counts, downloaded counts, and remaining files grouped by exchange and segment.

### Requirement: CCIL Fortnightly Schedule Indication
The system SHALL differentiate CCIL files as fortnightly cycles, indicating whether a CCIL ingest is scheduled for the active trade date.

#### Scenario: Viewing CCIL files on non-cycle date
- **WHEN** the operator views CCIL segment files on a trade date that is not a fortnightly run
- **THEN** the system SHALL badge the CCIL files as "Fortnightly (Not scheduled today)" and exclude them from blocking the daily BOD completion threshold.

### Requirement: Manifest Search and Segment Filtering
The system SHALL provide real-time search by filename and segment filtering tabs to quickly isolate missing or delayed exchange files.

#### Scenario: Filtering by segment
- **WHEN** the operator selects the "NSE / FUTURE" tab
- **THEN** the inspector SHALL filter the file manifest to show only contract files, span margins, and security masters under `/netapp/NSE/FUTURE/`.

### Requirement: Manual "Set to OK" Operational Override
The system SHALL provide an authorized "Manual Set to OK" action to forcibly mark the Exchange File Download task as completed and unlock all downstream dependent tasks.

#### Scenario: Operator triggers manual Set to OK
- **WHEN** an authorized operator clicks the "Set to OK" button and confirms the action
- **THEN** the system SHALL update the task status to `completed`, record the active persona name, timestamp, and audit event, and immediately trigger state recalculation to unlock dependent tasks (such as K2 Mails and Greeksoft BOD).
