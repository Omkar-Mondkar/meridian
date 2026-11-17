/**
 * useTaskStore — Task/checklist state with RBAC linked to Roster.
 * Enhanced with DAG dependency management, live flowchart tracking,
 * Exchange File Manifest inspection, and manual override capabilities.
 * Synchronized in real-time over WebSockets with MongoDB persistence.
 */
import { create } from "zustand";
import {
  makeInitialChecklists,
  type ChecklistItem,
  type ShiftKey,
  type NodeStatus,
  type TaskStatus,
} from "../data/roster";
import {
  getPersonasForTasks,
  DEFAULT_TASK_PERSONA,
  type Persona,
} from "../data/personas";
import {
  syncClient,
  type SyncConnectionStatus,
  type SyncDbMode,
  type SyncInitPayload,
} from "../lib/syncClient";

export interface AuditEvent {
  taskId: string;
  shift: string;
  process: string;
  completedBy: string;
  role: string;
  completedAt: string;
  action?: "advance_status" | "manual_set_to_ok" | "node_created";
  reason?: string;
}

export interface PollerClientStatus {
  state: 'active' | 'idle' | 'circuit_open' | 'no_credentials';
  consecutiveFailures?: number;
  lastCycleAt?: string | null;
  lastProbedTaskId?: string | null;
}

export type ViewMode = "graph" | "table";

const LOCAL_STORAGE_CUSTOM_NODES_KEY = "meridian_custom_nodes_v1";

function loadCustomNodesFromStorage(): Record<string, ChecklistItem[]> {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};
    const raw = window.localStorage.getItem(LOCAL_STORAGE_CUSTOM_NODES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.warn("[TaskStore] Failed to load custom nodes from localStorage:", e);
    return {};
  }
}

function saveCustomNodesToStorage(checklists: Record<string, ChecklistItem[]>) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const customOnly: Record<string, ChecklistItem[]> = {};
    for (const [shift, items] of Object.entries(checklists)) {
      const customs = items.filter((item) => item.isCustom);
      if (customs.length > 0) {
        customOnly[shift] = customs;
      }
    }
    window.localStorage.setItem(LOCAL_STORAGE_CUSTOM_NODES_KEY, JSON.stringify(customOnly));
  } catch (e) {
    console.warn("[TaskStore] Failed to save custom nodes to localStorage:", e);
  }
}

function getInitialChecklistsWithPersistence(): Record<string, ChecklistItem[]> {
  const initial = makeInitialChecklists();
  const stored = loadCustomNodesFromStorage();
  for (const [shift, items] of Object.entries(stored)) {
    if (!initial[shift]) initial[shift] = [];
    for (const customItem of items) {
      if (!initial[shift].some((x) => x.id === customItem.id)) {
        initial[shift].push(customItem);
      }
    }
  }
  return initial;
}

export function resolveNodeShift(node: { id?: string; shift?: string; pipeline?: string }): string {
  if (node.shift && (node.shift === "Morning" || node.shift === "Evening" || node.shift === "Night")) {
    return node.shift;
  }
  if (node.id) {
    if (node.id.startsWith("M")) return "Morning";
    if (node.id.startsWith("E")) return "Evening";
    if (node.id.startsWith("N")) return "Night";
  }
  return "Morning";
}

interface TaskState {
  checklists: Record<string, ChecklistItem[]>;
  selectedShift: ShiftKey;
  shiftAutoFollow: boolean;
  currentPersona: Persona;
  auditLog: AuditEvent[];

  // Connectivity & Backend Sync
  syncStatus: SyncConnectionStatus;
  dbMode: SyncDbMode;
  pollerStatus: PollerClientStatus;

  // Flowchart & DAG State
  viewMode: ViewMode;
  editMode: boolean; // Builder mode for custom nodes & edges
  selectedTaskId: string | null;
  inspectorOpen: boolean;
  nodeBuilderOpen: boolean;
  editingNode: ChecklistItem | null;

