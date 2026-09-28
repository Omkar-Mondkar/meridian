/**
 * syncClient — Resilient real-time WebSocket client for Meridian.
 * Auto-connects to the backend persistence service, synchronizes task
 * state and overrides across all open screens, and handles transparent
 * reconnect with backoff.
 */

export type SyncConnectionStatus = 'connected' | 'connecting' | 'disconnected';
export type SyncDbMode = 'mongodb' | 'fallback' | 'offline';

export interface RemoteTaskRecord {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  updatedAt: string;
  updatedBy?: string;
  reason?: string;
}

export interface RemoteAuditEvent {
  id: string;
  taskId: string;
  action: 'MANUAL_SET_TO_OK' | 'STATUS_CHANGE' | 'NODE_CREATE';
  operator: string;
  reason: string;
  timestamp: string;
}

export interface SyncInitPayload {
  tasks: Record<string, RemoteTaskRecord>;
  auditEvents: RemoteAuditEvent[];
  customNodes: any[];
  dbMode: 'mongodb' | 'fallback';
  clientCount: number;
}

type SyncListener = (event: {
  type: 'SYNC_INIT' | 'TASK_UPDATED' | 'TASK_OVERRIDDEN' | 'NODE_CREATED' | 'STATUS_CHANGE';
  data?: any;
}) => void;

class MeridianSyncClient {
  private ws: WebSocket | null = null;
  private status: SyncConnectionStatus = 'disconnected';
  private dbMode: SyncDbMode = 'offline';
  private listeners = new Set<SyncListener>();
  private reconnectTimer: any = null;
  private reconnectDelay = 1500;
  private maxReconnectDelay = 10000;
  private isExplicitlyClosed = false;

  constructor() {
    // Automatically initiate connection if in browser environment
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  private getWsUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    return `${protocol}//${host}:3001/ws`;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');
    const url = this.getWsUrl();

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log(`[SyncClient] Connected to Meridian backend at ${url}`);
        this.setStatus('connected');
        this.reconnectDelay = 1500; // Reset backoff
      };

      this.ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          this.handlePacket(packet);
        } catch (err) {
          console.warn('[SyncClient] Parse error for message:', err);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.dbMode = 'offline';
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[SyncClient] WebSocket error:', err);
        this.setStatus('disconnected');
      };
    } catch (err) {
      console.warn('[SyncClient] Connection attempt failed:', err);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isExplicitlyClosed) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectTimer = setTimeout(() => {
      console.log(`[SyncClient] Attempting reconnect (backoff: ${this.reconnectDelay}ms)...`);
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }

  private setStatus(status: SyncConnectionStatus) {
    this.status = status;
    this.notify({ type: 'STATUS_CHANGE', data: { status, dbMode: this.dbMode } });
  }

  private handlePacket(packet: any) {
    if (!packet || !packet.type) return;

    if (packet.type === 'SYNC_INIT') {
      this.dbMode = packet.dbMode || 'fallback';
      this.notify({ type: 'STATUS_CHANGE', data: { status: this.status, dbMode: this.dbMode } });
    }

    this.notify({ type: packet.type, data: packet });
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Send immediate status
    listener({ type: 'STATUS_CHANGE', data: { status: this.status, dbMode: this.dbMode } });
    return () => this.listeners.delete(listener);
  }

  private notify(event: { type: any; data?: any }) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[SyncClient] Listener callback failed:', err);
      }
    }
  }

  getStatus(): SyncConnectionStatus {
    return this.status;
  }

  getDbMode(): SyncDbMode {
    return this.dbMode;
  }

  // --- Outbound Actions ---

  sendTaskUpdate(taskId: string, status: 'pending' | 'in_progress' | 'completed' | 'blocked', updatedBy?: string, reason?: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'TASK_UPDATE',
          taskId,
          status,
          updatedBy,
          reason
        })
      );
    }
  }

  sendTaskOverride(taskId: string, operator: string, reason: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'TASK_OVERRIDE',
          taskId,
          operator,
          reason
        })
      );
    }
  }

  sendNodeCreate(node: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'NODE_CREATE',
          node
        })
      );
    }
  }
}

export const syncClient = new MeridianSyncClient();
