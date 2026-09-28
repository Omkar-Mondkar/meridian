import React, { useRef, useEffect } from "react";
import { useTaskStore } from "../../stores/useTaskStore";
import { useTimeStore } from "../../stores/useTimeStore";
import {
  currentShiftName,
  SHIFT_KEYS,
  SHIFT_WINDOWS,
} from "../../data/roster";
import { canAct } from "../../data/personas";
import { StatusPill } from "../../components/ui/StatusPill";
import { PersonaDropdown } from "./PersonaDropdown";
import { TaskDagCanvas } from "./TaskDagCanvas";
import { ExchangeFileInspector } from "./ExchangeFileInspector";
import { NodeBuilderModal } from "./NodeBuilderModal";
import "./TasksDag.css";

function ChecklistRow({
  row,
  shiftKey,
}: {
  row: ReturnType<typeof useTaskStore.getState>["checklists"][string][0];
  shiftKey: string;
}) {
  const { currentPersona, advanceStatus, getNodeDerivedStatus, setInspectorOpen, setSelectedTaskId } = useTaskStore();
  const pillRef = useRef<HTMLButtonElement>(null);
  const derivedStatus = getNodeDerivedStatus(shiftKey, row.id);
  const isBlocked = derivedStatus === "blocked";

  const allowed = canAct(
    currentPersona.rbacRole || currentPersona.role,
    row.role,
    row.status,
  );

  function handleClick() {
    if (isBlocked) {
      pillRef.current?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 220 },
      );
      return;
    }

    if (!allowed) {
      pillRef.current?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 220 },
      );
      return;
    }

    advanceStatus(shiftKey, row.id, currentPersona.name, currentPersona.role);
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `.status-pill[data-id="${row.id}"]`,
      );
      if (el) {
        el.classList.add("flash");
        setTimeout(() => el.classList.remove("flash"), 600);
      }
    }, 50);
  }

  const manifest = row.fileManifest;

  return (
    <div className={`checklist-row panel${isBlocked ? " row-blocked" : ""}`}>
      <div className="cl-process">
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span className={`prio ${row.priority}`}>
            {row.priority.toUpperCase()}
          </span>
          <span className="mono" style={{ fontSize: 11, color: "var(--text-lo)" }}>
            {row.id}
          </span>
          {row.dependsOn && row.dependsOn.length > 0 && (
            <span
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 4,
                background: isBlocked ? "rgba(255, 176, 32, 0.15)" : "rgba(79, 217, 208, 0.1)",
                color: isBlocked ? "var(--amber)" : "var(--cyan)",
                border: `1px solid ${isBlocked ? "rgba(255, 176, 32, 0.3)" : "rgba(79, 217, 208, 0.2)"}`,
              }}
            >
              Prerequisites: {row.dependsOn.join(", ")}
            </span>
          )}
        </div>

        <div style={{ fontWeight: 600 }}>{row.process}</div>
        {row.desc && <div className="cl-desc">{row.desc}</div>}

        {manifest && (
          <button
            type="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 6,
              fontSize: 11,
              color: "var(--cyan)",
              background: "rgba(79, 217, 208, 0.08)",
              border: "1px solid rgba(79, 217, 208, 0.25)",
              borderRadius: 4,
              padding: "3px 8px",
            }}
            onClick={() => {
              setSelectedTaskId(row.id);
              setInspectorOpen(true);
            }}
          >
            <span>📁</span>
            <span>
              NetApp Manifest: {manifest.downloadedCount}/{manifest.totalExpected} files ready
            </span>
          </button>
        )}

        {isBlocked && (
          <div style={{ fontSize: 10, color: "var(--amber)", marginTop: 4 }}>
            ⚠️ Waiting on upstream completion: {row.dependsOn?.join(", ")}
          </div>
        )}

        {row.status === "completed" && (
          <div className="completed-note">
            Completed by {row.completedBy} at {row.completedAt}
          </div>
        )}
      </div>

      <div className="cl-time mono">{row.time}</div>
      <div className="cl-mode">{row.mode}</div>
      <div className="cl-exec">
        {row.executor}
        <span className="role-badge">{row.role}</span>
      </div>

      <StatusPill
        ref={pillRef}
        status={isBlocked ? "open" : row.status}
        disabled={!allowed || isBlocked}
        title={
          isBlocked
            ? `Blocked by prerequisite (${row.dependsOn?.join(", ")})`
            : allowed
            ? "Click to advance status"
            : `Requires ${row.role} (Current: ${currentPersona.name} [${currentPersona.rbacRole}])`
        }
        data-id={row.id}
        onClick={handleClick}
      />
    </div>
  );
}

