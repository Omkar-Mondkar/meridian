import { dbInstance, TaskAutomationRule, TaskStateRecord, TaskAuditEvent } from './db.js';
import { executeSshCommand, SshConfig } from './ssh.js';
import { evaluateProbeExecution } from './evaluator.js';
import { socketHub } from './socket.js';

export interface PollerStatus {
  state: 'active' | 'idle' | 'circuit_open' | 'no_credentials';
  consecutiveFailures: number;
  circuitOpenUntil: number | null;
  lastCycleAt: string | null;
  activeRulesCount: number;
  lastProbedTaskId: string | null;
}

export class ServerPollerDaemon {
  private timer: NodeJS.Timeout | null = null;
  private isCycleRunning = false;
  private consecutiveFailures = 0;
  private circuitOpenUntil: number | null = null;
  private lastCycleAt: string | null = null;
  private lastProbedTaskId: string | null = null;
  private state: 'active' | 'idle' | 'circuit_open' | 'no_credentials' = 'idle';

  getStatus(): PollerStatus {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      circuitOpenUntil: this.circuitOpenUntil,
      lastCycleAt: this.lastCycleAt,
      activeRulesCount: 0,
      lastProbedTaskId: this.lastProbedTaskId
    };
  }

  start(intervalMs = 5000) {
    if (this.timer) {
      clearInterval(this.timer);
    }
    console.log(`[Poller] Starting background server poller daemon (cycle interval: ${intervalMs}ms)`);
    this.timer = setInterval(() => this.runCycle(), intervalMs);
    // Trigger initial run after 2 seconds
    setTimeout(() => this.runCycle(), 2000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state = 'idle';
    console.log('[Poller] Stopped poller daemon.');
  }

  async runCycle() {
    if (this.isCycleRunning) return;
    this.isCycleRunning = true;

    try {
      this.lastCycleAt = new Date().toISOString();

      // 1. Check Circuit Breaker
      if (this.circuitOpenUntil && Date.now() < this.circuitOpenUntil) {
        this.state = 'circuit_open';
        socketHub.broadcast({ type: 'POLLER_STATUS', status: this.getStatus() });
        return;
      } else if (this.circuitOpenUntil && Date.now() >= this.circuitOpenUntil) {
        // Reset tripped breaker
        console.log('[Poller] Circuit breaker timeout elapsed. Resuming connection attempts.');
        this.circuitOpenUntil = null;
        this.consecutiveFailures = 0;
      }

      // 2. Fetch SSH Credentials
      const sshConfig = await dbInstance.getDecryptedSshConfig();
      if (!sshConfig || !sshConfig.host || !sshConfig.username) {
        this.state = 'no_credentials';
        socketHub.broadcast({ type: 'POLLER_STATUS', status: this.getStatus() });
        return;
      }

      // 3. Fetch Automation Rules & Task States
      const rules = await dbInstance.getAllAutomationRules();
      const enabledRules = rules.filter((r) => r.enabled && r.scriptPath && r.scriptPath.trim());
      const tasks = await dbInstance.getTasks();
      const customNodes = await dbInstance.getCustomNodes();

      if (enabledRules.length === 0) {
        this.state = 'idle';
        socketHub.broadcast({ type: 'POLLER_STATUS', status: this.getStatus() });
        return;
      }

      this.state = 'active';

      // 4. Build Complete DAG Dependency Map
      const defaultDeps: Record<string, string[]> = {
        M1: [],
        M2: ['M1'],
        M3: ['M1'],
        M4: ['M3'],
        M5: [],
        M6: [],
        M7: [],
        M8: [],
        M9: [],
        M10: ['M2'],
        M11: ['M5', 'M6'],
        M12: ['M7'],
        M13: [],
        M14: ['M8'],
        M15: [],
        M16: ['M5', 'M8'],
        M17: [],
        M18: ['M8']
      };
      const taskDepMap = new Map<string, string[]>(Object.entries(defaultDeps));
      for (const node of customNodes) {
        if (node.dependsOn && node.dependsOn.length > 0) {
          taskDepMap.set(node.id, node.dependsOn);
        }
      }

      // 5. Evaluate and Probe Eligible Tasks
      for (const rule of enabledRules) {
        const taskId = rule.taskId;
        const currentTask = tasks[taskId];

        // Skip if already completed
        if (currentTask && currentTask.status === 'completed') {
          continue;
        }

        // Check Polling Interval
        if (rule.lastRunAt) {
          const elapsedSec = (Date.now() - new Date(rule.lastRunAt).getTime()) / 1000;
          const interval = rule.pollIntervalSec || 15;
          if (elapsedSec < interval) {
            continue;
          }
        }

        // DAG-Aware Eligibility Check: Check if all upstream prerequisites are completed
        const dependencies = taskDepMap.get(taskId) || [];
        if (dependencies.length > 0) {
          const allParentsCompleted = dependencies.every(
            (parentId) => tasks[parentId]?.status === 'completed'
          );
          if (!allParentsCompleted) {
            // Task prerequisites are still pending, do not probe yet
            continue;
          }
        }

        // Probe this task
        this.lastProbedTaskId = taskId;
        await this.probeTask(rule, sshConfig);

        // If circuit tripped during probe, exit loop
        if (this.circuitOpenUntil) {
          break;
        }
      }

      socketHub.broadcast({ type: 'POLLER_STATUS', status: this.getStatus() });
    } catch (err: unknown) {
      console.warn('[Poller] Error during cycle execution:', err);
    } finally {
      this.isCycleRunning = false;
    }
  }

  private async probeTask(rule: TaskAutomationRule, sshConfig: SshConfig) {
    const fullCommand =
      rule.args && rule.args.length > 0
        ? `${rule.scriptPath} ${rule.args.join(' ')}`
        : rule.scriptPath;

    try {
      const execution = await executeSshCommand(sshConfig, fullCommand, 8000);

      if (execution.timedOut || (!execution.success && execution.exitCode === -1)) {
        // SSH network or connection level error
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 3) {
          this.circuitOpenUntil = Date.now() + 30000; // Trip breaker for 30s
          this.state = 'circuit_open';
          console.warn(
            `[Poller] 3 consecutive SSH execution failures. Circuit breaker tripped for 30s.`
          );
        }
      } else {
        // Successful command execution (even if script returned non-zero code)
        this.consecutiveFailures = 0;
      }

      // Evaluate match against rule
      const evaluation = evaluateProbeExecution(
        {
          expectedExitCode: rule.expectedExitCode ?? 0,
          matchMode: rule.matchMode || 'exit_code_only',
          matchPattern: rule.matchPattern,
          jsonMetricKey: rule.jsonMetricKey,
          jsonMetricExpected: rule.jsonMetricExpected
        },
        execution
      );

      // Update rule state
      rule.lastRunAt = new Date().toISOString();
      rule.lastExitCode = execution.exitCode;
      rule.lastOutput = execution.stdout.slice(0, 500);
      rule.lastStatus = evaluation.matched ? 'success' : 'failure';
      if (execution.error) {
        rule.lastError = execution.error;
      }
      await dbInstance.saveAutomationRule(rule);

      // Broadcast progress metrics if extracted from JSON
      if (evaluation.metrics) {
        socketHub.broadcast({
          type: 'TASK_METRICS_UPDATED',
          taskId: rule.taskId,
          metrics: evaluation.metrics
        });
      }

      // If matched, AUTO-COMPLETE THE TASK!
      if (evaluation.matched) {
        const now = new Date().toISOString();
        const record: TaskStateRecord = {
          id: rule.taskId,
          status: 'completed',
          updatedAt: now,
          updatedBy: 'Server Poller Daemon',
          reason: `Auto-verified via SSH probe (${evaluation.matchDetail})`
        };
        await dbInstance.saveTask(record);

        const auditEvent: TaskAuditEvent = {
          id: `poller-${Date.now()}-${rule.taskId}`,
          taskId: rule.taskId,
          action: 'AUTO_POLLED',
          operator: 'Server Poller Daemon',
          reason: evaluation.matchDetail,
          timestamp: now,
          details: {
            script: rule.scriptPath,
            exitCode: execution.exitCode,
            latencyMs: execution.executionTimeMs
          }
        };
        await dbInstance.appendAuditLog(auditEvent);

        console.log(
          `[Poller] ✓ Task ${rule.taskId} AUTO-COMPLETED! Reason: ${evaluation.matchDetail}`
        );

        // Broadcast status update to all connected screens
        socketHub.broadcast({
          type: 'TASK_COMPLETED_BY_POLLER',
          taskId: rule.taskId,
          event: auditEvent,
          record,
          matchDetail: evaluation.matchDetail
        });
      }
    } catch (err: unknown) {
      console.warn(`[Poller] Failed to probe task ${rule.taskId}:`, err);
    }
  }
}

export const pollerDaemon = new ServerPollerDaemon();
