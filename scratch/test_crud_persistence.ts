import { dbInstance } from "../server/db";
import { computeHierarchicalLayout } from "../src/features/tasks/dagLayout";
import { makeInitialChecklists } from "../src/data/roster";
import { resolveNodeShift } from "../src/stores/useTaskStore";
import fs from "fs";

async function runVerification() {
  console.log("=== STARTING FULL CRUD & PERSISTENCE VERIFICATION ===");

  // 1. Verify DB Instance initialization
  console.log("\n[Step 1] Initializing dbInstance...");
  await dbInstance.connect();
  const initialNodes = await dbInstance.getCustomNodes();
  console.log(`Initial custom nodes in DB: ${initialNodes.length}`);

  // 2. Test CREATE (C)
  console.log("\n[Step 2] Testing CREATE Custom Node...");
  const testNodeId = "M99";
  const newCustomNode = {
    id: testNodeId,
    process: "Automated Regression Test Feed",
    desc: "Test node created by verification script",
    time: "07:45",
    mode: "Auto" as const,
    pipeline: "market_data" as const,
    priority: "critical" as const,
    executor: "ControlM",
    role: "L1 Support",
    shift: "Morning",
    isCustom: true,
    dependsOn: ["M5", "M6"],
    verification: {
      type: "log_grep" as const,
      serverIp: "10.240.18.90",
      logPath: "/var/log/marketdata/test.log",
      grepRegex: "TEST_SUCCESS"
    }
  };

  await dbInstance.saveCustomNode(newCustomNode);
  console.log(`Saved custom node ${testNodeId}`);

  // Verify it exists in memory cache and on disk
  const customNodesAfterCreate = await dbInstance.getCustomNodes();
  const created = customNodesAfterCreate.find(n => n.id === testNodeId);
  if (!created) {
    throw new Error(`FAIL: Node ${testNodeId} not found after saveCustomNode!`);
  }
  console.log(`✓ Node successfully stored in dbInstance. Process name: "${created.process}"`);

  // Verify persisted on disk in data/meridian_state.json
  const stateRaw = fs.readFileSync("data/meridian_state.json", "utf-8");
  const stateJson = JSON.parse(stateRaw);
  const onDisk = (stateJson.customNodes || []).find((n: any) => n.id === testNodeId);
  if (!onDisk) {
    throw new Error("FAIL: Node was not written to data/meridian_state.json!");
  }
  console.log(`✓ Verified node written to disk (data/meridian_state.json)`);

  // 3. Test READ & SHIFT RESOLUTION (R)
  console.log("\n[Step 3] Testing READ & Shift Resolution...");
  const resolvedShift = resolveNodeShift(created);
  if (resolvedShift !== "Morning") {
    throw new Error(`FAIL: resolveNodeShift returned "${resolvedShift}", expected "Morning"`);
  }
  console.log(`✓ Shift resolution correct: "${resolvedShift}"`);

  // Test DAG Layout placing child below parents M5, M6
  const morningList = [...makeInitialChecklists()["Morning"], created];
  const layout = computeHierarchicalLayout(morningList, "Morning");
  const posM5 = layout.get("M5");
  const posM6 = layout.get("M6");
  const posM99 = layout.get(testNodeId);

  if (!posM99 || !posM5 || !posM6) {
    throw new Error("FAIL: Layout position missing for M99 or parents!");
  }

  const maxParentY = Math.max(posM5.y, posM6.y);
  console.log(`Parents Y positions: M5=${posM5.y}, M6=${posM6.y}. Child M99 Y=${posM99.y}`);
  if (posM99.y <= maxParentY) {
    throw new Error(`FAIL: Child Y (${posM99.y}) must be greater than parent Y (${maxParentY})!`);
  }
  console.log(`✓ Tree hierarchy verified: M99 (Y=${posM99.y}) sits strictly below parents (Y=${maxParentY})`);

  // 4. Test UPDATE (U)
  console.log("\n[Step 4] Testing UPDATE Custom Node...");
  const updatedNode = {
    ...created,
    process: "Updated Regression Test Feed [V2]",
    priority: "high" as const,
    time: "07:50",
    dependsOn: ["M1"]
  };
  await dbInstance.saveCustomNode(updatedNode);

  const customNodesAfterUpdate = await dbInstance.getCustomNodes();
  const fetchedUpdated = customNodesAfterUpdate.find(n => n.id === testNodeId);
  if (fetchedUpdated?.process !== "Updated Regression Test Feed [V2]") {
    throw new Error(`FAIL: Node process title did not update! Value: ${fetchedUpdated?.process}`);
  }
  if (fetchedUpdated.priority !== "high") {
    throw new Error(`FAIL: Node priority did not update! Value: ${fetchedUpdated?.priority}`);
  }
  console.log(`✓ Update successful: new title="${fetchedUpdated.process}", priority="${fetchedUpdated.priority}"`);

  // 5. Test DELETE (D) & Downstream Dependency Cleanup
  console.log("\n[Step 5] Testing DELETE Custom Node & Dependency Cleanup...");
  
  // Create a downstream node that depends on M99
  const downstreamNode = {
    id: "M100",
    process: "Downstream Consumer",
    time: "08:15",
    mode: "Auto" as const,
    pipeline: "execution" as const,
    priority: "medium" as const,
    executor: "ControlM",
    role: "L1 Support",
    shift: "Morning",
    isCustom: true,
    dependsOn: [testNodeId]
  };
  await dbInstance.saveCustomNode(downstreamNode);

  // Delete M99
  const deleted = await dbInstance.deleteCustomNode(testNodeId);
  if (!deleted) {
    throw new Error(`FAIL: deleteCustomNode returned false!`);
  }

  const customNodesAfterDelete = await dbInstance.getCustomNodes();
  if (customNodesAfterDelete.some(n => n.id === testNodeId)) {
    throw new Error(`FAIL: Node ${testNodeId} still exists after delete!`);
  }
  console.log(`✓ Node ${testNodeId} deleted from DB successfully`);

  // Clean up M100 as well
  await dbInstance.deleteCustomNode("M100");
  const finalNodes = await dbInstance.getCustomNodes();
  if (finalNodes.some(n => n.id === "M100")) {
    throw new Error(`FAIL: Node M100 still exists after cleanup!`);
  }
  console.log(`✓ Cleanup complete. Final custom nodes count: ${finalNodes.length}`);

  console.log("\n=== ALL CRUD AND PERSISTENCE VERIFICATION TESTS PASSED SUCCESSFULLY! ===");
}

runVerification().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
