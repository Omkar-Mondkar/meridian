import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'node:http';
import { dbInstance, TaskStateRecord, TaskAuditEvent, CustomNodeRecord } from './db.js';

export type WsClientAction =
  | { type: 'CLIENT_HELLO'; clientId?: string }
  | { type: 'TASK_UPDATE'; taskId: string; status: 'pending' | 'in_progress' | 'completed' | 'blocked'; updatedBy?: string; reason?: string }
  | { type: 'TASK_OVERRIDE'; taskId: string; operator: string; reason: string }
  | { type: 'NODE_CREATE'; node: CustomNodeRecord };

export type WsServerEvent =
  | {
      type: 'SYNC_INIT';
      tasks: Record<string, TaskStateRecord>;
      auditEvents: TaskAuditEvent[];
      customNodes: CustomNodeRecord[];
      dbMode: 'mongodb' | 'fallback';
      clientCount: number;
    }
  | { type: 'TASK_UPDATED'; record: TaskStateRecord }
  | { type: 'TASK_OVERRIDDEN'; event: TaskAuditEvent; record: TaskStateRecord }
  | { type: 'NODE_CREATED'; node: CustomNodeRecord }
  | { type: 'PONG'; timestamp: string };

export class MeridianSocketHub {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();

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
        console.log(`[WS] Client disconnected (Active: ${this.clients.size})`);
      });

      ws.on('error', (err) => {
        console.error('[WS] Client socket error:', err);
        this.clients.delete(ws);
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

    const payload: WsServerEvent = {
      type: 'SYNC_INIT',
      tasks,
      auditEvents,
      customNodes,
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
    switch (action.type) {
      case 'CLIENT_HELLO':
        await this.sendSyncInit(sender);
        break;

      case 'TASK_UPDATE': {
        const record: TaskStateRecord = {
          id: action.taskId,
          status: action.status,
          updatedAt: new Date().toISOString(),
          updatedBy: action.updatedBy,
          reason: action.reason
        };
        await dbInstance.saveTask(record);

        // Also record an audit event if completed or in_progress
        const auditEvent: TaskAuditEvent = {
          id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          taskId: action.taskId,
          action: 'STATUS_CHANGE',
          operator: action.updatedBy || 'Operator',
          reason: action.reason || `Status updated to ${action.status}`,
          timestamp: new Date().toISOString()
        };
        await dbInstance.appendAuditLog(auditEvent);

        // Broadcast to everyone
        this.broadcast({ type: 'TASK_UPDATED', record });
        break;
      }

      case 'TASK_OVERRIDE': {
        const timestamp = new Date().toISOString();
        const record: TaskStateRecord = {
          id: action.taskId,
          status: 'completed',
          updatedAt: timestamp,
          updatedBy: action.operator,
          reason: action.reason
        };
        await dbInstance.saveTask(record);

        const event: TaskAuditEvent = {
          id: `override-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          taskId: action.taskId,
          action: 'MANUAL_SET_TO_OK',
          operator: action.operator,
          reason: action.reason,
          timestamp
        };
        await dbInstance.appendAuditLog(event);

        // Broadcast to everyone
        this.broadcast({ type: 'TASK_OVERRIDDEN', event, record });
        break;
      }

      case 'NODE_CREATE': {
        await dbInstance.saveCustomNode(action.node);

        const event: TaskAuditEvent = {
          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          taskId: action.node.id,
          action: 'NODE_CREATE',
          operator: 'Operator',
          reason: `Added custom node: ${action.node.title}`,
          timestamp: new Date().toISOString()
        };
        await dbInstance.appendAuditLog(event);

        // Broadcast to everyone
        this.broadcast({ type: 'NODE_CREATED', node: action.node });
        break;
      }
    }
  }
}

export const socketHub = new MeridianSocketHub();
