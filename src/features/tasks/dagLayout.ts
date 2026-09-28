import type { ChecklistItem } from "../../data/roster";

export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Hardcoded aesthetic coordinates for Morning shift ensuring zero line occlusions
 * and clear hierarchical separation considering both time and dependency.
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
  icon: string;
  x: number;
}

export const TRACK_HEADERS: TrackHeaderInfo[] = [
  { title: "Exchange Ingestion & BOD", icon: "📁", x: 40 },
  { title: "High-Speed Market Feeds", icon: "⚡", x: 640 },
  { title: "Order Gateways & Execution", icon: "🎯", x: 1220 },
  { title: "Infra, Systems & Compliance", icon: "🛡️", x: 1840 },
];

/**
 * Computes node coordinates. If preset exists, returns it;
 * otherwise calculates dynamically based on time and dependency rank.
 */
export function getNodeCoordinates(
  node: ChecklistItem,
  allNodes: ChecklistItem[],
  shiftKey: string
): NodePosition {
  if (shiftKey === "Morning" && MORNING_COORDINATES[node.id]) {
    return MORNING_COORDINATES[node.id];
  }

  // Dynamic fallback for custom nodes or other shifts
  const index = allNodes.findIndex((n) => n.id === node.id);
  const col = index % 4;
  const row = Math.floor(index / 4);

  return {
    x: 40 + col * 320,
    y: 80 + row * 170,
  };
}
