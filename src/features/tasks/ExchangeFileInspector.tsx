import React, { useState, useMemo } from "react";
import { useTaskStore } from "../../stores/useTaskStore";
import type { ExchangeSegment, ExchangeFileItem } from "../../data/exchangeManifest";
import "./ExchangeInspector.css";

export function ExchangeFileInspector() {
  const {
    checklists,
    selectedShift,
    inspectorOpen,
    setInspectorOpen,
    setTaskStatusToOk,
    currentPersona,
    updateExchangeFileStatus,
  } = useTaskStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState(
    "Verified all master & margin files synced to NetApp storage."
  );

  // Retrieve M1 task from Morning shift
  const m1 = checklists["Morning"]?.find((r) => r.id === "M1");
  const manifest = m1?.fileManifest;

  const files = manifest?.files || [];
  const total = manifest?.totalExpected || 0;
  const downloaded = manifest?.downloadedCount || 0;
  const pending = manifest?.pendingCount || 0;
  const isCompleted = m1?.status === "completed";
  const progressPct = total > 0 ? Math.round((downloaded / total) * 100) : 0;

  // Segment Tab Options
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

  // Filtered files
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // Search filter
      if (
        searchQuery &&
        !file.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !file.folderPath.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !file.id.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Segment filter
      if (selectedSegment !== "ALL") {
        if (selectedSegment === "CCIL" && file.exchange !== "CCIL") return false;
        if (selectedSegment !== "CCIL" && file.segment !== selectedSegment) return false;
      }

      // Status filter
      if (statusFilter !== "ALL" && file.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [files, searchQuery, selectedSegment, statusFilter]);

  if (!inspectorOpen) return null;

  function handleSetToOk() {
    setTaskStatusToOk(
      "Morning",
      "M1",
      currentPersona.name,
      currentPersona.role,
      overrideReason
    );
    setShowConfirmModal(false);
  }

  return (
    <div className="inspector-backdrop" onClick={() => setInspectorOpen(false)}>
      <div className="inspector-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="inspector-header">
          <div className="inspector-title-group">
            <div className="inspector-title">
              <span>📁</span>
              <span>Exchange File Ingestion — NetApp Storage Inspector</span>
              {isCompleted ? (
                <span
                  style={{
                    fontSize: 11,
                    background: "rgba(51, 209, 122, 0.2)",
                    color: "var(--green)",
                    padding: "3px 8px",
                    borderRadius: 4,
                    border: "1px solid rgba(51, 209, 122, 0.4)",
                  }}
                >
                  ✓ SET TO OK
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
                  }}
                >
                  LIVE INGESTION
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="inspector-host-chip mono">
                Target: 10.240.18.52 (/data/netapp/exchanges/)
              </span>
              <span style={{ fontSize: 11, color: "var(--text-lo)" }}>
                Expected BOD cycle: 00:30 IST
              </span>
            </div>
          </div>

          <button
            className="inspector-close-btn"
            onClick={() => setInspectorOpen(false)}
            title="Close inspector"
          >
            ✕
          </button>
        </div>

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
                outline: "none",
              }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="downloaded">Downloaded Only</option>
              <option value="pending">Pending Only</option>
            </select>
          </div>

          <div className="segment-tabs-row">
            {segmentTabs.map((tab) => (
              <button
                key={tab.id}
                className={`seg-tab-btn${selectedSegment === tab.id ? " active" : ""}${
                  tab.fortnightly ? " fortnightly" : ""
                }`}
                onClick={() => setSelectedSegment(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Files Table */}
        <div className="inspector-table-container">
          <table className="files-manifest-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>File ID</th>
                <th>File Name</th>
                <th>NetApp Directory</th>
                <th>Exchange / Segment</th>
                <th>Category</th>
                <th>Size</th>
                <th>Ingestion Time</th>
                <th>Status</th>
                <th style={{ width: 100 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <tr key={file.id}>
                  <td className="mono" style={{ color: "var(--text-lo)" }}>
                    {file.id}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{file.name}</span>
                    {file.isFortnightly && (
                      <span className="fortnightly-badge">Fortnightly Cycle</span>
                    )}
                  </td>
                  <td className="mono" style={{ color: "var(--text-lo)", fontSize: 11 }}>
                    {file.folderPath}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: "rgba(255, 255, 255, 0.06)",
                      }}
                    >
                      {file.exchange} · {file.subfolder}
                    </span>
                  </td>
                  <td>
                    <span style={{ textTransform: "capitalize", color: "var(--text-lo)" }}>
                      {file.category.replace("_", " ")}
                    </span>
                  </td>
                  <td className="mono">
                    {file.sizeKb > 1024
                      ? `${(file.sizeKb / 1024).toFixed(1)} MB`
                      : `${file.sizeKb} KB`}
                  </td>
                  <td className="mono" style={{ fontSize: 11, color: "var(--text-lo)" }}>
                    {file.downloadedAt ? `${file.downloadedAt} IST` : "Awaiting sync"}
                  </td>
                  <td>
                    <span className={`file-status-pill ${file.status}`}>
                      {file.status === "downloaded" ? "✓ Ready" : "⏳ Pending"}
                    </span>
                  </td>
                  <td>
                    {file.status === "pending" ? (
                      <button
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "rgba(51, 209, 122, 0.15)",
                          color: "var(--green)",
                          border: "1px solid rgba(51, 209, 122, 0.3)",
                        }}
                        onClick={() => updateExchangeFileStatus(file.id, "downloaded")}
                        title="Mark single file as downloaded"
                      >
                        Set Ready
                      </button>
                    ) : (
                      <span style={{ color: "var(--text-lo)", fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}

              {filteredFiles.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      textAlign: "center",
                      padding: "48px 12px",
                      color: "var(--text-lo)",
                    }}
                  >
                    No exchange files matched the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="inspector-footer">
          <div className="footer-hint">
            <span>ℹ️</span>
            <span>
              NetApp files sync every morning. Setting this task to OK stamps an audit event and unlocks downstream processes (K2, Greeksoft, DB Query).
            </span>
          </div>

          <button
            className="manual-ok-btn"
            onClick={() => setShowConfirmModal(true)}
            disabled={isCompleted}
          >
            <span>{isCompleted ? "✓ Status Already OK" : "✓ Manual Set to OK"}</span>
          </button>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="confirm-backdrop">
            <div className="confirm-card">
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--amber)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>⚠️</span>
                <span>Confirm Manual Override: Exchange Files</span>
              </div>

              <div style={{ fontSize: 13, color: "var(--text-hi)", lineHeight: 1.5 }}>
                You are about to mark <strong>Exchange File Download</strong> as{" "}
                <span style={{ color: "var(--green)", fontWeight: 700 }}>COMPLETED (OK)</span>.
                This will automatically:
                <ul style={{ margin: "8px 0 8px 20px", fontSize: 12, color: "var(--text-lo)" }}>
                  <li>Mark all {total} NetApp exchange files as downloaded</li>
                  <li>Unlock downstream dependent tasks: <strong>K2 Mails</strong> and <strong>Greeksoft BOD</strong></li>
                  <li>Log an irreversible audit event stamped under <strong>{currentPersona.name} ({currentPersona.role})</strong></li>
                </ul>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: "var(--text-lo)" }}>
                  Audit Reason / Runbook Reference:
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
                  onClick={handleSetToOk}
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
