import React, { useState, useEffect } from "react";
import { useTaskStore } from "../../stores/useTaskStore";
import type { ChecklistItem, PipelineId, VerificationConfig } from "../../data/roster";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Plus, Check, Settings, Activity, Trash2, Save } from "lucide-react";
import "./NodeBuilderModal.css";

export function NodeBuilderModal() {
  const {
    nodeBuilderOpen,
    setNodeBuilderOpen,
    editingNode,
    setEditingNode,
    selectedShift,
    checklists,
    addCustomTaskNode,
    updateCustomTaskNode,
    deleteCustomTaskNode,
  } = useTaskStore();

  const isEdit = Boolean(editingNode);
  const rows = checklists[selectedShift] || [];

  // Form states
  const autoNextId = `${selectedShift[0]}${rows.length + 1}`;
  const [nodeId, setNodeId] = useState(autoNextId);
  const [processName, setProcessName] = useState("");
  const [desc, setDesc] = useState("");
  const [time, setTime] = useState("07:15");
  const [mode, setMode] = useState<"Auto" | "Manual" | "Auto/Manual">("Auto/Manual");
  const [pipeline, setPipeline] = useState<PipelineId>("exchange");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("high");
  const [executor, setExecutor] = useState("ControlM");
  const [role, setRole] = useState("L1 Support");
  const [selectedParents, setSelectedParents] = useState<string[]>([]);

  // Verification config states
  const [verifType, setVerifType] = useState<VerificationConfig["type"]>("log_grep");
  const [serverIp, setServerIp] = useState("10.240.18.90");
  const [logPath, setLogPath] = useState("/var/log/marketdata/custom_process.log");
  const [grepRegex, setGrepRegex] = useState("PIPELINE_INIT_SUCCESS");

  // Sync form when modal opens or editingNode changes
  useEffect(() => {
    if (editingNode) {
      setNodeId(editingNode.id);
      setProcessName(editingNode.process || "");
      setDesc(editingNode.desc || "");
      setTime(editingNode.time || "07:15");
      setMode((editingNode.mode as "Auto" | "Manual" | "Auto/Manual") || "Auto/Manual");
      setPipeline(editingNode.pipeline || "exchange");
      setPriority(editingNode.priority || "high");
      setExecutor(editingNode.executor || "ControlM");
      setRole(editingNode.role || "L1 Support");
      setSelectedParents(editingNode.dependsOn || []);
      setVerifType(editingNode.verification?.type || "log_grep");
      setServerIp(editingNode.verification?.serverIp || "10.240.18.90");
      setLogPath(editingNode.verification?.logPath || "/var/log/marketdata/custom_process.log");
      setGrepRegex(editingNode.verification?.grepRegex || "PIPELINE_INIT_SUCCESS");
    } else {
      setNodeId(autoNextId);
      setProcessName("");
      setDesc("");
      setTime("07:15");
      setMode("Auto/Manual");
      setPipeline("exchange");
      setPriority("high");
      setExecutor("ControlM");
      setRole("L1 Support");
      setSelectedParents(rows.length > 0 ? [rows[0].id] : []);
      setVerifType("log_grep");
      setServerIp("10.240.18.90");
      setLogPath("/var/log/marketdata/custom_process.log");
      setGrepRegex("PIPELINE_INIT_SUCCESS");
    }
  }, [editingNode, nodeBuilderOpen, selectedShift, rows.length]);

  function toggleParent(id: string) {
    if (selectedParents.includes(id)) {
      setSelectedParents(selectedParents.filter((p) => p !== id));
    } else {
      setSelectedParents([...selectedParents, id]);
    }
  }

  function handleClose() {
    setNodeBuilderOpen(false);
    setEditingNode(null);
  }

  function handleDelete() {
    if (!editingNode) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete task node "${editingNode.id} - ${editingNode.process}"? Any downstream dependencies will be safely unlinked.`
    );
    if (!confirmDelete) return;

    deleteCustomTaskNode(selectedShift, editingNode.id);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!processName.trim()) return;

    if (isEdit && editingNode) {
      const updatedItem: ChecklistItem = {
        ...editingNode,
        process: processName.trim(),
        desc: desc.trim() || undefined,
        time,
        mode,
        executor,
        role,
        priority,
        dependsOn: selectedParents.filter((p) => p !== editingNode.id),
        pipeline,
        verification: {
          type: verifType,
          serverIp: serverIp.trim() || undefined,
          logPath: logPath.trim() || undefined,
          grepRegex: grepRegex.trim() || undefined,
        },
      };

      updateCustomTaskNode(selectedShift, updatedItem);
    } else {
      const newItem: ChecklistItem = {
        id: nodeId,
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
        shift: selectedShift,
        verification: {
          type: verifType,
          serverIp: serverIp.trim() || undefined,
          logPath: logPath.trim() || undefined,
          grepRegex: grepRegex.trim() || undefined,
        },
      };

      addCustomTaskNode(selectedShift, newItem);
    }
  }

  return (
    <Modal
      isOpen={nodeBuilderOpen}
      onClose={handleClose}
      size="md"
      title={
        isEdit
          ? `Edit Custom Task Node (${editingNode?.id})`
          : `Add Custom Task Node (${selectedShift} Shift)`
      }
      subtitle={
        isEdit
          ? `Modify configuration, pipeline track, and dependencies for ${editingNode?.process}`
          : "Configure node parameters, execution mode, and DAG dependencies"
      }
      icon={<Activity size={18} style={{ color: "var(--cyan)" }} />}
    >
      <form onSubmit={handleSubmit} className="node-builder-form">
        {/* Row 1: ID, Title, Scheduled Time */}
        <div className="node-builder-row-top">
          <div className="node-builder-field">
            <label className="node-builder-label">Node ID</label>
            <input
              type="text"
              disabled
              value={isEdit && editingNode ? editingNode.id : nodeId}
              className="node-builder-input mono"
            />
          </div>

          <div className="node-builder-field field-process-name">
            <label className="node-builder-label">Process Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. RefData Master Sync, Metanoia..."
              className="node-builder-input"
              value={processName}
              onChange={(e) => setProcessName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="node-builder-field">
            <label className="node-builder-label">Time (IST)</label>
            <input
              type="text"
              className="node-builder-input mono"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        {/* Description */}
        <div className="node-builder-field">
          <label className="node-builder-label">Task Description</label>
          <input
            type="text"
            placeholder="What does this process do and what files/feeds does it consume?"
            className="node-builder-input"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>

        {/* Row 2: Pipeline, Priority, Mode */}
        <div className="node-builder-row-triplet">
          <div className="node-builder-field">
            <label className="node-builder-label">Pipeline Track</label>
            <Select
              size="sm"
              value={pipeline}
              onChange={(val) => setPipeline(val as PipelineId)}
              options={[
                { value: "exchange", label: "Exchange Ingestion" },
                { value: "market_data", label: "Market Feeds & TBT" },
                { value: "execution", label: "Order Gateways" },
                { value: "infra", label: "Infra & Compliance" },
              ]}
            />
          </div>

          <div className="node-builder-field">
            <label className="node-builder-label">Priority</label>
            <Select
              size="sm"
              value={priority}
              onChange={(val) => setPriority(val as any)}
              options={[
                { value: "critical", label: "Critical" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />
          </div>

          <div className="node-builder-field">
            <label className="node-builder-label">Execution Mode</label>
            <Select
              size="sm"
              value={mode}
              onChange={(val) => setMode(val as any)}
              options={[
                { value: "Auto", label: "Auto" },
                { value: "Manual", label: "Manual" },
                { value: "Auto/Manual", label: "Auto/Manual" },
              ]}
            />
          </div>
        </div>

        {/* Row 3: Executor and RBAC Role */}
        <div className="node-builder-row-pair">
          <div className="node-builder-field">
            <label className="node-builder-label">Executor Team</label>
            <input
              type="text"
              className="node-builder-input"
              value={executor}
              onChange={(e) => setExecutor(e.target.value)}
            />
          </div>

          <div className="node-builder-field">
            <label className="node-builder-label">RBAC Sign-off Role</label>
            <Select
              size="sm"
              value={role}
              onChange={(val) => setRole(val)}
              options={[
                { value: "L1 Support", label: "L1 Support" },
                { value: "L2 Support", label: "L2 Support" },
                { value: "Shift Lead", label: "Shift Lead" },
                { value: "Principal", label: "Principal" },
              ]}
            />
          </div>
        </div>

        {/* Prerequisite Dependencies Multi-select */}
        <div className="node-builder-field">
          <label className="node-builder-label">
            Prerequisite Dependencies (Select parent tasks that must finish before this node):
          </label>
          <div className="node-builder-deps-container">
            {rows
              .filter((parent) => !isEdit || parent.id !== editingNode?.id)
              .map((parent) => {
                const isSelected = selectedParents.includes(parent.id);
                return (
                  <button
                    key={parent.id}
                    type="button"
                    className={`seg-tab-btn${isSelected ? " active" : ""}`}
                    onClick={() => toggleParent(parent.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 8px",
                      fontSize: 11,
                    }}
                  >
                    {isSelected ? (
                      <Check size={11} strokeWidth={3} />
                    ) : (
                      <Plus size={11} />
                    )}
                    <span>
                      {parent.id}: {parent.process.slice(0, 22)}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Automated Telemetry & Grep Configuration Box */}
        <div className="node-builder-telemetry-box">
          <div className="node-builder-telemetry-header">
            <Settings size={13} />
            <span>Automated Telemetry & Grep Verification Prototype</span>
          </div>

          <div className="node-builder-telemetry-row">
            <div className="node-builder-field">
              <label className="node-builder-label" style={{ fontSize: 10 }}>Check Type</label>
              <Select
                size="sm"
                value={verifType}
                onChange={(val) => setVerifType(val as any)}
                options={[
                  { value: "log_grep", label: "Remote Log Grep" },
                  { value: "db_query", label: "DB Integrity Query" },
                  { value: "ssh_exec", label: "SSH Command" },
                  { value: "manual", label: "Manual Sign-off" },
                ]}
              />
            </div>

            <div className="node-builder-field">
              <label className="node-builder-label" style={{ fontSize: 10 }}>Server Host / IP</label>
              <input
                type="text"
                placeholder="e.g., 10.240.18.90"
                className="node-builder-input mono"
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
              />
            </div>
          </div>

          <div className="node-builder-field">
            <label className="node-builder-label" style={{ fontSize: 10 }}>Log File Path on Remote Host</label>
            <input
              type="text"
              placeholder="/var/log/... or /netapp/..."
              className="node-builder-input mono"
              value={logPath}
              onChange={(e) => setLogPath(e.target.value)}
            />
          </div>

          <div className="node-builder-field">
            <label className="node-builder-label" style={{ fontSize: 10 }}>Regex Match Pattern (String required for task to be set to OK)</label>
            <input
              type="text"
              placeholder="e.g. \[READY\] Trade feed connected"
              className="node-builder-input mono"
              value={grepRegex}
              onChange={(e) => setGrepRegex(e.target.value)}
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="node-builder-actions">
          {isEdit ? (
            <button
              type="button"
              className="node-builder-delete-btn"
              onClick={handleDelete}
            >
              <Trash2 size={13} />
              <span>Delete Node</span>
            </button>
          ) : (
            <div />
          )}

          <div className="node-builder-actions-right">
            <button
              type="button"
              className="dag-btn"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="manual-ok-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {isEdit ? (
                <>
                  <Save size={13} strokeWidth={2.5} />
                  <span>Save Changes</span>
                </>
              ) : (
                <>
                  <Plus size={13} strokeWidth={3} />
                  <span>Insert Node into DAG</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
