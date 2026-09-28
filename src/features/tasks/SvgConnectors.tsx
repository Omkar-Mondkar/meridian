import React, { useEffect, useState, useCallback } from "react";
import type { ChecklistItem, NodeStatus } from "../../data/roster";

interface SvgConnectorsProps {
  nodes: ChecklistItem[];
  canvasInnerRef: React.RefObject<HTMLDivElement>;
  shiftKey: string;
  hoveredNodeId: string | null;
  getNodeDerivedStatus: (shiftKey: string, taskId: string) => NodeStatus;
}

interface EdgePathData {
  id: string;
  pathD: string;
  flowState: "active" | "blocked" | "completed";
  isSourceCompleted: boolean;
  sourceId: string;
  targetId: string;
}

export function SvgConnectors({
  nodes,
  canvasInnerRef,
  shiftKey,
  hoveredNodeId,
  getNodeDerivedStatus,
}: SvgConnectorsProps) {
  const [edges, setEdges] = useState<EdgePathData[]>([]);

  const calculateEdges = useCallback(() => {
    if (!canvasInnerRef.current) return;
    const container = canvasInnerRef.current;
    const newEdges: EdgePathData[] = [];

    nodes.forEach((targetNode) => {
      if (!targetNode.dependsOn || targetNode.dependsOn.length === 0) return;

      const targetEl = container.querySelector<HTMLElement>(
        `[data-node-id="${targetNode.id}"]`
      );
      if (!targetEl) return;

      targetNode.dependsOn.forEach((sourceId) => {
        const sourceEl = container.querySelector<HTMLElement>(
          `[data-node-id="${sourceId}"]`
        );
        if (!sourceEl) return;

        const sourceNode = nodes.find((n) => n.id === sourceId);

        // Absolute coordinate calculation relative to canvasInner container
        const x1 = sourceEl.offsetLeft + sourceEl.offsetWidth / 2;
        const y1 = sourceEl.offsetTop + sourceEl.offsetHeight;
        const x2 = targetEl.offsetLeft + targetEl.offsetWidth / 2;
        const y2 = targetEl.offsetTop;

        // Smooth cubic Bézier curve
        const dy = Math.max(Math.abs(y2 - y1) * 0.45, 30);
        const pathD = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;

        const isSourceCompleted = sourceNode?.status === "completed";
        const isTargetCompleted = targetNode.status === "completed";

        let flowState: "active" | "blocked" | "completed" = "blocked";
        if (isSourceCompleted) {
          flowState = isTargetCompleted ? "completed" : "active";
        }

        newEdges.push({
          id: `${sourceId}->${targetNode.id}`,
          pathD,
          flowState,
          isSourceCompleted,
          sourceId,
          targetId: targetNode.id,
        });
      });
    });

    setEdges(newEdges);
  }, [nodes, canvasInnerRef, shiftKey, getNodeDerivedStatus]);

  useEffect(() => {
    calculateEdges();
    const timer = setTimeout(calculateEdges, 100);
    return () => clearTimeout(timer);
  }, [calculateEdges, nodes]);

  return (
    <svg
      className="dag-svg-overlay"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <defs>
        {/* Glow Filters */}
        <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Directed Arrow Markers for Top-to-Bottom Flow */}
        <marker
          id="arrow-cyan"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#4FD9D0" />
        </marker>
        <marker
          id="arrow-green"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#33D17A" />
        </marker>
        <marker
          id="arrow-red"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#FF4D5E" />
        </marker>
        <marker
          id="arrow-amber"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#FFB020" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const isHoverMode = hoveredNodeId !== null;
        const isConnectedToHovered =
          isHoverMode &&
          (edge.sourceId === hoveredNodeId || edge.targetId === hoveredNodeId);

        let strokeColor = "";
        let strokeWidth = 2.2;
        let opacity = 0.8;
        let filterUrl: string | undefined = undefined;
        let markerEnd = "url(#arrow-cyan)";
        let strokeDasharray = "";

        if (isHoverMode) {
          if (isConnectedToHovered) {
            // Hovered connection: green if source completed, red if not completed
            if (edge.isSourceCompleted) {
              strokeColor = "var(--green)";
              filterUrl = "url(#glow-green)";
              markerEnd = "url(#arrow-green)";
            } else {
              strokeColor = "var(--red)";
              filterUrl = "url(#glow-red)";
              markerEnd = "url(#arrow-red)";
            }
            strokeWidth = 3.6;
            opacity = 1;
            strokeDasharray = edge.isSourceCompleted ? "" : "6 4";
          } else {
            // Unrelated connections are dimmed out
            strokeColor = "rgba(255, 255, 255, 0.08)";
            opacity = 0.06;
            strokeWidth = 1.2;
            markerEnd = "";
          }
        } else {
          // Standard view
          if (edge.flowState === "completed") {
            strokeColor = "var(--green)";
            filterUrl = "url(#glow-green)";
            markerEnd = "url(#arrow-green)";
          } else if (edge.flowState === "active") {
            strokeColor = "var(--cyan)";
            filterUrl = "url(#glow-cyan)";
            markerEnd = "url(#arrow-cyan)";
          } else {
            strokeColor = "var(--amber)";
            opacity = 0.65;
            markerEnd = "url(#arrow-amber)";
          }
        }

        return (
          <path
            key={edge.id}
            d={edge.pathD}
            className={`dag-edge-path flow-${edge.flowState}${
              isConnectedToHovered ? " hover-focused" : ""
            }`}
            style={{
              stroke: strokeColor,
              strokeWidth,
              opacity,
              strokeDasharray: strokeDasharray || undefined,
            }}
            filter={filterUrl}
            markerEnd={markerEnd || undefined}
          />
        );
      })}
    </svg>
  );
}
