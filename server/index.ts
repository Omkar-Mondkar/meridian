import http from 'node:http';
import { dbInstance, TaskStateRecord, TaskAuditEvent, TaskAutomationRule, UserRecord, GroupRecord } from './db.js';
import { socketHub } from './socket.js';
import { testSshConnection, executeSshCommand, SshConfig } from './ssh.js';
import { evaluateProbeExecution } from './evaluator.js';
import { pollerDaemon } from './poller.js';
import { authorizeRequest, resolveOperator } from './auth.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Operator-Id');
}

function parseJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    // Health check
    if (pathname === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          uptime: process.uptime(),
          dbMode: dbInstance.getMode(),
          activeClients: socketHub.getClientCount(),
          timestamp: new Date().toISOString()
        })
      );
      return;
    }

    // Get all task states & custom nodes
    if (pathname === '/api/tasks' && req.method === 'GET') {
      const tasks = await dbInstance.getTasks();
      const customNodes = await dbInstance.getCustomNodes();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          tasks,
          customNodes,
          dbMode: dbInstance.getMode()
        })
      );
      return;
    }

    // Audit logs
    if (pathname === '/api/tasks/audit' && req.method === 'GET') {
      const events = await dbInstance.getAuditLogs();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ events }));
      return;
    }

    // Manual override endpoint (Guarded by dag:override_ok)
    if (pathname === '/api/tasks/override' && req.method === 'POST') {
      const auth = await authorizeRequest(req, res, 'dag:override_ok');
      if (!auth.allowed) return;

      const body = await parseJsonBody<{ taskId: string; operator?: string; reason?: string }>(req);
      if (!body.taskId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'taskId is required' }));
        return;
      }

      const timestamp = new Date().toISOString();
      const effectiveOperator = auth.user ? auth.user.displayName : (body.operator || 'Operator');
      const record: TaskStateRecord = {
        id: body.taskId,
        status: 'completed',
        updatedAt: timestamp,
        updatedBy: effectiveOperator,
        reason: body.reason || 'Manual Set to OK'
      };
      await dbInstance.saveTask(record);

      const event: TaskAuditEvent = {
        id: `override-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        taskId: body.taskId,
        action: 'MANUAL_SET_TO_OK',
        operator: effectiveOperator,
        reason: body.reason || 'Manual Set to OK',
        timestamp,
        details: { operatorId: auth.user?.id, role: auth.user?.roleTitle }
      };
      await dbInstance.appendAuditLog(event);

      // Broadcast over WebSocket to all open client screens
      socketHub.broadcast({ type: 'TASK_OVERRIDDEN', event, record });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, record, event }));
      return;
    }

    // Custom node creation endpoint (Guarded by dag:edit_topology)
    if (pathname === '/api/tasks/node' && req.method === 'POST') {
      const auth = await authorizeRequest(req, res, 'dag:edit_topology');
      if (!auth.allowed) return;

      const body = await parseJsonBody<{ node: any }>(req);
      if (!body.node || !body.node.id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Valid node is required' }));
        return;
      }

      await dbInstance.saveCustomNode(body.node);
      socketHub.broadcast({ type: 'NODE_CREATED', node: body.node });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, node: body.node }));
      return;
    }

    // Get edge overrides
    if (pathname === '/api/tasks/edges' && req.method === 'GET') {
      const shiftKey = url.searchParams.get('shift') || undefined;
      const edges = await dbInstance.getEdgeOverrides(shiftKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ edges }));
      return;
    }

    // Add or remove edge override (Guarded by dag:edit_topology)
    if (pathname === '/api/tasks/edge' && req.method === 'POST') {
      const auth = await authorizeRequest(req, res, 'dag:edit_topology');
      if (!auth.allowed) return;

      const body = await parseJsonBody<{
        shiftKey: string;
        sourceId: string;
        targetId: string;
        action: 'add' | 'remove';
        operator?: string;
      }>(req);

      if (!body.shiftKey || !body.sourceId || !body.targetId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'shiftKey, sourceId, and targetId are required' }));
        return;
      }

      const action = body.action || 'add';
      if (action === 'add') {
        await dbInstance.saveEdgeOverride({
          shiftKey: body.shiftKey,
          sourceId: body.sourceId,
          targetId: body.targetId,
          action: 'add',
          updatedAt: new Date().toISOString()
        });
      } else {
        await dbInstance.removeEdgeOverride(body.shiftKey, body.sourceId, body.targetId);
      }

      socketHub.broadcast({
        type: 'EDGE_UPDATED',
        shiftKey: body.shiftKey,
        sourceId: body.sourceId,
        targetId: body.targetId,
        action
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, action, sourceId: body.sourceId, targetId: body.targetId }));
      return;
    }

    // RBAC: Get all users
    if (pathname === '/api/rbac/users' && req.method === 'GET') {
      const users = await dbInstance.getUsers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ users }));
      return;
    }

    // RBAC: Get all groups
    if (pathname === '/api/rbac/groups' && req.method === 'GET') {
      const groups = await dbInstance.getGroups();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ groups }));
      return;
    }

    // RBAC: Get current resolved operator profile & permissions
    if (pathname === '/api/rbac/me' && req.method === 'GET') {
      const { user, permissions } = await resolveOperator(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ user, permissions }));
      return;
    }

    // RBAC: Create or update a user (Admin only)
    if (pathname === '/api/rbac/user' && req.method === 'POST') {
      const auth = await authorizeRequest(req, res, 'admin:rbac_manage');
      if (!auth.allowed) return;

      const body = await parseJsonBody<UserRecord>(req);
      if (!body.id || !body.username || !body.displayName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'id, username, and displayName are required' }));
        return;
      }
      body.createdAt = body.createdAt || new Date().toISOString();
      await dbInstance.saveUser(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, user: body }));
      return;
    }

    // RBAC: Create or update a group (Admin only)
    if (pathname === '/api/rbac/group' && req.method === 'POST') {
      const auth = await authorizeRequest(req, res, 'admin:rbac_manage');
      if (!auth.allowed) return;

      const body = await parseJsonBody<GroupRecord>(req);
      if (!body.id || !body.name || !Array.isArray(body.permissions)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'id, name, and permissions array are required' }));
        return;
      }
      body.createdAt = body.createdAt || new Date().toISOString();
      await dbInstance.saveGroup(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, group: body }));
      return;
    }

    // SSH settings: Get redacted settings
    if (pathname === '/api/settings/ssh' && req.method === 'GET') {
      const settings = await dbInstance.getPublicSshSettings();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ settings }));
      return;
    }

    // SSH settings: Save credentials (encrypted at rest, Guarded by ssh:manage_vault)
    if (pathname === '/api/settings/ssh' && req.method === 'POST') {
      const auth = await authorizeRequest(req, res, 'ssh:manage_vault');
      if (!auth.allowed) return;

      const body = await parseJsonBody<{
        host: string;
        port: number;
        username: string;
        authType: 'password' | 'privateKey';
        password?: string;
        privateKey?: string;
        passphrase?: string;
        operator?: string;
      }>(req);

      if (!body.host || !body.username) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Host and Username are required' }));
        return;
      }

      await dbInstance.saveSshCredentials(body);

      const effectiveOperator = auth.user ? auth.user.displayName : (body.operator || 'Operator');
      const event: TaskAuditEvent = {
        id: `ssh-conf-${Date.now()}`,
        taskId: 'SYSTEM',
        action: 'AUTOMATION_CONFIG_UPDATED',
        operator: effectiveOperator,
        reason: 'Updated central server SSH credentials',
        timestamp: new Date().toISOString(),
        details: { operatorId: auth.user?.id, role: auth.user?.roleTitle }
      };
      await dbInstance.appendAuditLog(event);

      const settings = await dbInstance.getPublicSshSettings();
      socketHub.broadcast({ type: 'SSH_SETTINGS_UPDATED', settings });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, settings }));
      return;
    }

    // SSH test handshake
    if (pathname === '/api/settings/ssh/test' && req.method === 'POST') {
      const body = await parseJsonBody<{
        host?: string;
        port?: number;
        username?: string;
        authType?: 'password' | 'privateKey';
        password?: string;
        privateKey?: string;
        passphrase?: string;
      }>(req);

      let configToTest: SshConfig | null = null;
      if (body.host && body.username) {
        // If password/key omitted, try merging from stored
        const stored = await dbInstance.getDecryptedSshConfig();
        configToTest = {
          host: body.host,
          port: body.port || 22,
          username: body.username,
          authType: body.authType || 'password',
          password: body.password !== undefined && body.password !== '' ? body.password : stored?.password,
          privateKey: body.privateKey !== undefined && body.privateKey !== '' ? body.privateKey : stored?.privateKey,
          passphrase: body.passphrase !== undefined && body.passphrase !== '' ? body.passphrase : stored?.passphrase
        };
      } else {
        configToTest = await dbInstance.getDecryptedSshConfig();
      }

      if (!configToTest) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No SSH credentials configured or provided to test' }));
        return;
      }

      const result = await testSshConnection(configToTest, 5000);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // Get all automation rules
    if (pathname === '/api/automation' && req.method === 'GET') {
      const rules = await dbInstance.getAllAutomationRules();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ rules }));
      return;
    }

    // Interactive on-demand probe runner (Guarded by ssh:run_probe)
    if (pathname === '/api/automation/test' && req.method === 'POST') {
      const auth = await authorizeRequest(req, res, 'ssh:run_probe');
      if (!auth.allowed) return;

      const body = await parseJsonBody<{
        taskId?: string;
        scriptPath: string;
        args?: string[];
        expectedExitCode?: number;
        matchMode?: 'exit_code_only' | 'stdout_regex' | 'stdout_contains' | 'stdout_json_metric';
        matchPattern?: string;
        jsonMetricKey?: string;
        jsonMetricExpected?: string | number;
      }>(req);

      if (!body.scriptPath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'scriptPath is required' }));
        return;
      }

      const sshConfig = await dbInstance.getDecryptedSshConfig();
      if (!sshConfig) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Central SSH server credentials not configured. Please configure SSH settings first.'
          })
        );
        return;
      }

      const fullCommand = body.args && body.args.length > 0 ? `${body.scriptPath} ${body.args.join(' ')}` : body.scriptPath;
      const execution = await executeSshCommand(sshConfig, fullCommand, 8000);
      const evaluation = evaluateProbeExecution(
        {
          expectedExitCode: body.expectedExitCode ?? 0,
          matchMode: body.matchMode || 'exit_code_only',
          matchPattern: body.matchPattern,
          jsonMetricKey: body.jsonMetricKey,
          jsonMetricExpected: body.jsonMetricExpected
        },
        execution
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ execution, evaluation }));
      return;
    }

    // Get or update automation rule for a specific task
    if (pathname.startsWith('/api/automation/')) {
      const taskId = decodeURIComponent(pathname.slice('/api/automation/'.length));

      if (req.method === 'GET') {
        const rule = await dbInstance.getAutomationRule(taskId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ rule }));
        return;
      }

      if (req.method === 'PUT' || req.method === 'POST') {
        const auth = await authorizeRequest(req, res, 'automation:manage');
        if (!auth.allowed) return;

        const body = await parseJsonBody<TaskAutomationRule & { operator?: string }>(req);
        const rule: TaskAutomationRule = {
          taskId,
          enabled: Boolean(body.enabled),
          scriptPath: body.scriptPath || '',
          args: body.args || [],
          expectedExitCode: body.expectedExitCode ?? 0,
          matchMode: body.matchMode || 'exit_code_only',
          matchPattern: body.matchPattern || '',
          jsonMetricKey: body.jsonMetricKey || '',
          jsonMetricExpected: body.jsonMetricExpected,
          pollIntervalSec: body.pollIntervalSec || 15,
          lastRunAt: body.lastRunAt,
          lastStatus: body.lastStatus,
          lastExitCode: body.lastExitCode,
          lastOutput: body.lastOutput,
          lastError: body.lastError,
          updatedAt: new Date().toISOString()
        };

        await dbInstance.saveAutomationRule(rule);

        const effectiveOperator = auth.user ? auth.user.displayName : (body.operator || 'Operator');
        const event: TaskAuditEvent = {
          id: `auto-rule-${Date.now()}`,
          taskId,
          action: 'AUTOMATION_CONFIG_UPDATED',
          operator: effectiveOperator,
          reason: `Updated automation rule for ${taskId}`,
          timestamp: new Date().toISOString(),
          details: { scriptPath: rule.scriptPath, enabled: rule.enabled, operatorId: auth.user?.id, role: auth.user?.roleTitle }
        };
        await dbInstance.appendAuditLog(event);

        socketHub.broadcast({ type: 'AUTOMATION_RULE_UPDATED', taskId, rule });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, rule }));
        return;
      }
    }

    // Poller daemon status endpoint
    if (pathname === '/api/poller/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: pollerDaemon.getStatus() }));
      return;
    }

    // Default 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  } catch (err: unknown) {
    console.error('[HTTP] Server error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

// Initialize WebSocket hub on the HTTP server
socketHub.init(server);

// Connect to MongoDB (or local fallback) and start listening
async function bootstrap() {
  await dbInstance.connect();

  // Start background SSH health check poller daemon
  pollerDaemon.start(5000);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(` MERIDIAN REAL-TIME OPERATIONS BACKEND READY`);
    console.log(` - REST API:   http://localhost:${PORT}/api/tasks`);
    console.log(` - WebSocket:  ws://localhost:${PORT}/ws`);
    console.log(` - Storage:    ${dbInstance.getMode().toUpperCase()}`);
    console.log(`=======================================================`);
  });
}

bootstrap().catch((err) => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
