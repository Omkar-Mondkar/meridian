import http from 'node:http';
import { dbInstance, TaskStateRecord, TaskAuditEvent } from './db.js';
import { socketHub } from './socket.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

    // Manual override endpoint
    if (pathname === '/api/tasks/override' && req.method === 'POST') {
      const body = await parseJsonBody<{ taskId: string; operator: string; reason: string }>(req);
      if (!body.taskId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'taskId is required' }));
        return;
      }

      const timestamp = new Date().toISOString();
      const record: TaskStateRecord = {
        id: body.taskId,
        status: 'completed',
        updatedAt: timestamp,
        updatedBy: body.operator || 'Operator',
        reason: body.reason || 'Manual Set to OK'
      };
      await dbInstance.saveTask(record);

      const event: TaskAuditEvent = {
        id: `override-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        taskId: body.taskId,
        action: 'MANUAL_SET_TO_OK',
        operator: body.operator || 'Operator',
        reason: body.reason || 'Manual Set to OK',
        timestamp
      };
      await dbInstance.appendAuditLog(event);

      // Broadcast over WebSocket to all open client screens
      socketHub.broadcast({ type: 'TASK_OVERRIDDEN', event, record });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, record, event }));
      return;
    }

    // Custom node creation endpoint
    if (pathname === '/api/tasks/node' && req.method === 'POST') {
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