  // Actions
  setPollerStatus: (status: PollerClientStatus) => void;
  setSelectedShift: (shift: ShiftKey, manual: boolean) => void;
  setAutoFollow: (v: boolean) => void;
  autoFollowTo: (shift: ShiftKey) => void;
  setPersona: (persona: Persona) => void;
  setViewMode: (mode: ViewMode) => void;
  setEditMode: (v: boolean) => void;
  setSelectedTaskId: (id: string | null) => void;
  setInspectorOpen: (open: boolean) => void;
  setNodeBuilderOpen: (open: boolean) => void;
  setEditingNode: (node: ChecklistItem | null) => void;

  advanceStatus: (
    shiftKey: string,
    taskId: string,
    personaName: string,
    personaRole: string,
  ) => void;

  setTaskStatusToOk: (
    shiftKey: string,
    taskId: string,
    personaName: string,
    personaRole: string,
    reason?: string,
  ) => void;

  addCustomTaskNode: (shiftKey: string, item: ChecklistItem) => void;
  updateCustomTaskNode: (shiftKey: string, item: ChecklistItem) => void;
  deleteCustomTaskNode: (shiftKey: string, nodeId: string) => void;

  updateExchangeFileStatus: (
    fileId: string,
    status: "downloaded" | "pending" | "failed",
  ) => void;

  getNodeDerivedStatus: (shiftKey: string, taskId: string) => NodeStatus;

  addEdge: (
    shiftKey: string,
    sourceId: string,
    targetId: string,
  ) => { success: boolean; error?: string };

  removeEdge: (
    shiftKey: string,
    sourceId: string,
    targetId: string,
  ) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  checklists: getInitialChecklistsWithPersistence(),
  selectedShift: "Morning",
  shiftAutoFollow: true,
  currentPersona: DEFAULT_TASK_PERSONA,
  auditLog: [],

  syncStatus: syncClient.getStatus(),
  dbMode: syncClient.getDbMode(),
  pollerStatus: { state: "idle" },

  viewMode: "graph",
  editMode: false,
  selectedTaskId: null,
  inspectorOpen: false,
  nodeBuilderOpen: false,
  editingNode: null,

  setPollerStatus: (pollerStatus) => set({ pollerStatus }),
  setSelectedShift: (shift, manual) => {
    const prevPersona = get().currentPersona;
    const available = getPersonasForTasks(shift);

    let nextPersona = prevPersona;
    if (prevPersona.shift && prevPersona.shift !== "All" && prevPersona.shift !== shift) {
      nextPersona = available.shiftMembers[0] || available.all[0];
    }

    set({
      selectedShift: shift,
      currentPersona: nextPersona,
      selectedTaskId: null,
      inspectorOpen: false,
      ...(manual ? { shiftAutoFollow: false } : {}),
    });
  },

  setAutoFollow: (v) => set({ shiftAutoFollow: v }),

  autoFollowTo: (shift) => {
    if (get().shiftAutoFollow) {
      const prevPersona = get().currentPersona;
      const available = getPersonasForTasks(shift);

      let nextPersona = prevPersona;
      if (prevPersona.shift && prevPersona.shift !== "All" && prevPersona.shift !== shift) {
        nextPersona = available.shiftMembers[0] || available.all[0];
      }

      set({ selectedShift: shift, currentPersona: nextPersona });
    }
  },

  setPersona: (persona) => set({ currentPersona: persona }),
  setViewMode: (viewMode) => set({ viewMode }),
  setEditMode: (editMode) => set({ editMode }),
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  setNodeBuilderOpen: (nodeBuilderOpen) =>
    set({ nodeBuilderOpen, ...(nodeBuilderOpen ? {} : { editingNode: null }) }),
  setEditingNode: (editingNode) =>
    set({ editingNode, nodeBuilderOpen: editingNode !== null }),

  getNodeDerivedStatus: (shiftKey, taskId) => {
    const rows = get().checklists[shiftKey] || [];
    const node = rows.find((r) => r.id === taskId);
    if (!node) return "ready";

    if (node.status === "completed") return "completed";
    if (node.status === "in_progress") return "in_progress";

    // If node has dependencies, verify whether all parents are completed
    if (node.dependsOn && node.dependsOn.length > 0) {
      const allParentsCompleted = node.dependsOn.every((parentId) => {
        const parent = rows.find((r) => r.id === parentId);
        return parent && parent.status === "completed";
      });

      if (!allParentsCompleted) {
        return "blocked";
      }
    }

    return "ready";
  },

