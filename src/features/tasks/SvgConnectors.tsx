import React, { useEffect, useState, useCallback, useMemo } from "react";
import type { ChecklistItem, NodeStatus } from "../../data/roster";
import { getNodeCoordinates } from "./dagLayout";

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

      const targetPos = getNodeCoordinates(targetNode, nodes, shiftKey);
      const targetEl = container.querySelector<HTMLElement>(
        `[data-node-id="${targetNode.id}"]`
      );

      targetNode.dependsOn.forEach((sourceId) => {
        const sourceNode = nodes.find((n) => n.id === sourceId);
        if (!sourceNode) return;

        const sourcePos = getNodeCoordinates(sourceNode, nodes, shiftKey);
        const sourceEl = container.querySelector<HTMLElement>(
          `[data-node-id="${sourceId}"]`
        );

        // Calculate connection points using exact layout coordinates + element dimensions
        const sourceWidth = sourceEl ? sourceEl.offsetWidth : 250;
        const sourceHeight = sourceEl ? sourceEl.offsetHeight : 84;
        const targetWidth = targetEl ? targetEl.offsetWidth : 250;

        const x1 = sourcePos.x + sourceWidth / 2;
        const y1 = sourcePos.y + sourceHeight;
        const x2 = targetPos.x + targetWidth / 2;
        const y2 = targetPos.y;

        // If line is purely vertical (x1 === x2), add a gentle 14px lateral curve
        // to prevent 0-width SVG bounding box clipping in Chrome/Blink
        const dx = x2 - x1;
        const dy = Math.max(Math.abs(y2 - y1) * 0.45, 28);

        let pathD = "";
        if (Math.abs(dx) < 4) {
          // Subtle elegant curve for vertical lines so they have width > 0
          const arcOffset = 14;
          pathD = `M ${x1} ${y1} C ${x1 + arcOffset} ${y1 + dy}, ${x2 + arcOffset} ${y2 - dy}, ${x2} ${y2}`;
        } else {
          pathD = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
        }

        const isSourceCompleted = sourceNode.status === "completed";
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

  // Recalculate on mount, shift change, node count change, and resize
  useEffect(() => {
    calculateEdges();
    const timer1 = setTimeout(calculateEdges, 60);
    const timer2 = setTimeout(calculateEdges, 250);

    const resizeObserver = new ResizeObserver(() => {
      calculateEdges();
    });

    if (canvasInnerRef.current) {
      resizeObserver.observe(canvasInnerRef.current);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
    };
  }, [calculateEdges, nodes, shiftKey]);

  // Separate edges into background edges and focused hovered edges
  const { backgroundEdges, focusedEdges } = useMemo(() => {
    if (!hoveredNodeId) {
      return { backgroundEdges: edges, focusedEdges: [] };
    }

    const bg: EdgePathData[] = [];
    const focused: EdgePathData[] = [];

    edges.forEach((edge) => {
      if (edge.sourceId === hoveredNodeId || edge.targetId === hoveredNodeId) {
        focused.push(edge);
      } else {
        bg.push(edge);
      }
    });

    return { backgroundEdges: bg, focusedEdges: focused };
  }, [edges, hoveredNodeId]);

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
        zIndex: hoveredNodeId ? 14 : 2,
      }}
    >
      <defs>
        {/* Directed Arrow Markers for Top-to-Bottom Flow */}
        <marker
          id="arrow-cyan"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#4FD9D0" />
        </marker>
        <marker
          id="arrow-green"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#33D17A" />
        </marker>
        <marker
          id="arrow-red"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#FF4D5E" />
        </marker>
        <marker
          id="arrow-amber"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#FFB020" />
        </marker>
      </defs>

      {/* Background / Unfocused Edges */}
      {backgroundEdges.map((edge) => {
        const isDimmed = hoveredNodeId !== null;
        let strokeColor = "#FFB020";
        let strokeWidth = 2.2;
        let opacity = 0.75;
        let markerEnd = "url(#arrow-amber)";

        if (isDimmed) {
          strokeColor = "rgba(255, 255, 255, 0.08)";
          opacity = 0.05;
          strokeWidth = 1.2;
          markerEnd = "";
        } else {
          if (edge.flowState === "completed") {
            strokeColor = "#33D17A";
            markerEnd = "url(#arrow-green)";
          } else if (edge.flowState === "active") {
            strokeColor = "#4FD9D0";
            markerEnd = "url(#arrow-cyan)";
          }
        }

        return (
          <path
            key={edge.id}
            d={edge.pathD}
            className={`dag-edge-path flow-${edge.flowState}`}
            style={{
              stroke: strokeColor,
              strokeWidth,
              fill: "none",
              opacity,
              transition: "opacity 0.2s ease, stroke 0.2s ease",
            }}
            markerEnd={markerEnd || undefined}
          />
        );
      })}

      {/* Focused / Hovered Edges — Rendered on top with drop-shadow glow and animated flow */}
      {focusedEdges.map((edge) => {
        const isGreen = edge.isSourceCompleted;
        const strokeColor = isGreen ? "#33D17A" : "#FF4D5E";
        const markerEnd = isGreen ? "url(#arrow-green)" : "url(#arrow-red)";
        const filterStyle = isGreen
          ? "drop-shadow(0 0 6px rgba(51, 209, 122, 0.85))"
          : "drop-shadow(0 0 6px rgba(255, 77, 94, 0.85))";

        return (
          <path
            key={edge.id}
            d={edge.pathD}
            className="dag-edge-path hover-focused"
            style={{
              stroke: strokeColor,
              strokeWidth: 3.5,
              fill: "none",
              opacity: 1,
              strokeDasharray: isGreen ? "none" : "8 5",
              filter: filterStyle,
              transition: "all 0.18s ease",
            }}
            markerEnd={markerEnd}
          />
        );
      })}
    </svg>
  );
}
