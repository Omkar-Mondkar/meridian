import { MongoClient, Db } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';

export interface TaskStateRecord {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  updatedAt: string;
  updatedBy?: string;
  reason?: string;
}

export interface TaskAuditEvent {
  id: string;
  taskId: string;
  action: 'MANUAL_SET_TO_OK' | 'STATUS_CHANGE' | 'NODE_CREATE';
  operator: string;
  reason: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface CustomNodeRecord {
  id: string;
  time: string;
  title: string;
  process: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  role: 'L1' | 'L2' | 'VP';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  dependsOn?: string[];
  pipeline?: string;
  verification?: {
    serverIp?: string;
    logPath?: string;
    grepPattern?: string;
  };
  createdAt: string;
}

interface LocalStateFile {
  tasks: Record<string, TaskStateRecord>;
  auditEvents: TaskAuditEvent[];
  customNodes: CustomNodeRecord[];
}

export class MeridianDatabase {
  private mongoClient: MongoClient | null = null;
  private db: Db | null = null;
  private mode: 'mongodb' | 'fallback' = 'fallback';
  private fallbackFilePath: string;
  private memoryCache: LocalStateFile = {
    tasks: {},
    auditEvents: [],
    customNodes: []
  };

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.warn('[DB] Could not create data/ directory:', err);
      }
    }
    this.fallbackFilePath = path.join(dataDir, 'meridian_state.json');
    this.loadFallbackFromDisk();
  }

  private loadFallbackFromDisk() {
    try {
      if (fs.existsSync(this.fallbackFilePath)) {
        const raw = fs.readFileSync(this.fallbackFilePath, 'utf-8');
        this.memoryCache = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[DB] Failed reading fallback state file, initializing fresh memory state:', err);
    }
  }

  private persistFallbackToDisk() {
    try {
      fs.writeFileSync(this.fallbackFilePath, JSON.stringify(this.memoryCache, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to persist fallback state to disk:', err);
    }
  }

  async connect(uri?: string): Promise<{ mode: 'mongodb' | 'fallback'; uri?: string }> {
    const targetUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meridian';
    try {
      console.log(`[DB] Attempting connection to MongoDB at: ${targetUri}`);
      const client = new MongoClient(targetUri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000
      });
      await client.connect();
      // Test ping
      await client.db('meridian').command({ ping: 1 });
      this.mongoClient = client;
      this.db = client.db('meridian');
      this.mode = 'mongodb';
      console.log(`[DB] SUCCESS: Connected to MongoDB at ${targetUri}`);

      // Sync existing collections into memory or migrate any existing fallback records
      await this.syncFromMongo();
      return { mode: 'mongodb', uri: targetUri };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[DB] MongoDB unavailable (${errMsg}). Using resilient local JSON fallback: ${this.fallbackFilePath}`);
      this.mode = 'fallback';
      return { mode: 'fallback' };
    }
  }

  private async syncFromMongo() {
    if (!this.db) return;
    try {
      const tasksCol = this.db.collection<TaskStateRecord>('tasks');
      const eventsCol = this.db.collection<TaskAuditEvent>('task_events');
      const nodesCol = this.db.collection<CustomNodeRecord>('custom_nodes');

      const tasks = await tasksCol.find({}).toArray();
      for (const t of tasks) {
        this.memoryCache.tasks[t.id] = t;
      }

      this.memoryCache.auditEvents = await eventsCol.find({}).sort({ timestamp: -1 }).limit(200).toArray();
      this.memoryCache.customNodes = await nodesCol.find({}).toArray();
    } catch (err) {
      console.warn('[DB] Error during initial MongoDB sync:', err);
    }
  }

  getMode(): 'mongodb' | 'fallback' {
    return this.mode;
  }

  async getTasks(): Promise<Record<string, TaskStateRecord>> {
    if (this.mode === 'mongodb' && this.db) {
      try {
        const tasks = await this.db.collection<TaskStateRecord>('tasks').find({}).toArray();
        const map: Record<string, TaskStateRecord> = {};
        for (const t of tasks) map[t.id] = t;
        return map;
      } catch (err) {
        console.warn('[DB] Mongo getTasks failed, returning cached:', err);
      }
    }
    return { ...this.memoryCache.tasks };
  }

  async saveTask(record: TaskStateRecord): Promise<void> {
    this.memoryCache.tasks[record.id] = record;
    this.persistFallbackToDisk();

    if (this.mode === 'mongodb' && this.db) {
      try {
        await this.db.collection('tasks').updateOne(
          { id: record.id },
          { $set: record },
          { upsert: true }
        );
      } catch (err) {
        console.error('[DB] Mongo saveTask failed, saved in fallback:', err);
      }
    }
  }

  async getAuditLogs(): Promise<TaskAuditEvent[]> {
    if (this.mode === 'mongodb' && this.db) {
      try {
        return await this.db
          .collection<TaskAuditEvent>('task_events')
          .find({})
          .sort({ timestamp: -1 })
          .limit(100)
          .toArray();
      } catch (err) {
        console.warn('[DB] Mongo getAuditLogs failed, returning cached:', err);
      }
    }
    return [...this.memoryCache.auditEvents];
  }

  async appendAuditLog(event: TaskAuditEvent): Promise<void> {
    this.memoryCache.auditEvents.unshift(event);
    if (this.memoryCache.auditEvents.length > 200) {
      this.memoryCache.auditEvents.pop();
    }
    this.persistFallbackToDisk();

    if (this.mode === 'mongodb' && this.db) {
      try {
        await this.db.collection('task_events').insertOne(event as any);
      } catch (err) {
        console.error('[DB] Mongo appendAuditLog failed, saved in fallback:', err);
      }
    }
  }

  async getCustomNodes(): Promise<CustomNodeRecord[]> {
    if (this.mode === 'mongodb' && this.db) {
      try {
        return await this.db.collection<CustomNodeRecord>('custom_nodes').find({}).toArray();
      } catch (err) {
        console.warn('[DB] Mongo getCustomNodes failed, returning cached:', err);
      }
    }
    return [...this.memoryCache.customNodes];
  }

  async saveCustomNode(node: CustomNodeRecord): Promise<void> {
    const existingIdx = this.memoryCache.customNodes.findIndex((n) => n.id === node.id);
    if (existingIdx >= 0) {
      this.memoryCache.customNodes[existingIdx] = node;
    } else {
      this.memoryCache.customNodes.push(node);
    }
    this.persistFallbackToDisk();

    if (this.mode === 'mongodb' && this.db) {
      try {
        await this.db.collection('custom_nodes').updateOne(
          { id: node.id },
          { $set: node },
          { upsert: true }
        );
      } catch (err) {
        console.error('[DB] Mongo saveCustomNode failed, saved in fallback:', err);
      }
    }
  }
}

export const dbInstance = new MeridianDatabase();
