import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'node:http';
import {
  dbInstance,
  TaskStateRecord,
  TaskAuditEvent,
  CustomNodeRecord,
  EdgeOverrideRecord,
  UserRecord,
  GroupRecord,
  PermissionKey
} from './db.js';

export type WsClientAction =
  | { type: 'CLIENT_HELLO'; clientId?: string; operatorId?: string }
  | { type: 'TASK_UPDATE'; taskId: string; status: 'pending' | 'in_progress' | 'completed' | 'blocked'; updatedBy?: string; reason?: string; operatorId?: string }
  | { type: 'TASK_OVERRIDE'; taskId: string; operator: string; reason: string; operatorId?: string }
  | { type: 'NODE_CREATE'; node: CustomNodeRecord; operatorId?: string }
  | { type: 'EDGE_UPDATE'; shiftKey: string; sourceId: string; targetId: string; action: 'add' | 'remove'; operatorId?: string };

export type WsServerEvent =
  | {
      type: 'SYNC_INIT';
      tasks: Record<string, TaskStateRecord>;
      auditEvents: TaskAuditEvent[];
      customNodes: CustomNodeRecord[];
      edgeOverrides: EdgeOverrideRecord[];
      users: UserRecord[];
      groups: GroupRecord[];
      dbMode: 'mongodb' | 'fallback';
      clientCount: number;
    }
  | { type: 'TASK_UPDATED'; record: TaskStateRecord }
  | { type: 'TASK_OVERRIDDEN'; event: TaskAuditEvent; record: TaskStateRecord }
  | { type: 'TASK_COMPLETED_BY_POLLER'; taskId: string; event: TaskAuditEvent; record: TaskStateRecord; matchDetail?: string }
  | { type: 'TASK_METRICS_UPDATED'; taskId: string; metrics: any }
  | { type: 'POLLER_STATUS'; status: any }
  | { type: 'SSH_SETTINGS_UPDATED'; settings: any }
  | { type: 'AUTOMATION_RULE_UPDATED'; taskId: string; rule: any }
  | { type: 'NODE_CREATED'; node: CustomNodeRecord }
  | { type: 'EDGE_UPDATED'; shiftKey: string; sourceId: string; targetId: string; action: 'add' | 'remove' }
  | { type: 'AUTH_ERROR'; message: string; requiredPermission: PermissionKey }
  | { type: 'PONG'; timestamp: string };

export class MeridianSocketHub {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private clientOperators = new Map<WebSocket, string>();

  init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', async (ws: WebSocket, req) => {
      this.clients.add(ws);
      const ip = req.socket.remoteAddress || 'unknown';
      console.log(`[WS] Client connected from ${ip} (Active: ${this.clients.size})`);

      // Immediately send current sync state to the new client
      await this.sendSyncInit(ws);

