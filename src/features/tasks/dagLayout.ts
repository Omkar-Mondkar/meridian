import type { ChecklistItem } from "../../data/roster";

export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Hardcoded aesthetic coordinates for Morning shift baseline tasks ensuring
 * zero line occlusions and clear hierarchical separation.
 */
const MORNING_COORDINATES: Record<string, NodePosition> = {
  // --- EXCHANGE PIPELINE ---
  M1: { x: 180, y: 70 },   // 00:30 Exchange File Download (Root)
  M2: { x: 40, y: 250 },   // 06:30 K2 Mails (from M1)
  M3: { x: 320, y: 250 },  // 06:30 Greeksoft BOD (from M1)
  M10: { x: 40, y: 430 },  // 08:00 K2 & Kavach (from M2)
  M4: { x: 320, y: 430 },  // 07:00 GREEK DB QUERY CHECK (from M3)

  // --- MARKET DATA FEEDS ---
  M5: { x: 640, y: 70 },   // 07:00 TBT Adaptor (Root)
  M6: { x: 920, y: 70 },   // 07:00 Fast feed (Root)
  M11: { x: 780, y: 250 }, // 08:00 TBT Recorder (from M5, M6)

  // --- TRADING EXECUTION ---
  M8: { x: 1360, y: 70 },  // 07:10 Executors (Root)
  M14: { x: 1220, y: 250 }, // 08:20 After Restart Dependency (from M8)
  M16: { x: 1500, y: 250 }, // 09:15 LTP check (from M5, M8)
  M18: { x: 1360, y: 430 }, // 12:35 Eagle BOD (from M8)

  // --- INFRA, SYSTEMS & COMPLIANCE ---
  M7: { x: 1840, y: 70 },   // 07:00 Health Reports Checks (Root)
  M12: { x: 1840, y: 220 }, // 08:05 NSE Windows UDP Check (from M7)
  M9: { x: 1840, y: 360 },  // 07:30 Control M Alerts (Independent)
  M13: { x: 1840, y: 500 }, // 08:15 BCP BOD Check (Independent)
  M15: { x: 1840, y: 640 }, // 08:30 Audit check (Independent)
  M17: { x: 1840, y: 780 }, // 10:30 UAT Test Environment BOD (Independent)
};

export interface TrackHeaderInfo {
  title: string;
  trackId: "exchange" | "market_data" | "execution" | "infra";
  icon: string;
  x: number;
}

export const TRACK_HEADERS: TrackHeaderInfo[] = [
  { title: "Exchange Ingestion & BOD", trackId: "exchange", icon: "exchange", x: 40 },
  { title: "High-Speed Market Feeds", trackId: "market_data", icon: "market_data", x: 640 },
  { title: "Order Gateways & Execution", trackId: "execution", icon: "execution", x: 1220 },
  { title: "Infra, Systems & Compliance", trackId: "infra", icon: "infra", x: 1840 },
];

interface TrackConfig {
  trackId: "exchange" | "market_data" | "execution" | "infra";
  center: number;
  subLanes: number[];
}

const TRACK_CONFIGS: Record<string, TrackConfig> = {
  exchange: {
    trackId: "exchange",
    center: 180,
    subLanes: [40, 320, 180, 500],
  },
  market_data: {
    trackId: "market_data",
    center: 780,
    subLanes: [640, 920, 780, 1060],
  },
  execution: {
    trackId: "execution",
    center: 1360,
    subLanes: [1220, 1500, 1360, 1640],
  },
  infra: {
    trackId: "infra",
    center: 1840,
    subLanes: [1840, 2120],
  },
};

/**
 * Computes recursive dependency depth to sort nodes topologically
 */
function getDependencyDepth(
  nodeId: string,
  nodeMap: Map<string, ChecklistItem>,
  visited = new Set<string>()
): number {
  if (visited.has(nodeId)) return 0;
  visited.add(nodeId);

  const node = nodeMap.get(nodeId);
  if (!node || !node.dependsOn || node.dependsOn.length === 0) {
    return 0;
  }

  let maxParentDepth = 0;
  for (const parentId of node.dependsOn) {
    if (parentId !== nodeId) {
      const pDepth = getDependencyDepth(parentId, nodeMap, new Set(visited));
      if (pDepth + 1 > maxParentDepth) {
        maxParentDepth = pDepth + 1;
      }
    }
  }

  return maxParentDepth;
}

/**
 * Infers which pipeline track a node belongs to
 */
function inferPipelineTrack(
  node: ChecklistItem,
  nodeMap: Map<string, ChecklistItem>
): "exchange" | "market_data" | "execution" | "infra" {
  if (
    node.pipeline &&
    node.pipeline !== "other" &&
    TRACK_CONFIGS[node.pipeline]
  ) {
    return node.pipeline;
  }

  // Look at parents
  if (node.dependsOn && node.dependsOn.length > 0) {
    for (const pId of node.dependsOn) {
      const parent = nodeMap.get(pId);
      if (parent) {
        if (
          parent.pipeline &&
          parent.pipeline !== "other" &&
          TRACK_CONFIGS[parent.pipeline]
        ) {
          return parent.pipeline;
        }
        if (MORNING_COORDINATES[parent.id]) {
          const px = MORNING_COORDINATES[parent.id].x;
          if (px >= 1840) return "infra";
          if (px >= 1220) return "execution";
          if (px >= 640) return "market_data";
          return "exchange";
        }
      }
    }
  }

  return "exchange";
}

