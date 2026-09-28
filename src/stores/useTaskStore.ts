/**
 * useTaskStore — Task/checklist state with RBAC linked to Roster.
 * Enhanced with DAG dependency management, live flowchart tracking,
 * Exchange File Manifest inspection, and manual override capabilities.
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

      console.log("[audit → mongo task_completion_events]", event);
      set((s) => ({ checklists, auditLog: [...s.auditLog, event] }));
    } else {
      set({ checklists });
    }
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

    const event: AuditEvent = {
      taskId: row.id,
      shift: shiftKey,
      process: row.process,
      completedBy: personaName,
      role: personaRole,
      completedAt: now.toISOString(),
      action: "manual_set_to_ok",
      reason: reason || "Manual operational sign-off by Shift Operator",
    };

    console.log("[audit → mongo manual_set_to_ok]", event);
    set((s) => ({ checklists, auditLog: [...s.auditLog, event] }));
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
      auditLog: [...s.auditLog, event],
      nodeBuilderOpen: false,
    }));
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
