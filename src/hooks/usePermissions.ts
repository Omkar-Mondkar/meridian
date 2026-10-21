import { useMemo } from 'react';
import { useAuthStore, PermissionKey, UserRecord, GroupRecord } from '../stores/useAuthStore';

export interface PermissionsHookResult {
  currentUser: UserRecord;
  currentUserId: string;
  currentGroups: GroupRecord[];
  allUsers: UserRecord[];
  allGroups: GroupRecord[];
  hasPermission: (perm: PermissionKey) => boolean;
  canViewDag: boolean;
  canAdvanceTask: boolean;
  canOverrideOk: boolean;
  canEditDag: boolean;
  canRunProbe: boolean;
  canManageVault: boolean;
  canManageAutomation: boolean;
  canExportAudit: boolean;
  isAdmin: boolean;
  setCurrentUser: (userId: string) => void;
}

export function usePermissions(): PermissionsHookResult {
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const users = useAuthStore((s) => s.users);
  const groups = useAuthStore((s) => s.groups);
  const effectivePermissions = useAuthStore((s) => s.effectivePermissions);
  const setCurrentUserId = useAuthStore((s) => s.setCurrentUserId);

  const hasPermission = useMemo(() => {
    return (perm: PermissionKey): boolean => {
      return (
        effectivePermissions.has(perm) ||
        effectivePermissions.has('admin:rbac_manage')
      );
    };
  }, [effectivePermissions]);

  const currentGroups = useMemo(() => {
    if (!currentUser) return [];
    return groups.filter((g) => currentUser.groupIds.includes(g.id));
  }, [currentUser, groups]);

  return {
    currentUser,
    currentUserId,
    currentGroups,
    allUsers: users,
    allGroups: groups,
    hasPermission,
    canViewDag: hasPermission('dag:view'),
    canAdvanceTask: hasPermission('dag:advance'),
    canOverrideOk: hasPermission('dag:override_ok'),
    canEditDag: hasPermission('dag:edit_topology'),
    canRunProbe: hasPermission('ssh:run_probe'),
    canManageVault: hasPermission('ssh:manage_vault'),
    canManageAutomation: hasPermission('automation:manage'),
    canExportAudit: hasPermission('audit:export'),
    isAdmin: hasPermission('admin:rbac_manage'),
    setCurrentUser: setCurrentUserId,
  };
}
