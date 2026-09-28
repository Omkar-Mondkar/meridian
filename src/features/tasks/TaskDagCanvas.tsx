import React, { useRef, useState, useMemo } from "react";
import { useTaskStore } from "../../stores/useTaskStore";
import { TaskNodeCard } from "./TaskNodeCard";
import { SvgConnectors } from "./SvgConnectors";
import { getNodeCoordinates, TRACK_HEADERS } from "./dagLayout";
import "./TasksDag.css";

export function TaskDagCanvas() {
  const {
    checklists,
    selectedShift,
    selectedTaskId,
    setSelectedTaskId,
    setInspectorOpen,
    setNodeBuilderOpen,
    getNodeDerivedStatus,
  } = useTaskStore();

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasInnerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state (Excalidraw-like canvas)
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const rows = checklists[selectedShift] || [];

  // Compute related nodes (Hovered node + all its direct parents + all its direct children)
  const relatedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const set = new Set<string>([hoveredNodeId]);

    // Direct parents
    const current = rows.find((r) => r.id === hoveredNodeId);
    if (current && current.dependsOn) {
      current.dependsOn.forEach((parentId) => set.add(parentId));
    }

    // Direct children
    rows.forEach((r) => {
      if (r.dependsOn && r.dependsOn.includes(hoveredNodeId)) {
        set.add(r.id);
      }
    });

    return set;
  }, [hoveredNodeId, rows]);

  // Pan / Drag Handlers
  function handleMouseDown(e: React.MouseEvent) {
    // Only drag on canvas background, not inside cards or buttons
    if (
      (e.target as HTMLElement).closest(".task-node-card") ||
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("input")
    ) {
      return;
    }
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleWheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.4), 1.8));
    } else {
      // Natural 2D pan with trackpad/wheel
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }

  // Summary Metrics
  const total = rows.length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const blocked = rows.filter(
    (r) => getNodeDerivedStatus(selectedShift, r.id) === "blocked"
  ).length;

  return (
    <div className="tasks-dag-container">
      {/* Top Metrics & Action Bar */}
      <div className="dag-metrics-bar">
        <div className="dag-legend">
          <div className="legend-item">
            <span className="legend-dot completed" />
            <span>Completed ({completed})</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot ready" />
            <span>Ready ({total - completed - blocked})</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot blocked" />
            <span>Blocked ({blocked})</span>
          </div>
          {hoveredNodeId && (
            <div
              style={{
                marginLeft: 12,
                fontSize: 11,
                color: "var(--cyan)",
                background: "rgba(79, 217, 208, 0.12)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(79, 217, 208, 0.3)",
              }}
            >
              Focusing connections for: <strong>{hoveredNodeId}</strong>
            </div>
          )}
        </div>

        <div className="dag-controls">
          {/* Zoom & Canvas controls */}
          <div className="canvas-pan-controls">
            <button
              className="canvas-tool-btn"
              onClick={() => setZoom((z) => Math.min(z + 0.15, 1.8))}
              title="Zoom In"
            >
              +
            </button>
            <span className="zoom-level mono">{Math.round(zoom * 100)}%</span>
            <button
              className="canvas-tool-btn"
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
              title="Zoom Out"
            >
              −
            </button>
            <button
              className="canvas-tool-btn"
              onClick={() => {
                setPan({ x: 20, y: 20 });
                setZoom(1);
              }}
              title="Reset View"
            >
              ⟲ Reset
            </button>
          </div>

          <button
            className="dag-btn primary"
            onClick={() => setInspectorOpen(true)}
            title="Inspect ~200 NetApp Exchange Files"
          >
            <span>📁</span>
            <span>NetApp Exchange Files</span>
          </button>

          <button
            className="dag-btn"
            onClick={() => setNodeBuilderOpen(true)}
            title="Create prototype DAG task node"
          >
            <span>+</span>
            <span>Add Custom Node</span>
          </button>
        </div>
      </div>

      {/* Infinite Draggable Viewport (Excalidraw Canvas) */}
      <div
        className={`dag-infinite-viewport${isDragging ? " is-dragging" : ""}`}
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* Floating Pan Hint */}
        <div className="canvas-pan-hint">
          <span>🖐️ Click & drag anywhere to move canvas · Ctrl + Scroll to zoom</span>
        </div>

        {/* Transformed Canvas Plane */}
        <div
          className="dag-canvas-plane"
          ref={canvasInnerRef}
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Pipeline Track Headers at the top */}
          <div className="track-headers-layer">
            {TRACK_HEADERS.map((header) => (
              <div
                key={header.title}
                className="pipeline-track-header"
                style={{ left: header.x }}
              >
                <span className="track-header-icon">{header.icon}</span>
                <span className="track-header-title">{header.title}</span>
              </div>
            ))}
          </div>

          {/* SVG Connector Edges */}
          <SvgConnectors
            nodes={rows}
            canvasInnerRef={canvasInnerRef}
            shiftKey={selectedShift}
            hoveredNodeId={hoveredNodeId}
            getNodeDerivedStatus={getNodeDerivedStatus}
          />

          {/* Direct Absolutely Positioned Node Cards */}
          {rows.map((node) => {
            const pos = getNodeCoordinates(node, rows, selectedShift);
            const isHovered = hoveredNodeId === node.id;
            const isRelated = relatedNodeIds.has(node.id);
            const isDimmed = hoveredNodeId !== null && !isRelated;

            return (
              <TaskNodeCard
                key={node.id}
                node={node}
                shiftKey={selectedShift}
                derivedStatus={getNodeDerivedStatus(selectedShift, node.id)}
                isSelected={selectedTaskId === node.id}
                isHovered={isHovered}
                isRelated={isRelated}
                isDimmed={isDimmed}
                onHover={setHoveredNodeId}
                onSelectNode={setSelectedTaskId}
                onOpenInspector={() => {
                  setSelectedTaskId(node.id);
                  setInspectorOpen(true);
                }}
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  width: 250,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
