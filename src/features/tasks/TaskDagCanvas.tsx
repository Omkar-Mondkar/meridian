import React, { useRef, useState, useMemo, useEffect } from "react";
import { useTaskStore } from "../../stores/useTaskStore";
import { usePermissions } from "../../hooks/usePermissions";
import { TaskNodeCard } from "./TaskNodeCard";
import { SvgConnectors } from "./SvgConnectors";
import { getNodeCoordinates, TRACK_HEADERS } from "./dagLayout";
import "./TasksDag.css";

export function TaskDagCanvas() {
  const { canEditDag } = usePermissions();
  const {
    checklists,
    selectedShift,
    selectedTaskId,
    setSelectedTaskId,
    setInspectorOpen,
    setNodeBuilderOpen,
    getNodeDerivedStatus,
    editMode,
    setEditMode,
    addEdge,
    removeEdge,
  } = useTaskStore();

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasInnerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state (Excalidraw-like canvas)
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Interactive Drag-and-Drop Edge Creation State
  const [connectingFrom, setConnectingFrom] = useState<{
    sourceId: string;
    startPos: { x: number; y: number };
  } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Automatically reset edit mode if operator permissions are downgraded
  useEffect(() => {
    if (!canEditDag && editMode) {
      setEditMode(false);
      setConnectingFrom(null);
      setMousePos(null);
    }
  }, [canEditDag, editMode, setEditMode]);

  const rows = checklists[selectedShift] || [];

  // Helper to convert screen coordinates to canvas plane coordinates
  const clientToCanvas = (clientX: number, clientY: number): { x: number; y: number } => {
    if (!canvasInnerRef.current) return { x: 0, y: 0 };
    const rect = canvasInnerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  };

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

  // Start connecting from output port of source node
  function handleStartConnect(sourceId: string, clientX: number, clientY: number) {
    const sourceNode = rows.find((r) => r.id === sourceId);
    if (!sourceNode) return;
    const pos = getNodeCoordinates(sourceNode, rows, selectedShift);
    const startPos = {
      x: pos.x + 125, // center of 250px card
      y: pos.y + 84,  // bottom of card
    };
    setConnectingFrom({ sourceId, startPos });
    setMousePos(clientToCanvas(clientX, clientY));
    setConnectError(null);
  }

  // Complete connection on drop onto target port or node
  function handlePortMouseUp(targetId: string) {
    if (connectingFrom && connectingFrom.sourceId !== targetId) {
      const res = addEdge(selectedShift, connectingFrom.sourceId, targetId);
      if (!res.success && res.error) {
        setConnectError(res.error);
        setTimeout(() => setConnectError(null), 4000);
      }
    }
    setConnectingFrom(null);
    setMousePos(null);
  }

  // Pan / Drag Handlers
  function handleMouseDown(e: React.MouseEvent) {
    // Only drag on canvas background, not inside cards, ports, or buttons
    if (
      (e.target as HTMLElement).closest(".task-node-card") ||
      (e.target as HTMLElement).closest(".dag-port") ||
      (e.target as HTMLElement).closest(".dag-edge-disconnect-btn") ||
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
    if (connectingFrom) {
      setMousePos(clientToCanvas(e.clientX, e.clientY));
      return;
    }
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  }

  function handleMouseUp(e?: React.MouseEvent) {
    if (connectingFrom) {
      // Check if dropped onto a node card
      if (e) {
        const targetCard = (e.target as HTMLElement).closest<HTMLElement>("[data-node-id]");
        if (targetCard) {
          const targetId = targetCard.getAttribute("data-node-id");
          if (targetId && targetId !== connectingFrom.sourceId) {
            handlePortMouseUp(targetId);
            return;
          }
        }
      }
      setConnectingFrom(null);
      setMousePos(null);
      return;
    }
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
            className={`dag-btn${editMode ? " primary active-edit-btn" : ""}`}
            disabled={!canEditDag}
            onClick={() => {
              if (!canEditDag) return;
              setEditMode(!editMode);
              setConnectingFrom(null);
              setMousePos(null);
            }}
            title={
              canEditDag
                ? "Toggle Drag & Drop DAG Editing Mode"
                : "Editing DAG topology requires Supervisor or System Admin permissions (dag:edit_topology)"
            }
            style={{
              opacity: canEditDag ? 1 : 0.45,
              cursor: canEditDag ? "pointer" : "not-allowed",
            }}
          >
            <span>{editMode ? "✓ Done Editing" : "✏️ Edit DAG"}</span>
          </button>

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
            disabled={!canEditDag}
            onClick={() => {
              if (!canEditDag) return;
              setNodeBuilderOpen(true);
            }}
            title={
              canEditDag
                ? "Create prototype DAG task node"
                : "Adding custom nodes requires Supervisor or System Admin permissions (dag:edit_topology)"
            }
            style={{
              opacity: canEditDag ? 1 : 0.45,
              cursor: canEditDag ? "pointer" : "not-allowed",
            }}
          >
            <span>+</span>
            <span>Add Custom Node</span>
          </button>
        </div>
      </div>

      {/* Edit Mode Helper & Error Notification Banner */}
      {editMode && (
        <div className="dag-edit-mode-banner">
          <span className="banner-icon">🔧</span>
          <span className="banner-text">
            <strong>DAG Builder Active:</strong> Drag from bottom port (○) of any node and drop onto top port (○) of another to link dependency. Click (✕) on any edge to disconnect.
          </span>
          {connectError && (
            <span className="banner-error">
              ⚠️ {connectError}
            </span>
          )}
        </div>
      )}
      {!editMode && connectError && (
        <div className="dag-edit-mode-banner error-only">
          <span className="banner-error">⚠️ {connectError}</span>
        </div>
      )}

      {/* Infinite Draggable Viewport (Excalidraw Canvas) */}
      <div
        className={`dag-infinite-viewport${isDragging ? " is-dragging" : ""}${connectingFrom ? " is-connecting" : ""}`}
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
            editMode={editMode}
            onRemoveEdge={removeEdge}
            dragConnection={
              connectingFrom && mousePos
                ? { sourcePos: connectingFrom.startPos, currentPos: mousePos }
                : null
            }
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
                editMode={editMode}
                isConnecting={Boolean(connectingFrom)}
                isConnectingSource={connectingFrom?.sourceId === node.id}
                onHover={setHoveredNodeId}
                onSelectNode={setSelectedTaskId}
                onOpenInspector={() => {
                  setSelectedTaskId(node.id);
                  setInspectorOpen(true);
                }}
                onStartConnect={handleStartConnect}
                onPortMouseUp={handlePortMouseUp}
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
