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

export type ViewMode = "graph" | "table";

interface TaskState {
  checklists: Record<string, ChecklistItem[]>;
  selectedShift: ShiftKey;
  shiftAutoFollow: boolean;
  currentPersona: Persona;
  auditLog: AuditEvent[];

  // Connectivity & Backend Sync
  syncStatus: SyncConnectionStatus;
  dbMode: SyncDbMode;

  // Flowchart & DAG State
  viewMode: ViewMode;
  editMode: boolean; // Builder mode for custom nodes & edges
  selectedTaskId: string | null;
  inspectorOpen: boolean;
  nodeBuilderOpen: boolean;

  // Actions
  setSelectedShift: (shift: ShiftKey, manual: boolean) => void;
  setAutoFollow: (v: boolean) => void;
  autoFollowTo: (shift: ShiftKey) => void;
  setPersona: (persona: Persona) => void;
  setViewMode: (mode: ViewMode) => void;
  setEditMode: (v: boolean) => void;
  setSelectedTaskId: (id: string | null) => void;
  setInspectorOpen: (open: boolean) => void;
  setNodeBuilderOpen: (open: boolean) => void;

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

  updateExchangeFileStatus: (
    fileId: string,
    status: "downloaded" | "pending" | "failed",
  ) => void;

  getNodeDerivedStatus: (shiftKey: string, taskId: string) => NodeStatus;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  checklists: makeInitialChecklists(),
  selectedShift: "Morning",
  shiftAutoFollow: true,
  currentPersona: DEFAULT_TASK_PERSONA,
  auditLog: [],

  syncStatus: syncClient.getStatus(),
  dbMode: syncClient.getDbMode(),

  viewMode: "graph",
  editMode: false,
  selectedTaskId: null,
  inspectorOpen: false,
  nodeBuilderOpen: false,

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
  setNodeBuilderOpen: (nodeBuilderOpen) => set({ nodeBuilderOpen }),

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
      isCustom: true,
      status: "open",
    };

    checklists[shiftKey].push(newItem);

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
    }));

    // Broadcast node creation to server & other active screens
    syncClient.sendNodeCreate(newItem);
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
        const shift = node.pipeline || "Morning";
        if (!checklists[shift]) checklists[shift] = [];
        if (!checklists[shift].some((x) => x.id === node.id)) {
          checklists[shift].push({ ...node, isCustom: true });
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
    const shift = node.pipeline || "Morning";
    if (!checklists[shift]) checklists[shift] = [];
    if (!checklists[shift].some((x) => x.id === node.id)) {
      checklists[shift].push({ ...node, isCustom: true });
      useTaskStore.setState({ checklists });
    }
  }
});
