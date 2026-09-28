import React, { useState, useMemo } from "react";
import { useTaskStore } from "../../stores/useTaskStore";
import type { ChecklistItem } from "../../data/roster";
import "./ExchangeInspector.css";

export function ExchangeFileInspector() {
  const {
    checklists,
    selectedShift,
    inspectorOpen,
    setInspectorOpen,
    selectedTaskId,
    setSelectedTaskId,
    setTaskStatusToOk,
    advanceStatus,
    currentPersona,
    getNodeDerivedStatus,
  } = useTaskStore();

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

  if (!inspectorOpen || !currentTask) return null;

  function handleOpenConfirm(defaultReason?: string) {
    setOverrideReason(
      defaultReason ||
        `Verified operational readiness for ${currentTask?.process || currentTask?.id}. Manual sign-off by Shift Lead.`
    );
    setShowConfirmModal(true);
  }

  function handleConfirmSetToOk() {
    if (!currentTask) return;
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
    if (!currentTask) return;
    advanceStatus(selectedShift, currentTask.id, currentPersona.name, currentPersona.role);
  }

  return (
    <div className="inspector-backdrop" onClick={() => setInspectorOpen(false)}>
      <div className="inspector-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="inspector-header">
          <div className="inspector-title-group">
            <div className="inspector-title">
              <span>{isManifestTask ? "📁" : "⚡"}</span>
              <span>
                {currentTask.id} · {currentTask.process}
              </span>
              <span className={`node-priority ${currentTask.priority}`}>
                {currentTask.priority}
              </span>
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
                  }}
                >
                  ✓ COMPLETED
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
                  }}
                >
                  ⏳ BLOCKED
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

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
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
                className="manual-ok-btn"
                style={{ padding: "6px 14px", fontSize: 12 }}
                onClick={() => handleOpenConfirm()}
                title="Override and mark task as completed immediately"
              >
                <span>✓</span> Set to OK
              </button>
            )}

            <button
              className="inspector-close-btn"
              onClick={() => setInspectorOpen(false)}
              title="Close inspector"
            >
              ✕
            </button>
          </div>
        </div>

        {/* --- VIEW MODE 1: Exchange File Manifest View (M1) --- */}
        {isManifestTask && (
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
                <span className="metric-label" style={{ color: "var(--amber)" }}>
                  Pending / Awaiting
                </span>
                <span className="metric-value mono" style={{ color: "var(--amber)" }}>
                  {pending}
                </span>
              </div>

              <div className="inspector-metric-card">
                <span className="metric-label">Filtered</span>
                <span className="metric-value mono" style={{ color: "var(--cyan)" }}>
                  {filteredFiles.length}
                </span>
              </div>

              <div className="inspector-progress-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: "var(--text-hi)", fontWeight: 600 }}>
                    BOD Ingestion Progress
                  </span>
                  <span className="mono" style={{ color: "var(--cyan)", fontWeight: 700 }}>
                    {progressPct}%
                  </span>
                </div>
                <div className="manifest-progress-bg">
                  <div
                    className="manifest-progress-fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="inspector-filter-bar">
              <div className="filter-search-row">
                <input
                  type="text"
                  className="inspector-search-input"
                  placeholder="Search filename (e.g., fo_contract.txt, spancirc, security.csv, mcx)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <select
                  style={{
                    padding: "8px 12px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: 6,
                    color: "var(--text-hi)",
                    fontSize: 12,
                  }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All File Statuses</option>
                  <option value="downloaded">Downloaded Only</option>
                  <option value="pending">Pending Only</option>
                  <option value="failed">Failed Only</option>
                </select>
              </div>

              {/* Segment Filter Tabs */}
              <div className="segment-pills-row">
                {segmentTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`segment-pill${selectedSegment === tab.id ? " active" : ""}`}
                    onClick={() => setSelectedSegment(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Files Grid / Table */}
            <div className="inspector-files-table-container">
              <table className="inspector-table">
                <thead>
                  <tr>
                    <th>Segment</th>
                    <th>Filename</th>
                    <th>Storage Path (NetApp)</th>
                    <th>Size</th>
                    <th>Expected</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file) => (
                    <tr key={file.id}>
                      <td className="mono" style={{ fontSize: 11, color: "var(--cyan)" }}>
                        {file.exchange} / {file.segment}
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--text-hi)" }}>
                        {file.name}
                      </td>
                      <td className="mono" style={{ fontSize: 11, color: "var(--text-lo)" }}>
                        {file.folderPath}
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        {file.sizeKb ? `${file.sizeKb} KB` : "—"}
                      </td>
                      <td className="mono" style={{ fontSize: 11, color: "var(--text-lo)" }}>
                        {file.expectedTime}
                      </td>
                      <td>
                        <span className={`file-status-pill ${file.status}`}>
                          {file.status === "downloaded"
                            ? "✓ Downloaded"
                            : file.status === "pending"
                            ? "⏳ Pending"
                            : "✕ Failed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* --- VIEW MODE 2: General Task Diagnostics & Operations View --- */}
        {!isManifestTask && (
          <div className="inspector-task-detail-container">
            <div className="inspector-task-layout">
              {/* Left Column: Prerequisites, Dependents & Runbook */}
              <div className="inspector-left-pane">
                {/* Description & Overview */}
                <div className="inspector-card">
                  <div className="inspector-card-title">📖 Runbook Description & Process Overview</div>
                  <div style={{ fontSize: 13, color: "var(--text-hi)", lineHeight: 1.6 }}>
                    {currentTask.desc || "Standard operating procedure execution step for market readiness."}
                  </div>
                </div>

                {/* Prerequisites (Upstream) */}
                <div className="inspector-card">
                  <div className="inspector-card-title">
                    <span>⬆️ Upstream Prerequisites ({parents.length})</span>
                    {isBlocked && (
                      <span style={{ fontSize: 11, color: "var(--amber)", fontWeight: 600 }}>
                        ⚠️ Awaiting completion
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
                              {parentCompleted ? "✓ Completed" : "⏳ Pending"}
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
                    <span>⬇️ Downstream Dependent Pipelines ({dependents.length})</span>
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
                    <span>💻 Verification Diagnostics & Server Logs</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--green)" }}>
                      ● DAEMON ACTIVE
                    </span>
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
                      ✓ Sign-Off & Audit Trail
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

        {/* Footer Action Bar */}
        <div className="inspector-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "var(--text-lo)" }}>
              Active Operator Persona:{" "}
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
                }}
              >
                ⚠️ Upstream prerequisites pending
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {!isCompleted && !isBlocked && (
              <button
                className="dag-btn"
                onClick={handleAdvance}
                title="Advance task status"
              >
                ▶ Advance Status
              </button>
            )}

            {!isCompleted && (
              <button
                className="manual-ok-btn"
                onClick={() => handleOpenConfirm()}
                title="Override and mark task as completed immediately"
              >
                <span>✓</span> Manual Set to OK
              </button>
            )}

            <button className="dag-btn" onClick={() => setInspectorOpen(false)}>
              Close
            </button>
          </div>
        </div>

        {/* Override Confirmation Modal Dialog */}
        {showConfirmModal && (
          <div
            className="inspector-backdrop"
            style={{ zIndex: 1100, background: "rgba(0, 0, 0, 0.85)" }}
            onClick={() => setShowConfirmModal(false)}
          >
            <div
              className="inspector-dialog"
              style={{
                maxWidth: 580,
                height: "auto",
                maxHeight: "90vh",
                padding: 24,
                gap: 16,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text-hi)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>⚠️</span>
                <span>Confirm Manual Override: {currentTask.id}</span>
              </div>

              <div style={{ fontSize: 13, color: "var(--text-hi)", lineHeight: 1.5 }}>
                You are about to mark <strong>{currentTask.process} ({currentTask.id})</strong> as{" "}
                <span style={{ color: "var(--green)", fontWeight: 700 }}>COMPLETED (OK)</span>.
                <br />
                {dependents.length > 0 ? (
                  <>
                    This will immediately unblock{" "}
                    <strong>{dependents.map((d) => d.id).join(", ")}</strong> in the dependency graph.
                  </>
                ) : (
                  <>This will record a completed sign-off in the operational audit trail.</>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: "var(--text-lo)" }}>
                  Audit Justification / Out-of-Band Verification Reason:
                </label>
                <input
                  type="text"
                  style={{
                    padding: "8px 12px",
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: 6,
                    color: "var(--text-hi)",
                    fontSize: 12,
                    outline: "none",
                  }}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Manually checked logs, verified on primary console"
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <button
                  className="dag-btn"
                  onClick={() => setShowConfirmModal(false)}
                >
                  Cancel
                </button>

                <button
                  className="manual-ok-btn"
                  onClick={handleConfirmSetToOk}
                >
                  Confirm & Set to OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
