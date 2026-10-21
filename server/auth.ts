import http from 'node:http';
import { dbInstance, PermissionKey, UserRecord } from './db.js';

export function getOperatorIdFromRequest(req: http.IncomingMessage): string {
  const headerVal = req.headers['x-operator-id'];
  if (headerVal && typeof headerVal === 'string' && headerVal.trim()) {
    return headerVal.trim();
  }
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const queryVal = url.searchParams.get('operatorId');
  if (queryVal && queryVal.trim()) {
    return queryVal.trim();
  }
  // Default fallback user is the morning shift lead
  return 'usr_omkar';
}

export async function resolveOperator(req: http.IncomingMessage): Promise<{
  user: UserRecord | null;
  permissions: PermissionKey[];
}> {
  const operatorId = getOperatorIdFromRequest(req);
  const user = await dbInstance.getUserById(operatorId);
  const permissions = await dbInstance.getUserPermissions(operatorId);
  return { user, permissions };
}

export async function authorizeRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requiredPermission: PermissionKey
): Promise<{ allowed: boolean; user: UserRecord | null; permissions: PermissionKey[] }> {
  const { user, permissions } = await resolveOperator(req);

  const isAllowed =
    permissions.includes(requiredPermission) ||
    permissions.includes('admin:rbac_manage');

  if (!isAllowed) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: `Forbidden: Missing required permission '${requiredPermission}'`,
        requiredPermission,
        activeUser: user ? user.displayName : 'Unknown',
        activeRole: user ? user.roleTitle : 'Guest',
      })
    );
    return { allowed: false, user, permissions };
  }

  return { allowed: true, user, permissions };
}