  advanceStatus: (shiftKey, taskId, personaName, personaRole) => {
    const checklists = structuredClone(get().checklists);
    const rows = checklists[shiftKey];
    if (!rows) return;
    const row = rows.find((r) => r.id === taskId);
    if (!row || row.status === "completed") return;

    // Check if task is blocked by upstream dependencies
    const derived = get().getNodeDerivedStatus(shiftKey, taskId);
    if (derived === "blocked") {
      console.warn(`[TaskStore] Cannot advance task ${taskId}: blocked by prerequisites`);
      return;
    }

    const nextStatus: TaskStatus = row.status === "open" ? "in_progress" : "completed";
    row.status = nextStatus;

    if (nextStatus === "completed") {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const timeStr = fmt.format(now);
      row.completedBy = personaName;
      row.completedAt = timeStr;

      const event: AuditEvent = {
        taskId: row.id,
        shift: shiftKey,
        process: row.process,
        completedBy: personaName,
        role: personaRole,
        completedAt: now.toISOString(),
        action: "advance_status",
      };

      set((s) => ({ checklists, auditLog: [event, ...s.auditLog] }));
    } else {
      set({ checklists });
    }

    // Broadcast change to server & other active screens
    syncClient.sendTaskUpdate(row.id, nextStatus, personaName, `Advanced by ${personaName} (${personaRole})`);
  },

  setTaskStatusToOk: (shiftKey, taskId, personaName, personaRole, reason) => {
    const checklists = structuredClone(get().checklists);
    const rows = checklists[shiftKey];
    if (!rows) return;
    const row = rows.find((r) => r.id === taskId);
    if (!row) return;

    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const timeStr = fmt.format(now);

    row.status = "completed";
    row.completedBy = `${personaName} (Manual OK)`;
    row.completedAt = timeStr;

    // If task has fileManifest (e.g. M1 Exchange File Download), mark all files downloaded
    if (row.fileManifest) {
      row.fileManifest.files.forEach((f) => {
        if (f.status !== "downloaded") {
          f.status = "downloaded";
          f.downloadedAt = timeStr;
        }
      });
      row.fileManifest.downloadedCount = row.fileManifest.totalExpected;
      row.fileManifest.pendingCount = 0;
      row.fileManifest.failedCount = 0;
    }

    const effectiveReason = reason || "Manual operational sign-off by Shift Operator";
    const event: AuditEvent = {
      taskId: row.id,
      shift: shiftKey,
      process: row.process,
      completedBy: personaName,
      role: personaRole,
      completedAt: now.toISOString(),
      action: "manual_set_to_ok",
      reason: effectiveReason,
    };

    set((s) => ({ checklists, auditLog: [event, ...s.auditLog] }));

    // Broadcast manual override to server & other active screens
    syncClient.sendTaskOverride(row.id, personaName, effectiveReason);
  },

  addCustomTaskNode: (shiftKey, item) => {
    const checklists = structuredClone(get().checklists);
    if (!checklists[shiftKey]) {
      checklists[shiftKey] = [];
    }

    const newItem: ChecklistItem = {
      ...item,
      shift: shiftKey,
      isCustom: true,
      status: item.status || "open",
    };

    checklists[shiftKey].push(newItem);
    saveCustomNodesToStorage(checklists);

    const event: AuditEvent = {
      taskId: newItem.id,
      shift: shiftKey,
      process: newItem.process,
      completedBy: get().currentPersona.name,
      role: get().currentPersona.role,
      completedAt: new Date().toISOString(),
      action: "node_created",
      reason: `Custom node added in ${shiftKey} shift DAG`,
    };

    set((s) => ({
      checklists,
      auditLog: [event, ...s.auditLog],
      nodeBuilderOpen: false,
      editingNode: null,
    }));

    // Broadcast node creation to server & other active screens
    syncClient.sendNodeCreate(newItem);
  },

