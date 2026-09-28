import React, { useState } from "react";
import { useTaskStore } from "../../stores/useTaskStore";
import type { ChecklistItem, PipelineId, VerificationConfig } from "../../data/roster";

export function NodeBuilderModal() {
  const {
    nodeBuilderOpen,
    setNodeBuilderOpen,
    selectedShift,
    checklists,
    addCustomTaskNode,
    currentPersona,
  } = useTaskStore();

  const rows = checklists[selectedShift] || [];

  // Form states
  const nextId = `${selectedShift[0]}${rows.length + 1}`;
  const [processName, setProcessName] = useState("");
  const [desc, setDesc] = useState("");
  const [time, setTime] = useState("07:15");
  const [mode, setMode] = useState<"Auto" | "Manual" | "Auto/Manual">("Auto/Manual");
  const [pipeline, setPipeline] = useState<PipelineId>("exchange");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("high");
  const [executor, setExecutor] = useState("ControlM");
  const [role, setRole] = useState("L1 Support");
  const [selectedParents, setSelectedParents] = useState<string[]>(["M1"]);

  // Verification config states
  const [verifType, setVerifType] = useState<VerificationConfig["type"]>("log_grep");
  const [serverIp, setServerIp] = useState("10.240.18.90");
  const [logPath, setLogPath] = useState("/var/log/marketdata/custom_process.log");
  const [grepRegex, setGrepRegex] = useState("PIPELINE_INIT_SUCCESS");

  if (!nodeBuilderOpen) return null;

  function toggleParent(id: string) {
    if (selectedParents.includes(id)) {
      setSelectedParents(selectedParents.filter((p) => p !== id));
    } else {
      setSelectedParents([...selectedParents, id]);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!processName.trim()) return;

    const newItem: ChecklistItem = {
      id: nextId,
      process: processName.trim(),
      desc: desc.trim() || undefined,
      time,
      mode,
      executor,
      role,
      priority,
      status: "open",
      dependsOn: selectedParents,
      pipeline,
      verification: {
        type: verifType,
        serverIp: serverIp.trim() || undefined,
        logPath: logPath.trim() || undefined,
        grepRegex: grepRegex.trim() || undefined,
      },
    };

    addCustomTaskNode(selectedShift, newItem);
  }

  return (
    <div className="inspector-backdrop" onClick={() => setNodeBuilderOpen(false)}>
      <div
        className="inspector-dialog"
        style={{ maxWidth: 680, height: "auto", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inspector-header">
          <div className="inspector-title">
            <span>+</span>
            <span>Add Prototype Task Node to DAG ({selectedShift} Shift)</span>
          </div>
          <button
            className="inspector-close-btn"
            onClick={() => setNodeBuilderOpen(false)}
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Row 1: ID, Title, Scheduled Time */}
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
                Node ID
              </label>
              <input
                type="text"
                disabled
                value={nextId}
                className="inspector-search-input mono"
                style={{ opacity: 0.7 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
                Process Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., RefData Master Sync, Metanoia..."
                className="inspector-search-input"
                value={processName}
                onChange={(e) => setProcessName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
                Time (IST)
              </label>
              <input
                type="text"
                className="inspector-search-input mono"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
              Task Description
            </label>
            <input
              type="text"
              placeholder="What does this process do and what files/feeds does it consume?"
              className="inspector-search-input"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          {/* Row 2: Pipeline, Priority, Mode */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
                Pipeline Track
              </label>
              <select
                className="inspector-search-input"
                value={pipeline}
                onChange={(e) => setPipeline(e.target.value as PipelineId)}
              >
                <option value="exchange">Exchange Ingestion & BOD</option>
                <option value="market_data">Market Feeds & TBT</option>
                <option value="execution">Order Gateways & Risk</option>
                <option value="infra">Infra & Compliance</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
                Priority
              </label>
              <select
                className="inspector-search-input"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
                Execution Mode
              </label>
              <select
                className="inspector-search-input"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
              >
                <option value="Auto">Auto</option>
                <option value="Manual">Manual</option>
                <option value="Auto/Manual">Auto/Manual</option>
              </select>
            </div>
          </div>

          {/* Row 3: Executor and RBAC Role */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
                Executor Team
              </label>
              <input
                type="text"
                className="inspector-search-input"
                value={executor}
                onChange={(e) => setExecutor(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
                RBAC Sign-off Role
              </label>
              <select
                className="inspector-search-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="L1 Support">L1 Support</option>
                <option value="L2 Support">L2 Support</option>
                <option value="Shift Lead">Shift Lead</option>
                <option value="Principal">Principal</option>
              </select>
            </div>
          </div>

          {/* Prerequisite Dependencies Multi-select */}
          <div>
            <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 6 }}>
              Prerequisite Dependencies (Select parent tasks that must finish before this node):
            </label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                padding: 10,
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 8,
                maxHeight: 120,
                overflowY: "auto",
              }}
            >
              {rows.map((parent) => {
                const isSelected = selectedParents.includes(parent.id);
                return (
                  <button
                    key={parent.id}
                    type="button"
                    className={`seg-tab-btn${isSelected ? " active" : ""}`}
                    onClick={() => toggleParent(parent.id)}
                  >
                    <span>{isSelected ? "✓" : "+"}</span>
                    <span>
                      {parent.id}: {parent.process.slice(0, 24)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Automated Telemetry & Grep Configuration Box */}
          <div
            style={{
              padding: 14,
              borderRadius: 8,
              background: "rgba(79, 217, 208, 0.04)",
              border: "1px solid rgba(79, 217, 208, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--cyan)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>⚙️</span>
              <span>Automated Telemetry & Grep Verification Prototype</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
                  Check Type
                </label>
                <select
                  className="inspector-search-input"
                  value={verifType}
                  onChange={(e) => setVerifType(e.target.value as any)}
                >
                  <option value="log_grep">Remote Log Grep</option>
                  <option value="db_query">DB Integrity Query</option>
                  <option value="ssh_exec">SSH Command</option>
                  <option value="manual">Manual Sign-off</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 10, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
                  Server Host / IP
                </label>
                <input
                  type="text"
                  placeholder="e.g., 10.240.18.90"
                  className="inspector-search-input mono"
                  value={serverIp}
                  onChange={(e) => setServerIp(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 10, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
                Log File Path on Remote Host
              </label>
              <input
                type="text"
                placeholder="/var/log/... or /netapp/..."
                className="inspector-search-input mono"
                value={logPath}
                onChange={(e) => setLogPath(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 10, color: "var(--text-lo)", display: "block", marginBottom: 4 }}>
                Regex Match Pattern (String required for task to be set to OK)
              </label>
              <input
                type="text"
                placeholder="e.g. \[READY\] Trade feed connected"
                className="inspector-search-input mono"
                value={grepRegex}
                onChange={(e) => setGrepRegex(e.target.value)}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="dag-btn"
              onClick={() => setNodeBuilderOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="manual-ok-btn">
              <span>+ Insert Node into DAG</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
