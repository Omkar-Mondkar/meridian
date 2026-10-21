import { create } from 'zustand';
import { syncClient } from '../lib/syncClient';

export type PermissionKey =
  | 'dag:view'
  | 'dag:advance'
  | 'dag:override_ok'
  | 'dag:edit_topology'
  | 'ssh:run_probe'
  | 'ssh:manage_vault'
  | 'automation:manage'
  | 'audit:export'
  | 'admin:rbac_manage';

export interface GroupRecord {
  id: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
  isSystem?: boolean;
  createdAt: string;
}

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  roleTitle: string;
  groupIds: string[];
  isActive: boolean;
  createdAt: string;
}

export const FALLBACK_GROUPS: GroupRecord[] = [
  {
    id: 'grp_viewers',
    name: 'Viewers',
    description: 'Read-only access to DAG, shifts, and file manifests',
    permissions: ['dag:view'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'grp_l1_operators',
    name: 'L1 Operators',
    description: 'Frontline operations executing checklist task progression',
    permissions: ['dag:view', 'dag:advance'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'grp_l2_engineers',
    name: 'L2 Engineers',
    description: 'Senior engineers with manual OK override and SSH probe capabilities',
    permissions: ['dag:view', 'dag:advance', 'dag:override_ok', 'ssh:run_probe'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'grp_supervisors',
    name: 'Supervisors / VP',
    description: 'Process owners and topology managers with full DAG editing rights',
    permissions: ['dag:view', 'dag:advance', 'dag:override_ok', 'dag:edit_topology', 'ssh:run_probe', 'audit:export'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'grp_admins',
    name: 'System Admins',
    description: 'Full administrative access to vault, automation, and user/group management',
    permissions: [
      'dag:view',
      'dag:advance',
      'dag:override_ok',
      'dag:edit_topology',
      'ssh:run_probe',
      'ssh:manage_vault',
      'automation:manage',
      'audit:export',
      'admin:rbac_manage',
    ],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const FALLBACK_USERS: UserRecord[] = [
  {
    id: 'usr_omkar',
    username: 'omkar.mondkar',
    displayName: 'Omkar Mondkar',
    roleTitle: 'Morning Shift Lead (Supervisor)',
    groupIds: ['grp_supervisors'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_sarah',
    username: 'sarah.j',
    displayName: 'Sarah Jenkins',
    roleTitle: 'Operations Engineer (L2)',
    groupIds: ['grp_l2_engineers'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_alex',
    username: 'alex.t',
    displayName: 'Alex Thompson',
    roleTitle: 'Shift Operator (L1)',
    groupIds: ['grp_l1_operators'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_admin',
    username: 'admin',
    displayName: 'System Administrator',
    roleTitle: 'Platform Admin',
    groupIds: ['grp_admins'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_guest',
    username: 'guest',
    displayName: 'Guest Monitor',
    roleTitle: 'Observer (Viewer)',
    groupIds: ['grp_viewers'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

function calculatePermissions(user: UserRecord | undefined, groups: GroupRecord[]): Set<PermissionKey> {
  const perms = new Set<PermissionKey>();
  if (!user) return perms;
  const groupMap = new Map<string, GroupRecord>(groups.map((g) => [g.id, g]));
  for (const gid of user.groupIds) {
    const grp = groupMap.get(gid);
    if (grp) {
      for (const p of grp.permissions) {
        perms.add(p);
      }
    }
  }
  return perms;
}

interface AuthState {
  users: UserRecord[];
  groups: GroupRecord[];
  currentUserId: string;
  currentUser: UserRecord;
  effectivePermissions: Set<PermissionKey>;
  setCurrentUserId: (userId: string) => void;
  setUsersAndGroups: (users: UserRecord[], groups: GroupRecord[]) => void;
  hasPermission: (perm: PermissionKey) => boolean;
}

const initialUserId = 'usr_omkar';
const initialUser = FALLBACK_USERS.find((u) => u.id === initialUserId) || FALLBACK_USERS[0];
const initialPerms = calculatePermissions(initialUser, FALLBACK_GROUPS);

export const useAuthStore = create<AuthState>((set, get) => ({
  users: FALLBACK_USERS,
  groups: FALLBACK_GROUPS,
  currentUserId: initialUserId,
  currentUser: initialUser,
  effectivePermissions: initialPerms,

  setCurrentUserId: (userId: string) => {
    const { users, groups } = get();
    const user = users.find((u) => u.id === userId) || users[0];
    const perms = calculatePermissions(user, groups);
    syncClient.setOperatorId(user.id);
    set({
      currentUserId: user.id,
      currentUser: user,
      effectivePermissions: perms,
    });
  },

  setUsersAndGroups: (newUsers: UserRecord[], newGroups: GroupRecord[]) => {
    const currentId = get().currentUserId;
    const user = newUsers.find((u) => u.id === currentId) || newUsers[0] || get().currentUser;
    const perms = calculatePermissions(user, newGroups);
    set({
      users: newUsers,
      groups: newGroups,
      currentUser: user,
      effectivePermissions: perms,
    });
  },

  hasPermission: (perm: PermissionKey) => {
    const { effectivePermissions } = get();
    return effectivePermissions.has(perm) || effectivePermissions.has('admin:rbac_manage');
  },
}));

// Wire up WebSocket sync initialization for RBAC users and groups
syncClient.subscribe((event) => {
  if (event.type === 'SYNC_INIT' && event.data) {
    const { users, groups } = event.data;
    if (Array.isArray(users) && Array.isArray(groups) && users.length > 0 && groups.length > 0) {
      useAuthStore.getState().setUsersAndGroups(users, groups);
    }
  }
});