  updateCustomTaskNode: (shiftKey, item) => {
    const checklists = structuredClone(get().checklists);
    const targetShift = item.shift || shiftKey;
    const rows = checklists[targetShift] || [];
    const index = rows.findIndex((r) => r.id === item.id);
    if (index === -1) return;

    rows[index] = {
      ...rows[index],
      ...item,
      shift: targetShift,
      isCustom: true,
    };
    checklists[targetShift] = rows;
    saveCustomNodesToStorage(checklists);

    const event: AuditEvent = {
      taskId: item.id,
      shift: targetShift,
      process: item.process,
      completedBy: get().currentPersona.name,
      role: get().currentPersona.role,
      completedAt: new Date().toISOString(),
      action: "advance_status",
      reason: `Custom node updated in ${targetShift} shift DAG`,
    };

    set((s) => ({
      checklists,
      auditLog: [event, ...s.auditLog],
      nodeBuilderOpen: false,
      editingNode: null,
    }));

    syncClient.sendNodeUpdate(rows[index]);
  },

  deleteCustomTaskNode: (shiftKey, nodeId) => {
    const checklists = structuredClone(get().checklists);
    const rows = checklists[shiftKey] || [];
    const target = rows.find((r) => r.id === nodeId);
    if (!target) return;

    // Filter out target node
    checklists[shiftKey] = rows.filter((r) => r.id !== nodeId);

    // Clean up any other nodes that have dependsOn referencing nodeId
    for (const r of checklists[shiftKey]) {
      if (r.dependsOn && r.dependsOn.includes(nodeId)) {
        r.dependsOn = r.dependsOn.filter((id) => id !== nodeId);
      }
    }

    saveCustomNodesToStorage(checklists);

    const event: AuditEvent = {
      taskId: nodeId,
      shift: shiftKey,
      process: target.process,
      completedBy: get().currentPersona.name,
      role: get().currentPersona.role,
      completedAt: new Date().toISOString(),
      action: "advance_status",
      reason: `Custom node deleted from ${shiftKey} shift DAG`,
    };

    set((s) => ({
      checklists,
      auditLog: [event, ...s.auditLog],
      nodeBuilderOpen: false,
      editingNode: null,
      selectedTaskId: s.selectedTaskId === nodeId ? null : s.selectedTaskId,
      inspectorOpen: s.selectedTaskId === nodeId ? false : s.inspectorOpen,
    }));

    syncClient.sendNodeDelete(shiftKey, nodeId);
  },

  updateExchangeFileStatus: (fileId, status) => {
    const checklists = structuredClone(get().checklists);
    const m1 = checklists["Morning"]?.find((r) => r.id === "M1");
    if (!m1 || !m1.fileManifest) return;

    const file = m1.fileManifest.files.find((f) => f.id === fileId);
    if (!file) return;

    file.status = status;
    if (status === "downloaded") {
      file.downloadedAt = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata" });
    }

    m1.fileManifest.downloadedCount = m1.fileManifest.files.filter((f) => f.status === "downloaded").length;
    m1.fileManifest.pendingCount = m1.fileManifest.files.filter((f) => f.status === "pending").length;
    m1.fileManifest.failedCount = m1.fileManifest.files.filter((f) => f.status === "failed").length;

    set({ checklists });
  },

