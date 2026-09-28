/**
 * Persona / RBAC data and permissions (Design Doc §9.2).
 * Linked directly to the Roster data (PERSONNEL and LEADERSHIP).
 */
import {
  PERSONNEL,
  LEADERSHIP,
  type ShiftKey,
} from "./roster";

export interface Persona {
  name: string;
  role: string;         // Official designation (e.g. "Assistant Manager", "Principal")
  rbacRole: string;     // RBAC category for permission gates ("Admin" | "Shift Lead" | "L2 Support" | "L1 Support")
  shift?: ShiftKey | "All";
  gender: "f" | "m";
  variant?: "standard" | "formal" | "executive";
}

/**
 * Maps a roster designation to an RBAC category.
 */
export function designationToRbacRole(designation: string, level?: string): string {
  const lower = designation.toLowerCase();
  if (level === "principal" || lower.includes("principal") || lower.includes("admin")) {
    return "Admin";
  }
  if (level === "team_leader" || lower.includes("vice principle") || lower.includes("vice president") || lower.includes("lead")) {
    return "Shift Lead";
  }
  if (lower.includes("manager") || lower.includes("senior")) {
    return "L2 Support";
  }
  return "L1 Support";
}

/**
 * Returns the list of personas available for the given shift:
 * 1. Leadership (Principal, Vice Principle / Team Leader) — Available across all shifts
 * 2. Shift Team Members — Sourced directly from that shift's roster
 */
export function getPersonasForShift(shiftKey: ShiftKey): {
  leadership: Persona[];
  shiftMembers: Persona[];
  all: Persona[];
} {
  const leadership: Persona[] = LEADERSHIP.map((l) => ({
    name: l.name,
    role: l.title || l.role,
    rbacRole: designationToRbacRole(l.role, l.level),
    shift: "All",
    gender: l.gender,
    variant: l.level === "principal" ? "executive" : "formal",
  }));

  const shiftMembers: Persona[] = (PERSONNEL[shiftKey]?.people || []).map((p) => ({
    name: p.name,
    role: p.role,
    rbacRole: designationToRbacRole(p.role),
    shift: shiftKey,
    gender: p.gender,
    variant: "standard",
  }));

  return {
    leadership,
    shiftMembers,
    all: [...leadership, ...shiftMembers],
  };
}

/**
 * Returns personas for the Tasks tab.
 * Ravikant Himmatramka (Principal) is excluded from BAU shift tasks.
 */
export function getPersonasForTasks(shiftKey: ShiftKey): {
  leadership: Persona[];
  shiftMembers: Persona[];
  all: Persona[];
} {
  const full = getPersonasForShift(shiftKey);
  const leadership = full.leadership.filter(
    (p) => !p.name.toLowerCase().includes("ravikant") && p.variant !== "executive"
  );
  return {
    leadership,
    shiftMembers: full.shiftMembers,
    all: [...leadership, ...full.shiftMembers],
  };
}

/** Default initial persona from Morning shift (Overall) */
export const DEFAULT_PERSONA: Persona = getPersonasForShift("Morning").all[0];

/** Default initial persona for Tasks tab (Sandeep Sawant / Team Leader) */
export const DEFAULT_TASK_PERSONA: Persona = getPersonasForTasks("Morning").all[0];

export const ROLES = ["L1 Support", "L2 Support", "Shift Lead", "Admin"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_HIERARCHY: Record<string, number> = {
  Admin: 4,
  "Shift Lead": 3,
  "L2 Support": 2,
  "L1 Support": 1,
};

/**
 * Returns true if the given persona can act on a task with the given assigned role.
 * Enforces hierarchical RBAC: Admin > Shift Lead > L2 Support > L1 Support.
 */
export function canAct(
  personaRbacRole: string,
  taskRequiredRole: string,
  status: string,
): boolean {
  if (status === "completed") return false;

  const personaLevel =
    ROLE_HIERARCHY[personaRbacRole] ||
    (personaRbacRole.includes("Admin")
      ? 4
      : personaRbacRole.includes("Lead")
        ? 3
        : 1);

  const taskLevel =
    ROLE_HIERARCHY[taskRequiredRole] ||
    (taskRequiredRole.includes("Admin")
      ? 4
      : taskRequiredRole.includes("Lead")
        ? 3
        : taskRequiredRole.includes("L2")
          ? 2
          : 1);

  // A persona can act on tasks equal to or below their permission level
  return personaLevel >= taskLevel;
}
