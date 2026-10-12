import type { SshExecutionResult } from './ssh.js';
import type { TaskAutomationRule } from './db.js';

export interface EvaluationResult {
  matched: boolean;
  matchDetail: string;
  metrics?: Record<string, any>;
}

/**
 * Evaluates whether an SSH command execution output satisfies a task's automation rule criteria.
 */
export function evaluateProbeExecution(
  rule: Pick<TaskAutomationRule, 'expectedExitCode' | 'matchMode' | 'matchPattern' | 'jsonMetricKey' | 'jsonMetricExpected'>,
  exec: SshExecutionResult
): EvaluationResult {
  if (exec.timedOut) {
    return {
      matched: false,
      matchDetail: `Execution timed out (${exec.executionTimeMs}ms)`
    };
  }

  const expectedCode = rule.expectedExitCode ?? 0;
  const exitCodeMatches = exec.exitCode === expectedCode;

  if (rule.matchMode === 'exit_code_only') {
    return {
      matched: exitCodeMatches,
      matchDetail: exitCodeMatches
        ? `Process exited with expected code ${expectedCode}`
        : `Process exited with code ${exec.exitCode} (expected ${expectedCode})`
    };
  }

  if (rule.matchMode === 'stdout_regex') {
    if (!rule.matchPattern) {
      return {
        matched: exitCodeMatches,
        matchDetail: exitCodeMatches
          ? `Exit code ${expectedCode} matched (no regex pattern specified)`
          : `Exit code ${exec.exitCode} != ${expectedCode}`
      };
    }
    try {
      const rx = new RegExp(rule.matchPattern, 'i');
      const textMatches = rx.test(exec.stdout);
      const matched = exitCodeMatches && textMatches;
      return {
        matched,
        matchDetail: matched
          ? `Exit code ${exec.exitCode} matched and regex /${rule.matchPattern}/ matched stdout`
          : !exitCodeMatches
            ? `Exit code ${exec.exitCode} != ${expectedCode}`
            : `Regex /${rule.matchPattern}/ did not match stdout`
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        matched: false,
        matchDetail: `Invalid regular expression pattern: ${msg}`
      };
    }
  }

  if (rule.matchMode === 'stdout_contains') {
    const pattern = rule.matchPattern || '';
    const contains = exec.stdout.includes(pattern);
    const matched = exitCodeMatches && contains;
    return {
      matched,
      matchDetail: matched
        ? `Exit code ${exec.exitCode} matched and stdout contains "${pattern}"`
        : !exitCodeMatches
          ? `Exit code ${exec.exitCode} != ${expectedCode}`
          : `Stdout does not contain substring "${pattern}"`
    };
  }

  if (rule.matchMode === 'stdout_json_metric') {
    try {
      const parsed = JSON.parse(exec.stdout);

      // Progress stream extraction: downloaded and total counts
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.downloaded === 'number' &&
        typeof parsed.total === 'number'
      ) {
        const isComplete = parsed.downloaded >= parsed.total;
        return {
          matched: exitCodeMatches && isComplete,
          matchDetail: isComplete
            ? `Ingestion complete: All ${parsed.downloaded}/${parsed.total} files downloaded`
            : `Ingestion in progress: ${parsed.downloaded}/${parsed.total} files downloaded (standing by)`,
          metrics: parsed
        };
      }

      const key = rule.jsonMetricKey || 'status';
      if (!(key in parsed)) {
        return {
          matched: false,
          matchDetail: `JSON output missing expected metric key "${key}"`,
          metrics: typeof parsed === 'object' ? parsed : undefined
        };
      }

      const actualVal = parsed[key];
      const expectedVal = rule.jsonMetricExpected;
      let valMatches = false;

      if (expectedVal !== undefined && expectedVal !== '') {
        valMatches = String(actualVal).toLowerCase() === String(expectedVal).toLowerCase();
      } else {
        // Truthy check if expected value not specified
        valMatches = Boolean(actualVal);
      }

      const matched = exitCodeMatches && valMatches;
      return {
        matched,
        matchDetail: matched
          ? `JSON metric "${key}" = ${JSON.stringify(actualVal)} satisfied criteria`
          : `JSON metric "${key}" = ${JSON.stringify(actualVal)} did not match expected "${expectedVal}"`,
        metrics: typeof parsed === 'object' ? parsed : undefined
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        matched: false,
        matchDetail: `Failed to parse stdout as JSON: ${msg}`
      };
    }
  }

  return {
    matched: exitCodeMatches,
    matchDetail: `Default evaluation: exitCode ${exec.exitCode} (expected ${expectedCode})`
  };
}