  addEdge: (shiftKey, sourceId, targetId) => {
    if (sourceId === targetId) {
      return { success: false, error: "Cannot link a task to itself." };
    }
    const checklists = structuredClone(get().checklists);
    const rows = checklists[shiftKey] || [];
    const sourceNode = rows.find((r) => r.id === sourceId);
    const targetNode = rows.find((r) => r.id === targetId);
    if (!sourceNode || !targetNode) {
      return { success: false, error: "Source or Target node not found in current shift." };
    }

    if (!targetNode.dependsOn) {
      targetNode.dependsOn = [];
    }
    if (targetNode.dependsOn.includes(sourceId)) {
      return { success: false, error: "Connection already exists between these tasks." };
    }

    // Cycle check: can sourceId reach targetId by following existing upstream dependencies?
    // If sourceId depends on targetId (or any ancestor of sourceId is targetId), adding sourceId as dependency of targetId creates a cycle.
    const visited = new Set<string>();
    const queue = [sourceId];
    let hasCycle = false;

    while (queue.length > 0) {
      const currId = queue.shift()!;
      if (currId === targetId) {
        hasCycle = true;
        break;
      }
      visited.add(currId);
      const currNode = rows.find((r) => r.id === currId);
      if (currNode && currNode.dependsOn) {
        for (const parentId of currNode.dependsOn) {
          if (!visited.has(parentId)) {
            queue.push(parentId);
          }
        }
      }
    }

    if (hasCycle) {
      return {
        success: false,
        error: `Circular dependency detected: Task '${sourceId}' already depends on '${targetId}'!`,
      };
    }

    targetNode.dependsOn.push(sourceId);

    const event: AuditEvent = {
      taskId: targetId,
      shift: shiftKey,
      process: targetNode.process,
      completedBy: get().currentPersona.name,
      role: get().currentPersona.role,
      completedAt: new Date().toISOString(),
      action: "advance_status",
      reason: `DAG dependency added: ${sourceId} -> ${targetId}`,
    };

    set((s) => ({
      checklists,
      auditLog: [event, ...s.auditLog],
    }));

    syncClient.sendEdgeUpdate(shiftKey, sourceId, targetId, "add");
    return { success: true };
  },

  removeEdge: (shiftKey, sourceId, targetId) => {
    const checklists = structuredClone(get().checklists);
    const rows = checklists[shiftKey] || [];
    const targetNode = rows.find((r) => r.id === targetId);
    if (!targetNode || !targetNode.dependsOn) return;

    targetNode.dependsOn = targetNode.dependsOn.filter((id) => id !== sourceId);

    const event: AuditEvent = {
      taskId: targetId,
      shift: shiftKey,
      process: targetNode.process,
      completedBy: get().currentPersona.name,
      role: get().currentPersona.role,
      completedAt: new Date().toISOString(),
      action: "advance_status",
      reason: `DAG dependency removed: ${sourceId} -x- ${targetId}`,
    };

    set((s) => ({
      checklists,
      auditLog: [event, ...s.auditLog],
    }));

    syncClient.sendEdgeUpdate(shiftKey, sourceId, targetId, "remove");
  },
}));

