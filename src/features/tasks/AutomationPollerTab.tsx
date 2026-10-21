import React, { useState, useEffect } from "react";
import { useTaskStore } from "../../stores/useTaskStore";
import { usePermissions } from "../../hooks/usePermissions";
import { syncClient } from "../../lib/syncClient";

interface AutomationPollerTabProps {
  taskId: string;
  taskTitle: string;
  isCompleted: boolean;
  onSetTaskStatusToOk: () => void;
}

interface AutomationRuleState {
  enabled: boolean;
  scriptPath: string;
  args: string;
  expectedExitCode: number;
  matchMode: "exit_code_only" | "stdout_regex" | "stdout_contains" | "stdout_json_metric";
  matchPattern: string;
  jsonMetricKey: string;
  jsonMetricExpected: string;
  pollIntervalSec: number;
}

interface ProbeExecutionResponse {
  execution: {
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    executionTimeMs: number;
    error?: string;
    timedOut?: boolean;
  };
  evaluation: {
    matched: boolean;
    matchDetail: string;
    metrics?: Record<string, any>;
  };
}

export function AutomationPollerTab({
  taskId,
  taskTitle,
  isCompleted,
  onSetTaskStatusToOk,
}: AutomationPollerTabProps) {
  const { currentPersona } = useTaskStore();
  const { canRunProbe, canManageAutomation } = usePermissions();

  const [rule, setRule] = useState<AutomationRuleState>({
    enabled: true,
    scriptPath: `/opt/scripts/${taskId.toLowerCase()}_check.sh`,
    args: "--summary",
    expectedExitCode: 0,
    matchMode: "stdout_regex",
    matchPattern: "SUCCESS|COMPLETED|OK",
    jsonMetricKey: "status",
    jsonMetricExpected: "COMPLETED",
    pollIntervalSec: 15,
  });

  const [loadingRule, setLoadingRule] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [runningProbe, setRunningProbe] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeExecutionResponse | null>(null);
  const [probeError, setProbeError] = useState("");

  // Load automation rule for active task
  useEffect(() => {
    let isCurrent = true;
    async function loadRule() {
      setLoadingRule(true);
      setSaveSuccess(false);
      setSaveError("");
      setProbeResult(null);
      setProbeError("");
      try {
        const res = await fetch(`http://localhost:3001/api/automation/${encodeURIComponent(taskId)}`, {
          headers: { ...syncClient.getAuthHeaders() },
        });
        if (res.ok && isCurrent) {
          const data = await res.json();
          if (data.rule) {
            setRule({
              enabled: Boolean(data.rule.enabled),
              scriptPath: data.rule.scriptPath || `/opt/scripts/${taskId.toLowerCase()}_check.sh`,
              args: Array.isArray(data.rule.args) ? data.rule.args.join(" ") : "",
              expectedExitCode: data.rule.expectedExitCode ?? 0,
              matchMode: data.rule.matchMode || "exit_code_only",
              matchPattern: data.rule.matchPattern || "",
              jsonMetricKey: data.rule.jsonMetricKey || "status",
              jsonMetricExpected: data.rule.jsonMetricExpected !== undefined ? String(data.rule.jsonMetricExpected) : "",
              pollIntervalSec: data.rule.pollIntervalSec || 15,
            });
          }
        }
      } catch (err) {
        console.warn(`Could not load automation rule for ${taskId}:`, err);
      } finally {
        if (isCurrent) setLoadingRule(false);
      }
    }
    loadRule();
    return () => {
      isCurrent = false;
    };
  }, [taskId]);

  async function handleSaveRule(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!canManageAutomation) {
      setSaveError("Saving automation rules requires System Admin permissions (automation:manage)");
      return;
    }

    if (!rule.scriptPath.trim()) {
      setSaveError("Script path is required");
      return;
    }

    setSavingRule(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const payload = {
        taskId,
        enabled: rule.enabled,
        scriptPath: rule.scriptPath.trim(),
        args: rule.args ? rule.args.trim().split(/\s+/).filter(Boolean) : [],
        expectedExitCode: Number(rule.expectedExitCode) || 0,
        matchMode: rule.matchMode,
        matchPattern: rule.matchPattern,
        jsonMetricKey: rule.jsonMetricKey,
        jsonMetricExpected: rule.jsonMetricExpected,
        pollIntervalSec: Number(rule.pollIntervalSec) || 15,
        operator: currentPersona.name,
      };

      const res = await fetch(`http://localhost:3001/api/automation/${encodeURIComponent(taskId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...syncClient.getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
        const data = await res.json();
        setSaveError(data.error || "Failed to save rule");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(`Network error: ${msg}`);
    } finally {
      setSavingRule(false);
    }
  }

  async function handleRunProbeNow() {
    if (!canRunProbe) {
      setProbeError("Running SSH test probes requires L2 Engineer, Supervisor, or Admin permissions (ssh:run_probe)");
      return;
    }

    if (!rule.scriptPath.trim()) {
      setProbeError("Please specify a script path before testing");
      return;
    }

    setRunningProbe(true);
    setProbeError("");
    setProbeResult(null);

    try {
      const payload = {
        taskId,
        scriptPath: rule.scriptPath.trim(),
        args: rule.args ? rule.args.trim().split(/\s+/).filter(Boolean) : [],
        expectedExitCode: Number(rule.expectedExitCode) || 0,
        matchMode: rule.matchMode,
        matchPattern: rule.matchPattern,
        jsonMetricKey: rule.jsonMetricKey,
        jsonMetricExpected: rule.jsonMetricExpected,
      };

      const res = await fetch("http://localhost:3001/api/automation/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...syncClient.getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setProbeError(data.error || "Probe execution failed");
      } else {
        setProbeResult(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setProbeError(`Probe error: ${msg}`);
    } finally {
      setRunningProbe(false);
    }
  }

  function applyPreset(presetType: "bod_report" | "exit_code" | "json_metric") {
    if (presetType === "bod_report") {
      setRule((prev) => ({
        ...prev,
        scriptPath: "/opt/scripts/bod_exchange_report.sh",
        args: "--summary --strict",
        matchMode: "stdout_regex",
        matchPattern: "(DOWNLOAD_COMPLETE|STATUS_OK|ALL_FILES_SYNCED)",
        expectedExitCode: 0,
      }));
    } else if (presetType === "exit_code") {
      setRule((prev) => ({
        ...prev,
        scriptPath: `/opt/scripts/check_${taskId.toLowerCase()}.sh`,
        args: "",
        matchMode: "exit_code_only",
        expectedExitCode: 0,
      }));
    } else if (presetType === "json_metric") {
      setRule((prev) => ({
        ...prev,
        scriptPath: `/opt/scripts/status_metrics.py`,
        args: `--task ${taskId}`,
        matchMode: "stdout_json_metric",
        jsonMetricKey: "status",
        jsonMetricExpected: "SUCCESS",
        expectedExitCode: 0,
      }));
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr", gap: 20, height: "100%", padding: "16px 24px", overflowY: "auto" }}>
      {/* Left Column: Automation Rule Config Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-hi)", display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚙</span> Automation & Verification Rules
            </h3>
            <p style={{ fontSize: 11, color: "var(--text-lo)", marginTop: 2 }}>
              Configure SSH script path and criteria for task <strong className="mono" style={{ color: "var(--cyan)" }}>{taskId}</strong>
            </p>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: "#4FD9D0", cursor: "pointer" }}
            />
            <span style={{ color: rule.enabled ? "var(--cyan)" : "var(--text-lo)" }}>
              {rule.enabled ? "DAEMON ACTIVE" : "DAEMON PAUSED"}
            </span>
          </label>
        </div>

        {/* Preset Chips */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "var(--text-lo)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            PRESETS:
          </span>
          <button
            type="button"
            onClick={() => applyPreset("bod_report")}
            style={{
              padding: "3px 8px",
              background: "rgba(79, 217, 208, 0.08)",
              border: "1px solid rgba(79, 217, 208, 0.25)",
              borderRadius: 4,
              fontSize: 10,
              color: "var(--cyan)",
            }}
          >
            BOD Report Script
          </button>
          <button
            type="button"
            onClick={() => applyPreset("exit_code")}
            style={{
              padding: "3px 8px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 4,
              fontSize: 10,
              color: "var(--text-lo)",
            }}
          >
            Exit Code 0
          </button>
          <button
            type="button"
            onClick={() => applyPreset("json_metric")}
            style={{
              padding: "3px 8px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 4,
              fontSize: 10,
              color: "var(--text-lo)",
            }}
          >
            JSON Stream
          </button>
        </div>

        {saveError && (
          <div style={{ padding: "8px 12px", background: "rgba(255, 77, 94, 0.1)", border: "1px solid rgba(255, 77, 94, 0.3)", borderRadius: 6, color: "var(--red)", fontSize: 11 }}>
            ⚠ {saveError}
          </div>
        )}

        {saveSuccess && (
          <div style={{ padding: "8px 12px", background: "rgba(51, 209, 122, 0.1)", border: "1px solid rgba(51, 209, 122, 0.3)", borderRadius: 6, color: "var(--green)", fontSize: 11 }}>
            ✓ Automation rule updated and synced to background poller!
          </div>
        )}

        <form onSubmit={handleSaveRule} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Script Path */}
          <div>
            <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4, fontWeight: 600 }}>
              REMOTE SCRIPT / EXECUTABLE PATH *
            </label>
            <input
              type="text"
              required
              placeholder="/opt/scripts/bod_check.sh or /usr/local/bin/verify_feed.py"
              value={rule.scriptPath}
              onChange={(e) => setRule({ ...rule, scriptPath: e.target.value })}
              className="mono"
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: 6,
                color: "var(--text-hi)",
                fontSize: 12,
              }}
            />
          </div>

          {/* Arguments & Interval */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4, fontWeight: 600 }}>
                SCRIPT ARGUMENTS / FLAGS
              </label>
              <input
                type="text"
                placeholder="--summary --date today"
                value={rule.args}
                onChange={(e) => setRule({ ...rule, args: e.target.value })}
                className="mono"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 6,
                  color: "var(--text-hi)",
                  fontSize: 12,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4, fontWeight: 600 }}>
                POLL INTERVAL (SEC)
              </label>
              <input
                type="number"
                min={5}
                max={3600}
                value={rule.pollIntervalSec}
                onChange={(e) => setRule({ ...rule, pollIntervalSec: parseInt(e.target.value, 10) || 15 })}
                className="mono"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 6,
                  color: "var(--text-hi)",
                  fontSize: 12,
                }}
              />
            </div>
          </div>

          {/* Match Mode */}
          <div>
            <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4, fontWeight: 600 }}>
              VERIFICATION SUCCESS EVALUATION MODE
            </label>
            <select
              value={rule.matchMode}
              onChange={(e) => setRule({ ...rule, matchMode: e.target.value as any })}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: 6,
                color: "var(--text-hi)",
                fontSize: 12,
              }}
            >
              <option value="exit_code_only">Exit Code Only (Process returns 0)</option>
              <option value="stdout_regex">Exit Code 0 + Stdout Matches Regular Expression</option>
              <option value="stdout_contains">Exit Code 0 + Stdout Contains Substring</option>
              <option value="stdout_json_metric">Exit Code 0 + Stdout JSON Metric Value</option>
            </select>
          </div>

          {/* Regex / Substring Match Pattern */}
          {(rule.matchMode === "stdout_regex" || rule.matchMode === "stdout_contains") && (
            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4, fontWeight: 600 }}>
                {rule.matchMode === "stdout_regex" ? "REGEX PATTERN (CASE-INSENSITIVE)" : "EXPECTED SUBSTRING"}
              </label>
              <input
                type="text"
                placeholder={rule.matchMode === "stdout_regex" ? "e.g., (SUCCESS|COMPLETED|STATUS_OK)" : "e.g., PROCESS_OK"}
                value={rule.matchPattern}
                onChange={(e) => setRule({ ...rule, matchPattern: e.target.value })}
                className="mono"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 6,
                  color: "var(--cyan)",
                  fontSize: 12,
                }}
              />
            </div>
          )}

          {/* JSON Metric Fields */}
          {rule.matchMode === "stdout_json_metric" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4, fontWeight: 600 }}>
                  JSON KEY
                </label>
                <input
                  type="text"
                  placeholder="e.g., status or downloaded"
                  value={rule.jsonMetricKey}
                  onChange={(e) => setRule({ ...rule, jsonMetricKey: e.target.value })}
                  className="mono"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: 6,
                    color: "var(--text-hi)",
                    fontSize: 12,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4, fontWeight: 600 }}>
                  EXPECTED VALUE
                </label>
                <input
                  type="text"
                  placeholder="e.g., COMPLETED or 100"
                  value={rule.jsonMetricExpected}
                  onChange={(e) => setRule({ ...rule, jsonMetricExpected: e.target.value })}
                  className="mono"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: 6,
                    color: "var(--text-hi)",
                    fontSize: 12,
                  }}
                />
              </div>
            </div>
          )}

          {/* Expected Exit Code */}
          <div>
            <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 4, fontWeight: 600 }}>
              EXPECTED EXIT STATUS CODE
            </label>
            <input
              type="number"
              value={rule.expectedExitCode}
              onChange={(e) => setRule({ ...rule, expectedExitCode: parseInt(e.target.value, 10) || 0 })}
              className="mono"
              style={{
                width: 100,
                padding: "8px 12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: 6,
                color: "var(--text-hi)",
                fontSize: 12,
              }}
            />
          </div>

          <button
            type="submit"
            disabled={savingRule || !canManageAutomation}
            title={
              canManageAutomation
                ? "Save automation configuration"
                : "Saving automation rules requires System Admin permissions (automation:manage)"
            }
            style={{
              padding: "10px 16px",
              marginTop: 6,
              background: "rgba(79, 217, 208, 0.15)",
              border: "1px solid rgba(79, 217, 208, 0.4)",
              borderRadius: 8,
              color: "var(--cyan)",
              fontSize: 12,
              fontWeight: 700,
              cursor: canManageAutomation ? "pointer" : "not-allowed",
              opacity: canManageAutomation ? 1 : 0.45,
              transition: "all 0.2s ease",
            }}
          >
            {savingRule ? "Saving Rule..." : "💾 Save Automation Configuration"}
          </button>
        </form>
      </div>

      {/* Right Column: Live Interactive Runner */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-hi)", display: "flex", alignItems: "center", gap: 8 }}>
              <span>💻</span> Interactive Live Probe Runner
            </h3>
            <p style={{ fontSize: 11, color: "var(--text-lo)", marginTop: 2 }}>
              Execute script immediately via SSH to test stdout and exit code matching
            </p>
          </div>

          <button
            type="button"
            disabled={runningProbe || !rule.scriptPath.trim() || !canRunProbe}
            onClick={handleRunProbeNow}
            title={
              canRunProbe
                ? "Execute script immediately via SSH"
                : "Running SSH test probes requires L2 Engineer, Supervisor, or Admin permissions (ssh:run_probe)"
            }
            style={{
              padding: "8px 16px",
              background: "linear-gradient(135deg, #4FD9D0 0%, #22c55e 100%)",
              border: "none",
              borderRadius: 8,
              color: "#06090F",
              fontSize: 12,
              fontWeight: 700,
              cursor: canRunProbe && !runningProbe ? "pointer" : "not-allowed",
              opacity: runningProbe || !canRunProbe ? 0.5 : 1,
              boxShadow: "0 4px 14px rgba(79, 217, 208, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>⚡</span>
            <span>{runningProbe ? "Executing via SSH..." : "Run Probe Now"}</span>
          </button>
        </div>

        {probeError && (
          <div style={{ padding: "10px 14px", background: "rgba(255, 77, 94, 0.12)", border: "1px solid rgba(255, 77, 94, 0.35)", borderRadius: 8, color: "var(--red)", fontSize: 12 }}>
            ⚠ {probeError}
          </div>
        )}

        {/* Terminal Window */}
        <div
          style={{
            flex: 1,
            minHeight: 280,
            background: "#03060d",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 10,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            overflowY: "auto",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
            boxShadow: "inset 0 2px 10px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Simulated shell prompt */}
          <div style={{ color: "rgba(255, 255, 255, 0.5)", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 6 }}>
            <span style={{ color: "var(--green)" }}>ops@central-server</span>:<span style={{ color: "var(--cyan)" }}>~</span>${" "}
            {rule.scriptPath} {rule.args}
          </div>

          {!probeResult && !runningProbe && (
            <div style={{ color: "var(--text-lo)", padding: "20px 0", textAlign: "center", fontStyle: "italic" }}>
              Click &quot;Run Probe Now&quot; to test script execution on the central reporting server.
            </div>
          )}

          {runningProbe && (
            <div style={{ color: "var(--cyan)", display: "flex", alignItems: "center", gap: 8, padding: "16px 0" }}>
              <span className="dot" style={{ background: "var(--cyan)", animation: "pulse 1s infinite" }} />
              Connecting to central host over SSH and running probe...
            </div>
          )}

          {probeResult && (
            <>
              {/* Metrics Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255, 255, 255, 0.03)", padding: "6px 10px", borderRadius: 6 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-lo)" }}>EXIT CODE:</span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: probeResult.execution.exitCode === rule.expectedExitCode ? "rgba(51, 209, 122, 0.2)" : "rgba(255, 77, 94, 0.2)",
                      color: probeResult.execution.exitCode === rule.expectedExitCode ? "var(--green)" : "var(--red)",
                      fontWeight: 700,
                    }}
                  >
                    {probeResult.execution.exitCode}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: "var(--text-lo)" }}>
                  LATENCY: <span style={{ color: "var(--text-hi)" }}>{probeResult.execution.executionTimeMs}ms</span>
                </div>
              </div>

              {/* Stdout Stream */}
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 10, color: "var(--text-lo)", textTransform: "uppercase", marginBottom: 2 }}>
                  STANDARD OUTPUT (STDOUT):
                </div>
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.4)",
                    padding: 10,
                    borderRadius: 6,
                    color: "var(--text-hi)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    maxHeight: 180,
                    overflowY: "auto",
                    borderLeft: "2px solid var(--cyan)",
                  }}
                >
                  {probeResult.execution.stdout || "(Empty stdout)"}
                </div>
              </div>

              {/* Stderr Stream if any */}
              {probeResult.execution.stderr && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: "var(--red)", textTransform: "uppercase", marginBottom: 2 }}>
                    STANDARD ERROR (STDERR):
                  </div>
                  <div
                    style={{
                      background: "rgba(255, 77, 94, 0.08)",
                      padding: 10,
                      borderRadius: 6,
                      color: "var(--red)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      maxHeight: 120,
                      overflowY: "auto",
                      borderLeft: "2px solid var(--red)",
                    }}
                  >
                    {probeResult.execution.stderr}
                  </div>
                </div>
              )}

              {/* Evaluation Result Banner */}
              <div
                style={{
                  marginTop: 6,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: probeResult.evaluation.matched ? "rgba(51, 209, 122, 0.15)" : "rgba(255, 176, 32, 0.15)",
                  border: `1px solid ${probeResult.evaluation.matched ? "rgba(51, 209, 122, 0.4)" : "rgba(255, 176, 32, 0.4)"}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      color: probeResult.evaluation.matched ? "var(--green)" : "var(--amber)",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {probeResult.evaluation.matched ? "✓ CRITERIA SATISFIED" : "✗ CRITERIA NOT SATISFIED"}
                  </span>

                  {probeResult.evaluation.matched && !isCompleted && (
                    <button
                      type="button"
                      onClick={onSetTaskStatusToOk}
                      style={{
                        padding: "4px 10px",
                        background: "var(--green)",
                        color: "#06090F",
                        fontWeight: 700,
                        fontSize: 11,
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      ✓ Mark Task Completed
                    </button>
                  )}
                </div>

                <div style={{ fontSize: 11, color: "var(--text-hi)" }}>
                  {probeResult.evaluation.matchDetail}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
