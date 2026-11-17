import React, { useState, useMemo } from "react";
import { useTaskStore } from "../../stores/useTaskStore";
import { usePermissions } from "../../hooks/usePermissions";
import type { ChecklistItem } from "../../data/roster";
import { AutomationPollerTab } from "./AutomationPollerTab";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import {
  Folder,
  Zap,
  Check,
  Clock,
  X,
  BookOpen,
  ArrowUp,
  ArrowDown,
  Terminal,
  AlertTriangle,
  Play,
  ShieldAlert,
  Pencil,
  Trash2,
} from "lucide-react";
import "./ExchangeInspector.css";

export function ExchangeFileInspector() {
  const { canOverrideOk, canAdvanceTask, canEditDag } = usePermissions();
  const {
    checklists,
    selectedShift,
    inspectorOpen,
    setInspectorOpen,
    selectedTaskId,
    setSelectedTaskId,
    setTaskStatusToOk,
    advanceStatus,
    setEditingNode,
    deleteCustomTaskNode,
    currentPersona,
    getNodeDerivedStatus,
  } = useTaskStore();

  const [inspectorTab, setInspectorTab] = useState<"details" | "automation">("details");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const rows = checklists[selectedShift] || [];
  const activeTaskId = selectedTaskId || (selectedShift === "Morning" ? "M1" : rows[0]?.id || "M1");
  const currentTask: ChecklistItem | undefined =
    rows.find((r) => r.id === activeTaskId) ||
    checklists["Morning"]?.find((r) => r.id === "M1");

  // Determine if this task has a NetApp file manifest (M1) or standard process verification
  const isManifestTask = Boolean(currentTask?.fileManifest);
  const manifest = currentTask?.fileManifest;

  const files = manifest?.files || [];
  const total = manifest?.totalExpected || 0;
  const downloaded = manifest?.downloadedCount || 0;
  const pending = manifest?.pendingCount || 0;
  const isCompleted = currentTask?.status === "completed";
  const derivedStatus = currentTask
    ? getNodeDerivedStatus(selectedShift, currentTask.id)
    : "ready";
  const isBlocked = derivedStatus === "blocked";
  const progressPct = total > 0 ? Math.round((downloaded / total) * 100) : 0;

  // Segment Tab Options for Manifest
  const segmentTabs = [
    { id: "ALL", label: "All Exchanges" },
    { id: "NSE_FUTURE", label: "NSE / FUTURE" },
    { id: "NSE_CASH", label: "NSE / CASH" },
    { id: "NSE_CDS", label: "NSE / CDS" },
    { id: "NSE_COM", label: "NSE / COM" },
    { id: "NSE_SLBM", label: "NSE / SLBM" },
    { id: "BSE_CASH", label: "BSE / CASH" },
    { id: "BSE_FUTURE", label: "BSE / FUTURE" },
    { id: "BSE_CDS", label: "BSE / CDS" },
    { id: "BSE_SLBM", label: "BSE / SLBM" },
    { id: "MCX_COM", label: "MCX / COM" },
    { id: "CCIL", label: "CCIL (Fortnightly)", fortnightly: true },
  ];

  // Upstream parents
  const parents = useMemo(() => {
    if (!currentTask || !currentTask.dependsOn) return [];
    return currentTask.dependsOn
      .map((pid) => rows.find((r) => r.id === pid))
      .filter((r): r is ChecklistItem => Boolean(r));
  }, [currentTask, rows]);

  // Downstream dependents
  const dependents = useMemo(() => {
    if (!currentTask) return [];
    return rows.filter((r) => r.dependsOn && r.dependsOn.includes(currentTask.id));
  }, [currentTask, rows]);

  // Filtered files for manifest task
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      if (
        searchQuery &&
        !file.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !file.folderPath.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !file.id.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (selectedSegment !== "ALL") {
        if (selectedSegment === "CCIL" && file.exchange !== "CCIL") return false;
        if (selectedSegment !== "CCIL" && file.segment !== selectedSegment) return false;
      }
      if (statusFilter !== "ALL" && file.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [files, searchQuery, selectedSegment, statusFilter]);

  if (!currentTask) return null;

  function handleOpenConfirm(defaultReason?: string) {
    setOverrideReason(
      defaultReason ||
        `Verified operational readiness for ${currentTask?.process || currentTask?.id}. Manual sign-off by Shift Lead.`
    );
    setShowConfirmModal(true);
  }

  function handleConfirmSetToOk() {
    if (!currentTask || !canOverrideOk) return;
    setTaskStatusToOk(
      selectedShift,
      currentTask.id,
      currentPersona.name,
      currentPersona.role,
      overrideReason || `Manual operational sign-off by ${currentPersona.name}`
    );
    setShowConfirmModal(false);
  }

  function handleAdvance() {
    if (!currentTask || !canAdvanceTask) return;
    advanceStatus(selectedShift, currentTask.id, currentPersona.name, currentPersona.role);
  }

  return (
    <>
      <Modal
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        size="xl"
        showCloseButton={false}
      >
        <div className="inspector-container">
          {/* Header */}
          <div className="inspector-header">
            <div className="inspector-title-group">
              <div className="inspector-title">
                {isManifestTask ? (
                  <Folder size={18} style={{ color: "var(--cyan)" }} />
                ) : (
                  <Zap size={18} style={{ color: "var(--amber)" }} />
                )}
                <span>
                  {currentTask.id} · {currentTask.process}
                </span>
                <span className={`node-priority ${currentTask.priority}`}>
                  {currentTask.priority}
                </span>
                {currentTask.isCustom && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "rgba(168, 85, 247, 0.2)",
                      color: "#c084fc",
                      border: "1px solid rgba(168, 85, 247, 0.4)",
                      textTransform: "uppercase",
                    }}
                  >
                    CUSTOM
                  </span>
                )}
                {isCompleted ? (
                  <span
                    style={{
                      fontSize: 11,
                      background: "rgba(51, 209, 122, 0.2)",
                      color: "var(--green)",
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: "1px solid rgba(51, 209, 122, 0.4)",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Check size={11} strokeWidth={3} />
                    <span>COMPLETED</span>
                  </span>
                ) : isBlocked ? (
                  <span
                    style={{
                      fontSize: 11,
                      background: "rgba(255, 176, 32, 0.2)",
                      color: "var(--amber)",
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: "1px solid rgba(255, 176, 32, 0.4)",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Clock size={11} />
                    <span>BLOCKED</span>
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      background: "rgba(79, 217, 208, 0.15)",
                      color: "var(--cyan)",
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: "1px solid rgba(79, 217, 208, 0.3)",
                      fontWeight: 700,
                    }}
                  >
                    READY FOR EXECUTION
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                <span className="inspector-host-chip mono">
                  Target: {currentTask.verification?.serverIp || "10.240.18.52"} (
                  {currentTask.pipeline || "Operations"})
                </span>
                <span style={{ fontSize: 11, color: "var(--text-lo)" }}>
                  Scheduled: <strong className="mono">{currentTask.time} IST</strong>
                </span>
                <span style={{ fontSize: 11, color: "var(--text-lo)" }}>
                  Executor: <strong>{currentTask.executor || "Manual"}</strong> ({currentTask.role})
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!isCompleted && (
                <button
                  type="button"
                  className="manual-ok-btn"
                  disabled={!canOverrideOk}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    opacity: canOverrideOk ? 1 : 0.45,
                    cursor: canOverrideOk ? "pointer" : "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  onClick={() => {
                    if (!canOverrideOk) return;
                    handleOpenConfirm();
                  }}
                  title={
                    canOverrideOk
                      ? "Override and mark task as completed immediately"
                      : "Manual Set to OK requires L2 Engineer, Supervisor, or Admin permissions (dag:override_ok)"
                  }
                >
                  <Check size={13} strokeWidth={3} />
                  <span>Set to OK</span>
                </button>
              )}

              <button
                type="button"
                className="inspector-close-btn"
                onClick={() => setInspectorOpen(false)}
                title="Close inspector"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 24px",
              background: "rgba(255, 255, 255, 0.02)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <button
              type="button"
              onClick={() => setInspectorTab("details")}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                background: inspectorTab === "details" ? "rgba(79, 217, 208, 0.15)" : "transparent",
                color: inspectorTab === "details" ? "var(--cyan)" : "var(--text-lo)",
                border: inspectorTab === "details" ? "1px solid rgba(79, 217, 208, 0.3)" : "1px solid transparent",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {isManifestTask ? (
                <>
                  <Folder size={13} />
                  <span>File Manifest & Segments</span>
                </>
              ) : (
                <>
                  <Zap size={13} />
                  <span>Dependencies & DAG</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setInspectorTab("automation")}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                background: inspectorTab === "automation" ? "rgba(79, 217, 208, 0.15)" : "transparent",
                color: inspectorTab === "automation" ? "var(--cyan)" : "var(--text-lo)",
                border: inspectorTab === "automation" ? "1px solid rgba(79, 217, 208, 0.3)" : "1px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Zap size={13} />
              <span>Automation & Poller Daemon</span>
            </button>
          </div>

          {/* VIEW MODE 1: Exchange File Manifest View (M1) */}
          {inspectorTab === "details" && isManifestTask && (
            <>
              {/* Metrics Banner */}
              <div className="inspector-metrics-banner">
                <div className="inspector-metric-card">
                  <span className="metric-label">Total Expected</span>
                  <span className="metric-value mono">{total}</span>
                </div>

                <div className="inspector-metric-card">
                  <span className="metric-label" style={{ color: "var(--green)" }}>
                    Downloaded
                  </span>
                  <span className="metric-value mono" style={{ color: "var(--green)" }}>
                    {downloaded}
                  </span>
                </div>

                <div className="inspector-metric-card">
                  <span className="metric-label" style={{ color: "var(--orange)" }}>
                    Pending
                  </span>
                  <span className="metric-value mono" style={{ color: "var(--orange)" }}>
                    {pending}
                  </span>
                </div>

                <div className="inspector-metric-card">
                  <span className="metric-label">Completion</span>
                  <span className="metric-value mono" style={{ color: progressPct === 100 ? "var(--green)" : "var(--cyan)" }}>
                    {progressPct}%
                  </span>
                </div>

                <div className="inspector-metric-card progress-card">
                  <div className="progress-top">
                    <span className="metric-label">BOD Ingestion Progress</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-lo)" }}>
                      {downloaded} of {total} Files Ready
                    </span>
                  </div>
                  <div className="manifest-progress-track">
                    <div
                      className="manifest-progress-fill"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Filters Bar with Animated Select */}
              <div className="inspector-filter-bar">
                <div className="filter-search-row">
                  <input
                    type="text"
                    className="inspector-search-input"
                    placeholder="Search filename (e.g., fo_contract.txt, spancirc, security.csv, mcx)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  <div style={{ width: 180, flexShrink: 0 }}>
                    <Select
                      size="sm"
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={[
                        { value: "ALL", label: "All File Statuses" },
                        { value: "downloaded", label: "Downloaded Only" },
                        { value: "pending", label: "Pending Only" },
                        { value: "failed", label: "Failed Only" },
                      ]}
                    />
                  </div>
                </div>

                {/* Segment Tabs */}
                <div className="segment-pills-bar">
                  {segmentTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`segment-pill ${selectedSegment === tab.id ? "active" : ""}`}
                      onClick={() => setSelectedSegment(tab.id)}
                    >
                      {tab.label}
                      {tab.fortnightly && <span className="fortnight-badge">CYCLE</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manifest Table */}
              <div className="inspector-table-container">
                <table className="manifest-table">
                  <thead>
                    <tr>
                      <th style={{ width: 140 }}>Exchange / Segment</th>
                      <th>Filename & Target Storage Path</th>
                      <th style={{ width: 120 }}>Expected Size</th>
                      <th style={{ width: 100 }}>Cutoff Time</th>
                      <th style={{ width: 130 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((file) => (
                      <tr key={file.id} className={`file-row ${file.status}`}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span className="file-exchange-tag mono">{file.exchange}</span>
                            <span className="file-segment-tag">{file.segment}</span>
                          </div>
                        </td>
                        <td>
                          <div className="file-name-cell mono">{file.name}</div>
                          <div className="file-path-cell mono">{file.folderPath}</div>
                        </td>
                        <td className="mono" style={{ fontSize: 11, color: "var(--text-lo)" }}>
                          {file.sizeKb ? `${file.sizeKb} KB` : "—"}
                        </td>
                        <td className="mono" style={{ fontSize: 11, color: "var(--text-lo)" }}>
                          {file.expectedTime}
                        </td>
                        <td>
                          <span className={`file-status-pill ${file.status}`}>
                            {file.status === "downloaded" ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Check size={11} strokeWidth={3} /> Downloaded
                              </span>
                            ) : file.status === "pending" ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Clock size={11} /> Pending
                              </span>
                            ) : (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <X size={11} strokeWidth={3} /> Failed
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* VIEW MODE 2: General Task Diagnostics & Operations View */}
          {inspectorTab === "details" && !isManifestTask && (
            <div className="inspector-task-detail-container">
              <div className="inspector-task-layout">
                {/* Left Column */}
                <div className="inspector-left-pane">
                  {/* Description & Overview */}
                  <div className="inspector-card">
                    <div className="inspector-card-title">
                      <BookOpen size={14} style={{ color: "var(--cyan)" }} />
                      <span>Runbook Description & Process Overview</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-hi)", lineHeight: 1.6 }}>
                      {currentTask.desc || "Standard operating procedure execution step for market readiness."}
                    </div>
                  </div>

                  {/* Prerequisites (Upstream) */}
                  <div className="inspector-card">
                    <div className="inspector-card-title">
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ArrowUp size={14} style={{ color: "var(--cyan)" }} />
                        <span>Upstream Prerequisites ({parents.length})</span>
                      </div>
                      {isBlocked && (
                        <span style={{ fontSize: 11, color: "var(--amber)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <AlertTriangle size={12} /> Awaiting completion
                        </span>
                      )}
                    </div>

                    {parents.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--text-lo)", fontStyle: "italic" }}>
                        No prerequisite dependencies. This is a root pipeline process.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {parents.map((parent) => {
                          const parentCompleted = parent.status === "completed";
                          return (
                            <div
                              key={parent.id}
                              className="prereq-item-card"
                              onClick={() => setSelectedTaskId(parent.id)}
                              title="Click to jump to this prerequisite task"
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span className="mono" style={{ color: "var(--cyan)", fontWeight: 700 }}>
                                  {parent.id}
                                </span>
                                <span style={{ color: "var(--text-hi)", fontWeight: 600 }}>
                                  {parent.process}
                                </span>
                                <span className="mono" style={{ fontSize: 11, color: "var(--text-lo)" }}>
                                  ({parent.time})
                                </span>
                              </div>
                              <span
                                className={`status-pill ${parent.status}`}
                                style={{ fontSize: 10, padding: "2px 8px" }}
                              >
                                {parentCompleted ? "Completed" : "Pending"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Downstream Dependents */}
                  <div className="inspector-card">
                    <div className="inspector-card-title">
                      <ArrowDown size={14} style={{ color: "var(--amber)" }} />
                      <span>Downstream Dependent Pipelines ({dependents.length})</span>
                    </div>

                    {dependents.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--text-lo)", fontStyle: "italic" }}>
                        No subsequent tasks depend on this process.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {dependents.map((dep) => (
                          <div
                            key={dep.id}
                            className="prereq-item-card"
                            onClick={() => setSelectedTaskId(dep.id)}
                            title="Click to inspect this dependent task"
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="mono" style={{ color: "var(--amber)", fontWeight: 700 }}>
                                {dep.id}
                              </span>
                              <span style={{ color: "var(--text-hi)", fontWeight: 600 }}>
                                {dep.process}
                              </span>
                              <span className="mono" style={{ fontSize: 11, color: "var(--text-lo)" }}>
                                ({dep.time})
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text-lo)" }}>
                              Waiting on {currentTask.id}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Live Verification Console & Terminal */}
                <div className="inspector-right-pane">
                  <div className="inspector-card terminal-card">
                    <div className="inspector-card-title" style={{ justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Terminal size={14} style={{ color: "var(--cyan)" }} />
                        <span>Verification Diagnostics & Server Logs</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectorTab("automation")}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: "rgba(79, 217, 208, 0.15)",
                          border: "1px solid rgba(79, 217, 208, 0.35)",
                          color: "var(--cyan)",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Zap size={11} />
                        <span>Open Live Automation Runner</span>
                      </button>
                    </div>

                    <div className="diagnostics-meta-grid">
                      <div>
                        <span className="diag-label">Server IP:</span>
                        <span className="diag-val mono">
                          {currentTask.verification?.serverIp || "10.240.20.10"}
                        </span>
                      </div>
                      <div>
                        <span className="diag-label">Verification Type:</span>
                        <span className="diag-val mono">
                          {currentTask.verification?.type || "log_grep"}
                        </span>
                      </div>
                      <div>
                        <span className="diag-label">Log / Probe Path:</span>
                        <span className="diag-val mono">
                          {currentTask.verification?.logPath || `/var/log/ops/${currentTask.id.toLowerCase()}.log`}
                        </span>
                      </div>
                      <div>
                        <span className="diag-label">Search / Match Pattern:</span>
                        <span className="diag-val mono" style={{ color: "var(--cyan)" }}>
                          {currentTask.verification?.grepRegex || `${currentTask.id}_EXECUTION_OK`}
                        </span>
                      </div>
                    </div>

                    {/* Terminal Simulation Window */}
                    <div className="terminal-box mono">
                      <div className="terminal-line text-dim">
                        # ssh ops@{currentTask.verification?.serverIp || "10.240.20.10"} -p 22
                      </div>
                      <div className="terminal-line text-cyan">
                        [SYS] SSH channel authenticated via key: meridian-ops-ed25519
                      </div>
                      <div className="terminal-line">
                        [SYS] Tail probe active on: {currentTask.verification?.logPath || `/var/log/ops/${currentTask.id.toLowerCase()}.log`}
                      </div>
                      <div className="terminal-line text-green">
                        [PROBE] Checking regex: &apos;{currentTask.verification?.grepRegex || `${currentTask.id}_EXECUTION_OK`}&apos;
                      </div>
                      <div className="terminal-line">
                        [LOG 06:30:02] Initializing module {currentTask.process}...
                      </div>
                      <div className="terminal-line">
                        [LOG 06:30:08] Socket connection verified. Handshake round-trip 0.8ms.
                      </div>
                      {isCompleted ? (
                        <div className="terminal-line text-green" style={{ fontWeight: 700 }}>
                          [SUCCESS] Matched pattern: {currentTask.verification?.grepRegex || "EXECUTION_COMPLETE"}. Process healthy.
                        </div>
                      ) : isBlocked ? (
                        <div className="terminal-line text-amber">
                          [WAITING] Upstream dependency {(currentTask.dependsOn || []).join(", ")} pending. Standing by...
                        </div>
                      ) : (
                        <div className="terminal-line text-cyan">
                          [READY] Process listening. Ready to execute or sign off.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Audit & Completion Status Box */}
                  {isCompleted && (
                    <div className="inspector-card" style={{ border: "1px solid rgba(51, 209, 122, 0.3)" }}>
                      <div className="inspector-card-title" style={{ color: "var(--green)" }}>
                        <Check size={14} />
                        <span>Sign-Off & Audit Trail</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-hi)", lineHeight: 1.6 }}>
                        This task was signed off by:{" "}
                        <strong style={{ color: "var(--cyan)" }}>{currentTask.completedBy}</strong>{" "}
                        {currentTask.completedAt ? `at ${currentTask.completedAt}` : ""}.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 3: Script Automation & Poller Daemon Configuration */}
          {inspectorTab === "automation" && (
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <AutomationPollerTab
                taskId={currentTask.id}
                taskTitle={currentTask.process}
                isCompleted={isCompleted}
                onSetTaskStatusToOk={() =>
                  setTaskStatusToOk(
                    selectedShift,
                    currentTask.id,
                    currentPersona.name,
                    "Automated Script Verification Pass"
                  )
                }
              />
            </div>
          )}

          {/* Footer Action Bar */}
          <div className="inspector-footer">
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--text-lo)" }}>
                Active Operator:{" "}
                <strong style={{ color: "var(--text-hi)" }}>
                  {currentPersona.name} ({currentPersona.role})
                </strong>
              </span>
              {isBlocked && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--amber)",
                    background: "rgba(255, 176, 32, 0.12)",
                    padding: "2px 8px",
                    borderRadius: 4,
                    border: "1px solid rgba(255, 176, 32, 0.3)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <AlertTriangle size={12} /> Upstream prerequisites pending
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {currentTask?.isCustom && canEditDag && (
                <>
                  <button
                    type="button"
                    className="dag-btn"
                    onClick={() => {
                      setEditingNode(currentTask);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: "var(--cyan)",
                    }}
                  >
                    <Pencil size={12} />
                    <span>Edit Custom Node</span>
                  </button>

                  <button
                    type="button"
                    className="dag-btn"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Are you sure you want to delete custom task node "${currentTask.id} - ${currentTask.process}"? Any downstream dependencies will be safely unlinked.`
                        )
                      ) {
                        deleteCustomTaskNode(selectedShift, currentTask.id);
                        setInspectorOpen(false);
                      }
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "rgba(239, 68, 68, 0.12)",
                      borderColor: "rgba(239, 68, 68, 0.35)",
                      color: "#fca5a5",
                    }}
                  >
                    <Trash2 size={12} />
                    <span>Delete Node</span>
                  </button>
                </>
              )}

              {!isCompleted && !isBlocked && (
                <button
                  type="button"
                  className="dag-btn"
                  disabled={!canAdvanceTask}
                  onClick={() => {
                    if (!canAdvanceTask) return;
                    handleAdvance();
                  }}
                  title={
                    canAdvanceTask
                      ? "Advance task status"
                      : "Advancing task status requires L1 Operator, L2, Supervisor, or Admin permissions (dag:advance)"
                  }
                  style={{
                    opacity: canAdvanceTask ? 1 : 0.45,
                    cursor: canAdvanceTask ? "pointer" : "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Play size={12} fill="currentColor" />
                  <span>Advance Status</span>
                </button>
              )}

              {!isCompleted && (
                <button
                  type="button"
                  className="manual-ok-btn"
                  disabled={!canOverrideOk}
                  onClick={() => {
                    if (!canOverrideOk) return;
                    handleOpenConfirm();
                  }}
                  title={
                    canOverrideOk
                      ? "Override and mark task as completed immediately"
                      : "Manual Set to OK requires L2 Engineer, Supervisor, or Admin permissions (dag:override_ok)"
                  }
                  style={{
                    opacity: canOverrideOk ? 1 : 0.45,
                    cursor: canOverrideOk ? "pointer" : "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Check size={12} strokeWidth={3} />
                  <span>Manual Set to OK</span>
                </button>
              )}

              <button
                type="button"
                className="dag-btn"
                onClick={() => setInspectorOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Override Confirmation Modal Dialog - Independent Portal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        level="confirm"
        size="sm"
        title={`Confirm Manual Override: ${currentTask.id}`}
        icon={<ShieldAlert size={20} />}
        footer={
          <>
            <button
              type="button"
              className="dag-btn"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="manual-ok-btn"
              onClick={handleConfirmSetToOk}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Check size={13} strokeWidth={3} />
              <span>Confirm & Set to OK</span>
            </button>
          </>
        }
      >
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, color: "var(--text-hi)", lineHeight: 1.5 }}>
            You are about to mark <strong>{currentTask.process} ({currentTask.id})</strong> as{" "}
            <span style={{ color: "var(--green)", fontWeight: 700 }}>COMPLETED (OK)</span>.
            <br />
            {dependents.length > 0 ? (
              <span style={{ display: "inline-block", marginTop: 6 }}>
                This will immediately unblock{" "}
                <strong style={{ color: "var(--cyan)" }}>
                  {dependents.map((d) => d.id).join(", ")}
                </strong>{" "}
                in the dependency graph.
              </span>
            ) : (
              <span style={{ display: "inline-block", marginTop: 6 }}>
                This will record a completed sign-off in the operational audit trail.
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--text-lo)", fontWeight: 600 }}>
              Audit Justification / Out-of-Band Verification Reason:
            </label>
            <input
              type="text"
              style={{
                padding: "9px 12px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 8,
                color: "var(--text-hi)",
                fontSize: 12,
                outline: "none",
              }}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Manually checked logs, verified on primary console"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