      ws.on('message', async (data) => {
        try {
          const action = JSON.parse(data.toString()) as WsClientAction;
          await this.handleClientAction(action, ws);
        } catch (err) {
          console.error('[WS] Failed to parse client message:', err);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        this.clientOperators.delete(ws);
        console.log(`[WS] Client disconnected (Active: ${this.clients.size})`);
      });

      ws.on('error', (err) => {
        console.error('[WS] Client socket error:', err);
        this.clients.delete(ws);
        this.clientOperators.delete(ws);
      });
    });

    // Heartbeat ping interval
    setInterval(() => {
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        }
      }
    }, 25000);
  }

  getClientCount(): number {
    return this.clients.size;
  }

  async sendSyncInit(ws: WebSocket) {
    if (ws.readyState !== WebSocket.OPEN) return;
    const tasks = await dbInstance.getTasks();
    const auditEvents = await dbInstance.getAuditLogs();
    const customNodes = await dbInstance.getCustomNodes();
    const edgeOverrides = await dbInstance.getEdgeOverrides();
    const users = await dbInstance.getUsers();
    const groups = await dbInstance.getGroups();

    const payload: WsServerEvent = {
      type: 'SYNC_INIT',
      tasks,
      auditEvents,
      customNodes,
      edgeOverrides,
      users,
      groups,
      dbMode: dbInstance.getMode(),
      clientCount: this.clients.size
    };
    ws.send(JSON.stringify(payload));
  }

  broadcast(event: WsServerEvent, skipWs?: WebSocket) {
    const serialized = JSON.stringify(event);
    for (const client of this.clients) {
      if (client !== skipWs && client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }

  private async handleClientAction(action: WsClientAction, sender: WebSocket) {
    const operatorId = action.operatorId || this.clientOperators.get(sender) || 'usr_omkar';
    const permissions = await dbInstance.getUserPermissions(operatorId);
    const user = await dbInstance.getUserById(operatorId);

    const checkPerm = (perm: PermissionKey): boolean => {
      if (!permissions.includes(perm) && !permissions.includes('admin:rbac_manage')) {
        sender.send(
          JSON.stringify({
            type: 'AUTH_ERROR',
            message: `Action rejected: missing '${perm}' permission`,
            requiredPermission: perm
          })
        );
        return false;
      }
      return true;
    };

    switch (action.type) {
      case 'CLIENT_HELLO':
        if (action.operatorId) {
          this.clientOperators.set(sender, action.operatorId);
        }
        await this.sendSyncInit(sender);
        break;

      case 'TASK_UPDATE': {
        if (!checkPerm('dag:advance')) return;

        const effectiveOperator = user ? user.displayName : (action.updatedBy || 'Operator');
        const record: TaskStateRecord = {
          id: action.taskId,
          status: action.status,
          updatedAt: new Date().toISOString(),
          updatedBy: effectiveOperator,
          reason: action.reason
        };
        await dbInstance.saveTask(record);

        const auditEvent: TaskAuditEvent = {
          id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          taskId: action.taskId,
          action: 'STATUS_CHANGE',
          operator: effectiveOperator,
          reason: action.reason || `Status updated to ${action.status}`,
          timestamp: new Date().toISOString(),
          details: { operatorId, role: user?.roleTitle }
        };
        await dbInstance.appendAuditLog(auditEvent);

        this.broadcast({ type: 'TASK_UPDATED', record });
        break;
      }

      case 'TASK_OVERRIDE': {
        if (!checkPerm('dag:override_ok')) return;

        const effectiveOperator = user ? user.displayName : (action.operator || 'Operator');
        const timestamp = new Date().toISOString();
        const record: TaskStateRecord = {
          id: action.taskId,
          status: 'completed',
          updatedAt: timestamp,
          updatedBy: effectiveOperator,
          reason: action.reason
        };
        await dbInstance.saveTask(record);

        const event: TaskAuditEvent = {
          id: `override-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          taskId: action.taskId,
          action: 'MANUAL_SET_TO_OK',
          operator: effectiveOperator,
          reason: action.reason,
          timestamp,
          details: { operatorId, role: user?.roleTitle }
        };
        await dbInstance.appendAuditLog(event);

        this.broadcast({ type: 'TASK_OVERRIDDEN', event, record });
        break;
      }

      case 'NODE_CREATE': {
        if (!checkPerm('dag:edit_topology')) return;

        const effectiveOperator = user ? user.displayName : 'Operator';
        await dbInstance.saveCustomNode(action.node);

        const event: TaskAuditEvent = {
          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          taskId: action.node.id,
          action: 'NODE_CREATE',
          operator: effectiveOperator,
          reason: `Added custom node: ${action.node.title}`,
          timestamp: new Date().toISOString(),
          details: { operatorId, role: user?.roleTitle }
        };
        await dbInstance.appendAuditLog(event);

        this.broadcast({ type: 'NODE_CREATED', node: action.node });
        break;
      }

      case 'EDGE_UPDATE': {
        if (!checkPerm('dag:edit_topology')) return;

        const override: EdgeOverrideRecord = {
          shiftKey: action.shiftKey,
          sourceId: action.sourceId,
          targetId: action.targetId,
          action: action.action,
          updatedAt: new Date().toISOString()
        };
        if (action.action === 'add') {
          await dbInstance.saveEdgeOverride(override);
        } else {
          await dbInstance.removeEdgeOverride(action.shiftKey, action.sourceId, action.targetId);
        }

        const effectiveOperator = user ? user.displayName : 'Operator';
        const auditEvent: TaskAuditEvent = {
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          taskId: action.targetId,
          action: 'STATUS_CHANGE',
          operator: effectiveOperator,
          reason: `DAG edge ${action.action === 'add' ? 'added' : 'removed'}: ${action.sourceId} -> ${action.targetId}`,
          timestamp: new Date().toISOString(),
          details: { operatorId, role: user?.roleTitle }
        };
        await dbInstance.appendAuditLog(auditEvent);

        this.broadcast({
          type: 'EDGE_UPDATED',
          shiftKey: action.shiftKey,
          sourceId: action.sourceId,
          targetId: action.targetId,
          action: action.action
        });
        break;
      }
    }
  }
}

export const socketHub = new MeridianSocketHub();
