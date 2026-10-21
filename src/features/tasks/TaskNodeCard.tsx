import React from "react";
import type { ChecklistItem, NodeStatus } from "../../data/roster";

interface TaskNodeCardProps {
  node: ChecklistItem;
  shiftKey: string;
  derivedStatus: NodeStatus;
  isSelected: boolean;
  isHovered: boolean;
  isRelated: boolean;
  isDimmed: boolean;
  editMode?: boolean;
  isConnecting?: boolean;
  isConnectingSource?: boolean;
  onHover: (id: string | null) => void;
  onSelectNode: (id: string) => void;
  onOpenInspector: (id: string) => void;
  onStartConnect?: (id: string, clientX: number, clientY: number) => void;
  onPortMouseUp?: (id: string) => void;
  style?: React.CSSProperties;
}

export function TaskNodeCard({
  node,
  derivedStatus,
  isSelected,
  isHovered,
  isRelated,
  isDimmed,
  editMode,
  isConnecting,
  isConnectingSource,
  onHover,
  onSelectNode,
  onOpenInspector,
  onStartConnect,
  onPortMouseUp,
  style,
}: TaskNodeCardProps) {
  const isBlocked = derivedStatus === "blocked";
  const isCompleted = node.status === "completed";
  const isDropTarget = isConnecting && !isConnectingSource;

  // Calculate manifest progress if available
  const manifest = node.fileManifest;
  const manifestPct = manifest
    ? Math.round((manifest.downloadedCount / (manifest.totalExpected || 1)) * 100)
    : 0;

  return (
    <div
      id={`node-${node.id}`}
      data-node-id={node.id}
      className={`task-node-card status-${derivedStatus}${isSelected ? " selected" : ""}${
        isDimmed ? " dimmed" : ""
      }${isHovered ? " hovered" : ""}${isRelated ? " related" : ""}${
        editMode ? " in-edit-mode" : ""
      }${isConnectingSource ? " connecting-source" : ""}${isDropTarget ? " drop-target-candidate" : ""}`}
      style={style}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onMouseUp={() => {
        if (isConnecting && !isConnectingSource && onPortMouseUp) {
          onPortMouseUp(node.id);
        }
      }}
      onClick={() => {
        if (isConnecting && !isConnectingSource && onPortMouseUp) {
          onPortMouseUp(node.id);
          return;
        }
        onSelectNode(node.id);
        onOpenInspector(node.id);
      }}
      title={
        isBlocked
          ? `Blocked by prerequisite: ${(node.dependsOn || []).join(", ")}. Click to inspect or override.`
          : node.id === "M1"
          ? "Click to open NetApp Exchange Files Inspector"
          : `Click to inspect ${node.process} & run diagnostics`
      }
    >
      {/* Top Input Port: Drop upstream connections here */}
      {(editMode || isConnecting) && (
        <div
          className={`dag-port port-top${isDropTarget ? " target-ready" : ""}`}
          data-port="target"
          data-node-id={node.id}
          onMouseUp={(e) => {
            e.stopPropagation();
            onPortMouseUp?.(node.id);
          }}
          title={`Connect dependency into ${node.id}`}
        >
          <div className="dag-port-inner" />
        </div>
      )}

      {/* Bottom Output Port: Drag to downstream tasks */}
      {editMode && (
        <div
          className={`dag-port port-bottom${isConnectingSource ? " source-active" : ""}`}
          data-port="source"
          data-node-id={node.id}
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartConnect?.(node.id, e.clientX, e.clientY);
          }}
          title={`Drag to connect ${node.id} to another task`}
        >
          <div className="dag-port-inner" />
        </div>
      )}
      <div className="node-header">
        <div className="node-badge-group">
          <span className="node-id mono">{node.id}</span>
          <span className={`node-priority ${node.priority}`}>{node.priority}</span>
          <span
            className="node-status-indicator"
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: 3,
              textTransform: "uppercase",
              background: isCompleted
                ? "rgba(51, 209, 122, 0.15)"
                : isBlocked
                ? "rgba(255, 176, 32, 0.15)"
                : "rgba(79, 217, 208, 0.15)",
              color: isCompleted
                ? "var(--green)"
                : isBlocked
                ? "var(--amber)"
                : "var(--cyan)",
              border: `1px solid ${
                isCompleted
                  ? "rgba(51, 209, 122, 0.3)"
                  : isBlocked
                  ? "rgba(255, 176, 32, 0.3)"
                  : "rgba(79, 217, 208, 0.3)"
              }`,
            }}
          >
            {isCompleted ? "✓ Completed" : isBlocked ? "⏳ Blocked" : "Ready"}
          </span>
        </div>
        <div className="node-time mono">{node.time}</div>
      </div>

      <div className="node-title">{node.process}</div>

      {/* Manifest Banner for Exchange File Download (M1) */}
      {manifest && (
        <div
          className="node-manifest-banner"
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(node.id);
            onOpenInspector(node.id);
          }}
          title="Click to inspect all NetApp exchange files"
        >
          <div className="manifest-stats">
            <span style={{ color: "var(--cyan)", fontWeight: 600 }}>
              📁 NetApp Files: {manifest.downloadedCount}/{manifest.totalExpected}
            </span>
            <span className="mono" style={{ color: "var(--text-lo)" }}>
              {manifestPct}%
            </span>
          </div>
          <div className="manifest-progress-bg">
            <div
              className="manifest-progress-fill"
              style={{ width: `${manifestPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Upstream Blocked Warning Indicator */}
      {isBlocked && (
        <div className="node-blocked-chip">
          <span>⚠️</span>
          <span>
            Waiting: <strong>{(node.dependsOn || []).join(", ")}</strong>
          </span>
        </div>
      )}

      {/* Completed Stamp */}
      {isCompleted ? (
        <div
          style={{
            fontSize: 10,
            color: "var(--green)",
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>✓</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.completedBy || "Completed"} {node.completedAt ? `at ${node.completedAt}` : ""}
          </span>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 6,
            paddingTop: 4,
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <span style={{ fontSize: 10, color: "var(--text-lo)" }}>
            {node.executor || "Manual"}
          </span>
          <button
            className="node-card-quick-ok"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode(node.id);
              onOpenInspector(node.id);
            }}
            title="Inspect task details and set to OK"
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 4,
              color: "var(--cyan)",
              background: "rgba(79, 217, 208, 0.12)",
              border: "1px solid rgba(79, 217, 208, 0.28)",
              cursor: "pointer",
            }}
          >
            Inspect / Set to OK →
          </button>
        </div>
      )}
    </div>
  );
}