export function TasksTab() {
  const {
    checklists,
    selectedShift,
    shiftAutoFollow,
    currentPersona,
    viewMode,
    setSelectedShift,
    setAutoFollow,
    setPersona,
    setViewMode,
    autoFollowTo,
  } = useTaskStore();
  const { nowMin } = useTimeStore();

  // Auto-follow current shift
  const liveShift = currentShiftName(nowMin);
  useEffect(() => {
    autoFollowTo(liveShift);
  }, [liveShift, autoFollowTo]);

  const rows = checklists[selectedShift] ?? [];

  return (
    <section
      className="view"
      id="view-tasks"
      role="tabpanel"
      aria-labelledby="tab-tasks"
    >
      {/* Toolbar with Custom Persona Dropdown */}
      <div className="tasks-toolbar">
        <PersonaDropdown
          selectedShift={selectedShift}
          currentPersona={currentPersona}
          onSelectPersona={setPersona}
        />
        <div className="tasks-toolbar-hint">
          <span className="hint-icon">ⓘ</span>
          Dynamic dependency flowchart tracks upstream bottlenecks. Click any task or "Set to OK" to unblock dependent pipelines.
        </div>
      </div>

      {/* Shift tab bar & View Mode Switcher */}
      <div className="shift-tabbar" id="shiftTabbar">
        {SHIFT_KEYS.map((k) => (
          <button
            key={k}
            className={`shift-tab${selectedShift === k ? " active" : ""}${k === liveShift ? " is-current" : ""}`}
            data-shift={k}
            onClick={() => setSelectedShift(k, true)}
          >
            {k} <span className="shift-tab-window mono">{SHIFT_WINDOWS[k]}</span>
          </button>
        ))}
        <button
          className={`auto-pill${shiftAutoFollow ? " active" : ""}`}
          id="shiftAutoBtn"
          title="Follow the live shift automatically"
          onClick={() => setAutoFollow(true)}
        >
          ⟳ AUTO
        </button>

        {/* View Mode Toggle */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            className={`dag-btn${viewMode === "graph" ? " active" : ""}`}
            onClick={() => setViewMode("graph")}
            title="Interactive Dependency Flowchart"
          >
            <span>☊</span>
            <span>Flowchart DAG</span>
          </button>

          <button
            className={`dag-btn${viewMode === "table" ? " active" : ""}`}
            onClick={() => setViewMode("table")}
            title="Classical Checklist Table"
          >
            <span>☰</span>
            <span>Checklist Table</span>
          </button>
        </div>
      </div>

      {/* Main View Area: Flowchart DAG vs Checklist Table */}
      {viewMode === "graph" ? (
        <TaskDagCanvas />
      ) : (
        <div className="task-list" id="taskList">
          <div className="checklist-table">
            <div className="checklist-head">
              <div>Process</div>
              <div>Time</div>
              <div>Mode</div>
              <div>Maker / Executor</div>
              <div>Status</div>
            </div>
            {rows.map((row) => (
              <ChecklistRow key={row.id} row={row} shiftKey={selectedShift} />
            ))}
          </div>
        </div>
      )}

      {/* Modal Dialogs */}
      <ExchangeFileInspector />
      <NodeBuilderModal />
    </section>
  );
}