// Wire real-time WebSocket subscriber
syncClient.subscribe((event) => {
  if (event.type === "STATUS_CHANGE") {
    useTaskStore.setState({
      syncStatus: event.data.status,
      dbMode: event.data.dbMode,
    });
  } else if (event.type === "SYNC_INIT") {
    const payload = event.data as SyncInitPayload;
    if (!payload) return;

    const checklists = structuredClone(useTaskStore.getState().checklists);

    // Apply remote task states
    if (payload.tasks) {
      for (const shift of Object.keys(checklists)) {
        for (const item of checklists[shift]) {
          const remote = payload.tasks[item.id];
          if (remote) {
            item.status =
              remote.status === "completed"
                ? "completed"
                : remote.status === "in_progress"
                  ? "in_progress"
                  : item.status;
            if (remote.updatedBy) item.completedBy = remote.updatedBy;
            if (remote.updatedAt) item.completedAt = remote.updatedAt;
            if (remote.status === "completed" && item.fileManifest) {
              item.fileManifest.files.forEach((f) => {
                f.status = "downloaded";
              });
              item.fileManifest.downloadedCount = item.fileManifest.totalExpected;
              item.fileManifest.pendingCount = 0;
              item.fileManifest.failedCount = 0;
            }
          }
        }
      }
    }

    // Merge custom nodes
    if (payload.customNodes && Array.isArray(payload.customNodes)) {
      for (const node of payload.customNodes) {
        const shift = resolveNodeShift(node);
        if (!checklists[shift]) checklists[shift] = [];
        const existingIdx = checklists[shift].findIndex((x) => x.id === node.id);
        if (existingIdx >= 0) {
          checklists[shift][existingIdx] = {
            ...checklists[shift][existingIdx],
            ...node,
            shift,
            isCustom: true,
          };
        } else {
          checklists[shift].push({ ...node, shift, isCustom: true });
        }
      }
      saveCustomNodesToStorage(checklists);
    }

    // Merge edge overrides
    if (payload.edgeOverrides && Array.isArray(payload.edgeOverrides)) {
      for (const override of payload.edgeOverrides) {
        const rows = checklists[override.shiftKey] || [];
        const target = rows.find((r) => r.id === override.targetId);
        if (target) {
          if (!target.dependsOn) target.dependsOn = [];
          if (override.action === "add") {
            if (!target.dependsOn.includes(override.sourceId)) {
              target.dependsOn.push(override.sourceId);
            }
          } else if (override.action === "remove") {
            target.dependsOn = target.dependsOn.filter((id) => id !== override.sourceId);
          }
        }
      }
    }

    // Merge remote audit logs
    const auditLog: AuditEvent[] = (payload.auditEvents || []).map((ev) => ({
      taskId: ev.taskId,
      shift: "Morning",
      process: ev.action === "MANUAL_SET_TO_OK" ? "Manual Override" : ev.action,
      completedBy: ev.operator,
      role: "Operator",
      completedAt: ev.timestamp,
      action: ev.action === "MANUAL_SET_TO_OK" ? "manual_set_to_ok" : "advance_status",
      reason: ev.reason,
    }));

    useTaskStore.setState({
      checklists,
      auditLog: auditLog.length > 0 ? auditLog : useTaskStore.getState().auditLog,
      syncStatus: syncClient.getStatus(),
      dbMode: payload.dbMode || "fallback",
    });
  } else if (event.type === "TASK_UPDATED") {
    const record = event.data?.record;
    if (!record) return;

    const checklists = structuredClone(useTaskStore.getState().checklists);
    for (const shift of Object.keys(checklists)) {
      const item = checklists[shift].find((x) => x.id === record.id);
      if (item) {
        item.status =
          record.status === "completed"
            ? "completed"
            : record.status === "in_progress"
              ? "in_progress"
              : item.status;
        if (record.updatedBy) item.completedBy = record.updatedBy;
        if (record.updatedAt) item.completedAt = record.updatedAt;
      }
    }
    useTaskStore.setState({ checklists });
  } else if (event.type === "TASK_OVERRIDDEN") {
    const { record } = event.data || {};
    if (!record) return;

    const checklists = structuredClone(useTaskStore.getState().checklists);
    for (const shift of Object.keys(checklists)) {
      const item = checklists[shift].find((x) => x.id === record.id);
      if (item) {
        item.status = "completed";
        item.completedBy = `${record.updatedBy} (Manual OK)`;
        item.completedAt = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata" });
        if (item.fileManifest) {
          item.fileManifest.files.forEach((f) => {
            f.status = "downloaded";
          });
          item.fileManifest.downloadedCount = item.fileManifest.totalExpected;
          item.fileManifest.pendingCount = 0;
          item.fileManifest.failedCount = 0;
        }
      }
    }

    const newLogItem: AuditEvent = {
      taskId: record.id,
      shift: "Morning",
      process: "Manual Override",
      completedBy: record.updatedBy || "Operator",
      role: "Operator",
      completedAt: record.updatedAt || new Date().toISOString(),
      action: "manual_set_to_ok",
      reason: record.reason || "Manual Set to OK",
    };

    useTaskStore.setState((s) => ({
      checklists,
      auditLog: [newLogItem, ...s.auditLog],
    }));
  } else if (event.type === "NODE_CREATED") {
    const node = event.data?.node;
    if (!node) return;

    const checklists = structuredClone(useTaskStore.getState().checklists);
    const shift = resolveNodeShift(node);
    if (!checklists[shift]) checklists[shift] = [];
    if (!checklists[shift].some((x) => x.id === node.id)) {
      checklists[shift].push({ ...node, shift, isCustom: true });
      saveCustomNodesToStorage(checklists);
      useTaskStore.setState({ checklists });
    }
  } else if (event.type === "NODE_UPDATED") {
    const node = event.data?.node;
    if (!node) return;

    const checklists = structuredClone(useTaskStore.getState().checklists);
    const shift = resolveNodeShift(node);
    if (!checklists[shift]) checklists[shift] = [];
    const idx = checklists[shift].findIndex((x) => x.id === node.id);
    if (idx >= 0) {
      checklists[shift][idx] = {
        ...checklists[shift][idx],
        ...node,
        shift,
        isCustom: true,
      };
      saveCustomNodesToStorage(checklists);
      useTaskStore.setState({ checklists });
    }
  } else if (event.type === "NODE_DELETED") {
    const { shiftKey, nodeId } = event.data || {};
    if (!shiftKey || !nodeId) return;

    const checklists = structuredClone(useTaskStore.getState().checklists);
    if (checklists[shiftKey]) {
      checklists[shiftKey] = checklists[shiftKey].filter((x) => x.id !== nodeId);
      for (const r of checklists[shiftKey]) {
        if (r.dependsOn && r.dependsOn.includes(nodeId)) {
          r.dependsOn = r.dependsOn.filter((id) => id !== nodeId);
        }
      }
      saveCustomNodesToStorage(checklists);
      useTaskStore.setState((s) => ({
        checklists,
        selectedTaskId: s.selectedTaskId === nodeId ? null : s.selectedTaskId,
        inspectorOpen: s.selectedTaskId === nodeId ? false : s.inspectorOpen,
      }));
    }
  } else if (event.type === "TASK_COMPLETED_BY_POLLER") {
    const { taskId, record, matchDetail } = event.data || {};
    if (!taskId) return;

    const checklists = structuredClone(useTaskStore.getState().checklists);
    for (const shift of Object.keys(checklists)) {
      const item = checklists[shift].find((x) => x.id === taskId);
      if (item) {
        item.status = "completed";
        item.completedBy = "Poller Daemon";
        item.completedAt = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata" });
        if (item.fileManifest) {
          item.fileManifest.files.forEach((f) => {
            f.status = "downloaded";
          });
          item.fileManifest.downloadedCount = item.fileManifest.totalExpected;
          item.fileManifest.pendingCount = 0;
          item.fileManifest.failedCount = 0;
        }
      }
    }

    const newLogItem: AuditEvent = {
      taskId,
      shift: "Morning",
      process: "Automated Poller Verification",
      completedBy: "Poller Daemon",
      role: "System",
      completedAt: record?.updatedAt || new Date().toISOString(),
      action: "advance_status",
      reason: matchDetail || "Auto-verified via SSH probe",
    };

    useTaskStore.setState((s) => ({
      checklists,
      auditLog: [newLogItem, ...s.auditLog],
    }));
  } else if (event.type === "POLLER_STATUS") {
    const status = event.data?.status;
    if (status) {
      useTaskStore.setState({ pollerStatus: status });
    }
  } else if (event.type === "TASK_METRICS_UPDATED") {
    const { taskId, metrics } = event.data || {};
    if (!taskId || !metrics) return;

    const checklists = structuredClone(useTaskStore.getState().checklists);
    for (const shift of Object.keys(checklists)) {
      const item = checklists[shift].find((x) => x.id === taskId);
      if (item && item.fileManifest) {
        if (typeof metrics.downloaded === "number") {
          item.fileManifest.downloadedCount = metrics.downloaded;
        }
        if (typeof metrics.total === "number") {
          item.fileManifest.totalExpected = metrics.total;
        }
        item.fileManifest.pendingCount = Math.max(
          0,
          item.fileManifest.totalExpected - item.fileManifest.downloadedCount
        );
      }
    }
    useTaskStore.setState({ checklists });
  } else if (event.type === "EDGE_UPDATED") {
    const { shiftKey, sourceId, targetId, action } = event.data || {};
    if (!shiftKey || !sourceId || !targetId) return;

    const checklists = structuredClone(useTaskStore.getState().checklists);
    const rows = checklists[shiftKey] || [];
    const target = rows.find((r) => r.id === targetId);
    if (target) {
      if (!target.dependsOn) target.dependsOn = [];
      if (action === "add") {
        if (!target.dependsOn.includes(sourceId)) {
          target.dependsOn.push(sourceId);
        }
      } else if (action === "remove") {
        target.dependsOn = target.dependsOn.filter((id) => id !== sourceId);
      }
      useTaskStore.setState({ checklists });
    }
  }
});
