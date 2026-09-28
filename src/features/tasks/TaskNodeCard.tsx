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
  onHover: (id: string | null) => void;
  onSelectNode: (id: string) => void;
  onOpenInspector: (id: string) => void;
  style?: React.CSSProperties;
}

export function TaskNodeCard({
  node,
  derivedStatus,
  isSelected,
  isHovered,
  isRelated,
  isDimmed,
  onHover,
  onSelectNode,
  onOpenInspector,
  style,
}: TaskNodeCardProps) {
  const isBlocked = derivedStatus === "blocked";
  const isCompleted = node.status === "completed";

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
      }${isHovered ? " hovered" : ""}${isRelated ? " related" : ""}`}
      style={style}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => {
        onSelectNode(node.id);
        if (node.id === "M1" || node.fileManifest) {
          onOpenInspector(node.id);
        }
      }}
      title={
        isBlocked
          ? `Blocked by prerequisite: ${(node.dependsOn || []).join(", ")}`
          : node.id === "M1"
          ? "Click to open NetApp Exchange Files Inspector"
          : `${node.process} (${node.time})`
      }
    >
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
      {isCompleted && (
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
          <span>
            {node.completedBy || "Completed"} {node.completedAt ? `at ${node.completedAt}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