/**
 * Checks if a candidate position collides with an already placed card.
 * Node cards have width: 250px, height: ~80px.
 */
function isColliding(
  x: number,
  y: number,
  placedPositions: NodePosition[]
): boolean {
  for (const p of placedPositions) {
    if (Math.abs(x - p.x) < 270 && Math.abs(y - p.y) < 130) {
      return true;
    }
  }
  return false;
}

/**
 * Computes a full dependency-wise tree hierarchy layout for DAG nodes.
 */
export function computeHierarchicalLayout(
  allNodes: ChecklistItem[],
  shiftKey: string
): Map<string, NodePosition> {
  const layout = new Map<string, NodePosition>();
  const placedList: NodePosition[] = [];
  const nodeMap = new Map<string, ChecklistItem>(allNodes.map((n) => [n.id, n]));

  // 1. Populate baseline coordinates for morning shift presets
  if (shiftKey === "Morning") {
    for (const node of allNodes) {
      if (MORNING_COORDINATES[node.id]) {
        const pos = { ...MORNING_COORDINATES[node.id] };
        layout.set(node.id, pos);
        placedList.push(pos);
      }
    }
  }

  // 2. Identify unplaced nodes and sort topologically (parents before children)
  const unplaced = allNodes.filter((n) => !layout.has(n.id));
  unplaced.sort((a, b) => {
    const depthA = getDependencyDepth(a.id, nodeMap);
    const depthB = getDependencyDepth(b.id, nodeMap);
    if (depthA !== depthB) return depthA - depthB;
    // Tie-breaker: keep consistent order
    return a.id.localeCompare(b.id);
  });

  // 3. Place each node maintaining tree hierarchy
  for (const node of unplaced) {
    const trackId = inferPipelineTrack(node, nodeMap);
    const trackCfg = TRACK_CONFIGS[trackId] || TRACK_CONFIGS.exchange;

    // Determine parent positions
    const parents = (node.dependsOn || [])
      .map((pId) => ({ id: pId, pos: layout.get(pId) }))
      .filter((p): p is { id: string; pos: NodePosition } => p.pos !== undefined);

    // Tree hierarchy vertical positioning: child MUST sit below all its parents
    let candidateY = 70;
    if (parents.length > 0) {
      const maxParentY = Math.max(...parents.map((p) => p.pos.y));
      candidateY = maxParentY + 180;
    } else {
      // Root node in this track: find lowest Y of root nodes or start at 70
      candidateY = 70;
    }

    // Horizontal positioning: align under parents or center in track
    let idealX = trackCfg.center;
    if (parents.length > 0) {
      // Filter parents in the same track or find average
      const sameTrackParents = parents.filter((p) => {
        const pNode = nodeMap.get(p.id);
        return pNode && inferPipelineTrack(pNode, nodeMap) === trackId;
      });

      if (sameTrackParents.length > 0) {
        idealX = Math.round(
          sameTrackParents.reduce((sum, p) => sum + p.pos.x, 0) / sameTrackParents.length
        );
      } else {
        // Cross-pipeline dependency: choose sub-lane closest to parent average
        const avgParentX =
          parents.reduce((sum, p) => sum + p.pos.x, 0) / parents.length;
        idealX = avgParentX;
      }
    }

    // Sort sub-lanes by distance to idealX for optimal visual centering
    const sortedSubLanes = [...trackCfg.subLanes].sort(
      (a, b) => Math.abs(a - idealX) - Math.abs(b - idealX)
    );

    // Find non-colliding (x, y) slot starting at candidateY
    let chosenX = sortedSubLanes[0];
    let chosenY = candidateY;
    let found = false;

    // Check up to 50 downward tiers to guarantee placement
    for (let tier = 0; tier < 50; tier++) {
      const currentY = candidateY + tier * 180;
      for (const laneX of sortedSubLanes) {
        if (!isColliding(laneX, currentY, placedList)) {
          chosenX = laneX;
          chosenY = currentY;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    const finalPos: NodePosition = { x: chosenX, y: chosenY };
    layout.set(node.id, finalPos);
    placedList.push(finalPos);
  }

  return layout;
}

// Layout cache for high performance across render cycles
let cachedShiftKey = "";
let cachedFingerprint = "";
let cachedLayout = new Map<string, NodePosition>();

function getOrComputeLayout(
  allNodes: ChecklistItem[],
  shiftKey: string
): Map<string, NodePosition> {
  const fingerprint = allNodes
    .map((n) => `${n.id}:${n.pipeline || ""}:${(n.dependsOn || []).join(",")}`)
    .join(";");

  if (
    cachedShiftKey === shiftKey &&
    cachedFingerprint === fingerprint &&
    cachedLayout.size > 0
  ) {
    return cachedLayout;
  }

  cachedShiftKey = shiftKey;
  cachedFingerprint = fingerprint;
  cachedLayout = computeHierarchicalLayout(allNodes, shiftKey);
  return cachedLayout;
}

/**
 * Computes node coordinates maintaining dependency-wise tree hierarchy structure.
 */
export function getNodeCoordinates(
  node: ChecklistItem,
  allNodes: ChecklistItem[],
  shiftKey: string
): NodePosition {
  const layout = getOrComputeLayout(allNodes, shiftKey);
  const pos = layout.get(node.id);
  if (pos) return pos;

  return {
    x: 40,
    y: 70,
  };
}
