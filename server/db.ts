import { MongoClient, Db } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { encrypt, decrypt, EncryptedPayload } from './crypto.js';
import type { SshConfig } from './ssh.js';

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
  action: 'MANUAL_SET_TO_OK' | 'STATUS_CHANGE' | 'NODE_CREATE' | 'AUTOMATION_CONFIG_UPDATED' | 'AUTO_POLLED';
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

export interface SshCredentialRecord {
  settingKey: 'ssh_central_host';
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'privateKey';
  encryptedPassword?: import('./crypto.js').EncryptedPayload;
  encryptedPrivateKey?: import('./crypto.js').EncryptedPayload;
  encryptedPassphrase?: import('./crypto.js').EncryptedPayload;
  updatedAt: string;
  updatedBy?: string;
}

export interface PublicSshSettings {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'privateKey';
  hasPassword: boolean;
  hasPrivateKey: boolean;
  hasPassphrase: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export interface TaskAutomationRule {
  taskId: string;
  enabled: boolean;
  scriptPath: string;
  args?: string[];
  expectedExitCode: number;
  matchMode: 'exit_code_only' | 'stdout_regex' | 'stdout_contains' | 'stdout_json_metric';
  matchPattern?: string;
  jsonMetricKey?: string;
  jsonMetricExpected?: string | number;
  pollIntervalSec: number;
  lastRunAt?: string;
  lastStatus?: 'success' | 'failure' | 'timeout' | 'error';
  lastExitCode?: number;
  lastOutput?: string;
  lastError?: string;
  updatedAt: string;
}

export interface EdgeOverrideRecord {
  shiftKey: string;
  sourceId: string;
  targetId: string;
  action: 'add' | 'remove';
  updatedAt: string;
}

interface LocalStateFile {
  tasks: Record<string, TaskStateRecord>;
  auditEvents: TaskAuditEvent[];
  customNodes: CustomNodeRecord[];
  systemSettings: Record<string, any>;
  automationRules: Record<string, TaskAutomationRule>;
  edgeOverrides: EdgeOverrideRecord[];
}

export class MeridianDatabase {
  private mongoClient: MongoClient | null = null;
  private db: Db | null = null;
  private mode: 'mongodb' | 'fallback' = 'fallback';
  private fallbackFilePath: string;
  private memoryCache: LocalStateFile = {
    tasks: {},
    auditEvents: [],
    customNodes: [],
    systemSettings: {},
    automationRules: {},
    edgeOverrides: []
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
        const parsed = JSON.parse(raw);
        this.memoryCache = {
          tasks: parsed.tasks || {},
          auditEvents: parsed.auditEvents || [],
          customNodes: parsed.customNodes || [],
          systemSettings: parsed.systemSettings || {},
          automationRules: parsed.automationRules || {},
          edgeOverrides: parsed.edgeOverrides || []
        };
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
      const settingsCol = this.db.collection('system_settings');
      const rulesCol = this.db.collection<TaskAutomationRule>('automation_rules');
      const edgesCol = this.db.collection<EdgeOverrideRecord>('edge_overrides');

      const tasks = await tasksCol.find({}).toArray();
      for (const t of tasks) {
        this.memoryCache.tasks[t.id] = t;
      }

      this.memoryCache.auditEvents = await eventsCol.find({}).sort({ timestamp: -1 }).limit(200).toArray();
      this.memoryCache.customNodes = await nodesCol.find({}).toArray();

      const settings = await settingsCol.find({}).toArray();
      for (const s of settings) {
        if ((s as any).settingKey) {
          this.memoryCache.systemSettings[(s as any).settingKey] = s;
        }
      }

      const rules = await rulesCol.find({}).toArray();
      for (const r of rules) {
        this.memoryCache.automationRules[r.taskId] = r;
      }

      this.memoryCache.edgeOverrides = await edgesCol.find({}).toArray();
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

  async getPublicSshSettings(): Promise<PublicSshSettings> {
    let record: SshCredentialRecord | null = null;
    if (this.mode === 'mongodb' && this.db) {
      try {
        record = await this.db.collection<SshCredentialRecord>('system_settings').findOne({ settingKey: 'ssh_central_host' });
      } catch (err) {
        console.warn('[DB] Mongo getPublicSshSettings failed, using cache:', err);
      }
    }
    if (!record) {
      record = (this.memoryCache.systemSettings['ssh_central_host'] as SshCredentialRecord) || null;
    }

    return {
      host: record?.host || '',
      port: record?.port || 22,
      username: record?.username || '',
      authType: record?.authType || 'password',
      hasPassword: Boolean(record?.encryptedPassword),
      hasPrivateKey: Boolean(record?.encryptedPrivateKey),
      hasPassphrase: Boolean(record?.encryptedPassphrase),
      updatedAt: record?.updatedAt || '',
      updatedBy: record?.updatedBy || ''
    };
  }

  async getDecryptedSshConfig(): Promise<SshConfig | null> {
    let record: SshCredentialRecord | null = null;
    if (this.mode === 'mongodb' && this.db) {
      try {
        record = await this.db.collection<SshCredentialRecord>('system_settings').findOne({ settingKey: 'ssh_central_host' });
      } catch (err) {
        console.warn('[DB] Mongo getDecryptedSshConfig failed, using cache:', err);
      }
    }
    if (!record) {
      record = (this.memoryCache.systemSettings['ssh_central_host'] as SshCredentialRecord) || null;
    }
    if (!record || !record.host || !record.username) {
      return null;
    }

    let password: string | undefined;
    let privateKey: string | undefined;
    let passphrase: string | undefined;

    try {
      if (record.encryptedPassword) {
        password = decrypt(record.encryptedPassword);
      }
      if (record.encryptedPrivateKey) {
        privateKey = decrypt(record.encryptedPrivateKey);
      }
      if (record.encryptedPassphrase) {
        passphrase = decrypt(record.encryptedPassphrase);
      }
    } catch (err) {
      console.error('[DB] Failed to decrypt SSH secrets with current vault key:', err);
      return null;
    }

    return {
      host: record.host,
      port: record.port || 22,
      username: record.username,
      authType: record.authType || 'password',
      password,
      privateKey,
      passphrase
    };
  }

  async saveSshCredentials(input: {
    host: string;
    port: number;
    username: string;
    authType: 'password' | 'privateKey';
    password?: string;
    privateKey?: string;
    passphrase?: string;
    updatedBy?: string;
  }): Promise<void> {
    const existing = (this.memoryCache.systemSettings['ssh_central_host'] as SshCredentialRecord) || null;
    const now = new Date().toISOString();

    const record: SshCredentialRecord = {
      settingKey: 'ssh_central_host',
      host: input.host.trim(),
      port: Number(input.port) || 22,
      username: input.username.trim(),
      authType: input.authType,
      updatedAt: now,
      updatedBy: input.updatedBy || 'Operator'
    };

    if (input.password !== undefined && input.password !== '') {
      record.encryptedPassword = encrypt(input.password);
    } else if (existing?.encryptedPassword) {
      record.encryptedPassword = existing.encryptedPassword;
    }

    if (input.privateKey !== undefined && input.privateKey !== '') {
      record.encryptedPrivateKey = encrypt(input.privateKey);
    } else if (existing?.encryptedPrivateKey) {
      record.encryptedPrivateKey = existing.encryptedPrivateKey;
    }

    if (input.passphrase !== undefined && input.passphrase !== '') {
      record.encryptedPassphrase = encrypt(input.passphrase);
    } else if (existing?.encryptedPassphrase) {
      record.encryptedPassphrase = existing.encryptedPassphrase;
    }

    this.memoryCache.systemSettings['ssh_central_host'] = record;
    this.persistFallbackToDisk();

    if (this.mode === 'mongodb' && this.db) {
      try {
        await this.db.collection('system_settings').updateOne(
          { settingKey: 'ssh_central_host' },
          { $set: record },
          { upsert: true }
        );
      } catch (err) {
        console.error('[DB] Mongo saveSshCredentials failed, saved in fallback:', err);
      }
    }
  }

  async getAutomationRule(taskId: string): Promise<TaskAutomationRule | null> {
    if (this.mode === 'mongodb' && this.db) {
      try {
        const found = await this.db.collection<TaskAutomationRule>('automation_rules').findOne({ taskId });
        if (found) return found;
      } catch (err) {
        console.warn('[DB] Mongo getAutomationRule failed, using cache:', err);
      }
    }
    return this.memoryCache.automationRules[taskId] || null;
  }

  async getAllAutomationRules(): Promise<TaskAutomationRule[]> {
    if (this.mode === 'mongodb' && this.db) {
      try {
        return await this.db.collection<TaskAutomationRule>('automation_rules').find({}).toArray();
      } catch (err) {
        console.warn('[DB] Mongo getAllAutomationRules failed, using cache:', err);
      }
    }
    return Object.values(this.memoryCache.automationRules);
  }

  async saveAutomationRule(rule: TaskAutomationRule): Promise<void> {
    rule.updatedAt = new Date().toISOString();
    this.memoryCache.automationRules[rule.taskId] = rule;
    this.persistFallbackToDisk();

    if (this.mode === 'mongodb' && this.db) {
      try {
        await this.db.collection('automation_rules').updateOne(
          { taskId: rule.taskId },
          { $set: rule },
          { upsert: true }
        );
      } catch (err) {
        console.error('[DB] Mongo saveAutomationRule failed, saved in fallback:', err);
      }
    }
  }

  async getEdgeOverrides(shiftKey?: string): Promise<EdgeOverrideRecord[]> {
    if (this.mode === 'mongodb' && this.db) {
      try {
        const query = shiftKey ? { shiftKey } : {};
        return await this.db.collection<EdgeOverrideRecord>('edge_overrides').find(query).toArray();
      } catch (err) {
        console.warn('[DB] Mongo getEdgeOverrides failed, using cache:', err);
      }
    }
    if (shiftKey) {
      return this.memoryCache.edgeOverrides.filter((e) => e.shiftKey === shiftKey);
    }
    return [...this.memoryCache.edgeOverrides];
  }

  async saveEdgeOverride(override: EdgeOverrideRecord): Promise<void> {
    override.updatedAt = new Date().toISOString();
    // Remove conflicting override if exists
    this.memoryCache.edgeOverrides = this.memoryCache.edgeOverrides.filter(
      (e) => !(e.shiftKey === override.shiftKey && e.sourceId === override.sourceId && e.targetId === override.targetId)
    );
    this.memoryCache.edgeOverrides.push(override);
    this.persistFallbackToDisk();

    if (this.mode === 'mongodb' && this.db) {
      try {
        await this.db.collection('edge_overrides').updateOne(
          { shiftKey: override.shiftKey, sourceId: override.sourceId, targetId: override.targetId },
          { $set: override },
          { upsert: true }
        );
      } catch (err) {
        console.error('[DB] Mongo saveEdgeOverride failed, saved in fallback:', err);
      }
    }
  }

  async removeEdgeOverride(shiftKey: string, sourceId: string, targetId: string): Promise<void> {
    this.memoryCache.edgeOverrides = this.memoryCache.edgeOverrides.filter(
      (e) => !(e.shiftKey === shiftKey && e.sourceId === sourceId && e.targetId === targetId)
    );
    this.persistFallbackToDisk();

    if (this.mode === 'mongodb' && this.db) {
      try {
        await this.db.collection('edge_overrides').deleteOne({
          shiftKey,
          sourceId,
          targetId
        });
      } catch (err) {
        console.error('[DB] Mongo removeEdgeOverride failed:', err);
      }
    }
  }
}

export const dbInstance = new MeridianDatabase();
