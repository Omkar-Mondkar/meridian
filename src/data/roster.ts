/** Roster and shift checklist data (Design Doc §8, §9). */

export interface Person {
  name: string;
  role: string;
  gender: "f" | "m";
}

export interface LeaderPerson extends Person {
  title: string;
  level: "principal" | "team_leader";
  statusLabel?: string;
  coverage?: string;
}

export interface ShiftData {
  window: string;
  people: Person[];
}

export const LEADERSHIP: LeaderPerson[] = [
  {
    name: "Ravikant Himmatramka",
    role: "Principal — Production Engineering & Reliability",
    title: "Principal",
    level: "principal",
    gender: "m",
    statusLabel: "Principal",
    coverage: "Remote",
  },
  {
    name: "Sandeep Sawant",
    role: "Vice President",
    title: "Team Leader",
    level: "team_leader",
    gender: "m",
    statusLabel: "APS LEAD",
    coverage: "08:00–17:00",
  },
];

export const PERSONNEL: Record<string, ShiftData> = {
  Morning: {
    window: "07:00 – 16:00",
    people: [
      {
        name: "Vishal N. Patil",
        role: "Assistant Vice President",
        gender: "m",
      },
      {
        name: "Ashutosh Ugalmule",
        role: "Assistant Vice President",
        gender: "m",
      },
      {
        name: "Priyal Kamdar",
        role: "Assistant Manager",
        gender: "f",
      },
      {
        name: "Krish Gopani",
        role: "Assistant Manager",
        gender: "m",
      },
    ],
  },
  Evening: {
    window: "14:00 – 23:00",
    people: [
      {
        name: "Kiran Dhatavkar",
        role: "Assistant Vice President",
        gender: "m",
      },
      { name: "Omkar Mondkar", role: "Assistant Manager", gender: "m" },
      { name: "Dhruv Shah", role: "Assistant Manager", gender: "m" },
      { name: "Aakash Bhai", role: "Assistant Manager", gender: "m" },
    ],
  },
  Night: {
    window: "23:00 – 08:00",
    people: [
      { name: "Shivam Dandale", role: "Assitant Manager", gender: "m" },
      { name: "Ashwin Premani", role: "Assitant Manager", gender: "m" },
      { name: "Mahtab Alam", role: "Assitant Manager", gender: "m" },
    ],
  },
};

/** Shift windows in [startMin, endMin] pairs. Night wraps past midnight. */
export const SHIFT_RANGES: Record<string, [number, number]> = {
  Morning: [7 * 60, 16 * 60],
  Evening: [14 * 60, 23 * 60],
  Night: [23 * 60, 32 * 60], // 32*60 = next-day 08:00 (normalised via wrap)
};

export const SHIFT_KEYS = ["Morning", "Evening", "Night"] as const;
export type ShiftKey = (typeof SHIFT_KEYS)[number];

/** Window labels for the shift tab bar. */
export const SHIFT_WINDOWS: Record<string, string> = {
  Morning: "07:00–16:00",
  Evening: "14:00–23:00",
  Night: "23:00–08:00",
};

/** Does `nowMin` fall within the given [start, end] range (handles midnight wrap)? */
export function inRange(nowMin: number, [s, e]: [number, number]): boolean {
  const n2 = nowMin < s ? nowMin + 1440 : nowMin;
  return n2 >= s && n2 < e;
}

/** Duty state for a named shift at `nowMin`. */
export function dutyState(
  shiftName: string,
  nowMin: number,
): "on" | "up" | "off" {
  const range = SHIFT_RANGES[shiftName];
  if (!range) return "off";
  if (inRange(nowMin, range)) return "on";
  const [s] = range;
  const upcomingStart = s > nowMin ? s : s + 1440;
  if (upcomingStart - nowMin <= 60) return "up";
  return "off";
}

/** Is `nowMin` in a handover window? */
export function isHandover(nowMin: number): boolean {
  return (
    (nowMin >= 7 * 60 && nowMin < 8 * 60) ||
    (nowMin >= 14 * 60 && nowMin < 16 * 60)
  );
}

/** Single deterministic "current shift" — priority-ordered for the Tasks tab. */
export function currentShiftName(nowMin: number): ShiftKey {
  for (const k of SHIFT_KEYS) {
    if (dutyState(k, nowMin) === "on") return k;
  }
  return "Morning";
}

/* ---- Shift Checklists (Design Doc §9.5, Appendix 9.A) ---- */

import {
  generateBODExchangeFiles,
  type FileManifestSummary,
  type ExchangeFileItem,
  type ExchangeSegment,
} from "./exchangeManifest";

export type { FileManifestSummary, ExchangeFileItem, ExchangeSegment };

export type TaskStatus = "open" | "in_progress" | "completed";
export type NodeStatus = "blocked" | "ready" | "in_progress" | "completed" | "failed";
export type PipelineId = "exchange" | "market_data" | "execution" | "infra" | "other";

export interface VerificationConfig {
  type: "manual" | "file_manifest" | "log_grep" | "ssh_exec" | "db_query";
  serverIp?: string;
  logPath?: string;
  grepRegex?: string;
  expectedString?: string;
  lastChecked?: string;
  lastMatchedLine?: string;
}

export interface ChecklistItem {
  id: string;
  process: string;
  desc?: string;
  time: string;
  mode: string;
  executor: string;
  role: string;
  priority: "low" | "medium" | "high" | "critical";
  status: TaskStatus;
  completedBy?: string;
  completedAt?: string;

  // DAG Flowchart Enhancements
  dependsOn?: string[];
  pipeline?: PipelineId;
  verification?: VerificationConfig;
  fileManifest?: FileManifestSummary;
  isCustom?: boolean;
}

/** Seed checklist data. In production this comes from the backend. */
export function makeInitialChecklists(): Record<string, ChecklistItem[]> {
  return {
    Morning: [
      {
        id: "M1",
        process: "Exchange File Download",
        desc: "Download and ingest primary exchange master/contract files (~200 files across NetApp).",
        time: "00:30",
        mode: "Auto/Manual",
        executor: "File Downloader",
        role: "L1 Support",
        priority: "high",
        status: "open",
        dependsOn: [],
        pipeline: "exchange",
        verification: {
          type: "file_manifest",
          serverIp: "10.240.18.52",
          logPath: "/netapp/logs/downloader_bod.log",
          grepRegex: "ALL_EXCHANGE_FILES_TRANSFERRED_OK",
          expectedString: "DOWNLOAD_BATCH_COMPLETE",
        },
        fileManifest: generateBODExchangeFiles(),
      },
      {
        id: "M2",
        process: "K2 Mails",
        desc: "Verify and dispatch K2 confirmation and alert mails. Requires exchange files.",
        time: "06:30",
        mode: "Auto/Manual",
        executor: "ControlM",
        role: "L1 Support",
        priority: "medium",
        status: "open",
        dependsOn: ["M1"],
        pipeline: "exchange",
        verification: {
          type: "log_grep",
          serverIp: "10.240.22.14",
          logPath: "/var/log/k2/k2_mail_dispatcher.log",
          grepRegex: "BOD_CONFIRMATION_MAILS_DISPATCHED_SUCCESS",
          expectedString: "SUCCESS",
        },
      },
      {
        id: "M3",
        process: "Greeksoft BOD",
        desc: "Initialize Greeksoft beginning-of-day processes across segments. Requires exchange files.",
        time: "06:30",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "high",
        status: "open",
        dependsOn: ["M1"],
        pipeline: "exchange",
        verification: {
          type: "log_grep",
          serverIp: "10.240.30.10",
          logPath: "/greeksoft/logs/bod_init.log",
          grepRegex: "GREEKSOFT_BOD_INITIALIZED_ALL_SEGMENTS",
          expectedString: "READY",
        },
      },
      {
        id: "M4",
        process: "GREEK DB QUERY CHECK",
        desc: "Execute database integrity queries for Greek tables and schema.",
        time: "07:00",
        mode: "Manual",
        executor: "DB Ops",
        role: "L2 Support",
        priority: "high",
        status: "open",
        dependsOn: ["M3"],
        pipeline: "exchange",
        verification: {
          type: "db_query",
          serverIp: "10.240.30.15",
          logPath: "/db/audit/greek_db_check.log",
          grepRegex: "INTEGRITY_CHECK_OK_0_ERRORS",
          expectedString: "PASSED",
        },
      },
      {
        id: "M5",
        process: "TBT Adaptor",
        desc: "Start and verify Tick-By-Tick feed adapter connectivity.",
        time: "07:00",
        mode: "Auto/Manual",
        executor: "ControlM",
        role: "L2 Support",
        priority: "critical",
        status: "open",
        dependsOn: [],
        pipeline: "market_data",
        verification: {
          type: "log_grep",
          serverIp: "10.240.12.80",
          logPath: "/var/log/tbt/adapter.log",
          grepRegex: "MCAST_HANDSHAKE_ESTABLISHED_SUCCESS",
          expectedString: "CONNECTED",
        },
      },
      {
        id: "M6",
        process: "Fast feed",
        desc: "Confirm high-speed multicast market data feeds are active.",
        time: "07:00",
        mode: "Auto/Manual",
        executor: "ControlM",
        role: "L2 Support",
        priority: "critical",
        status: "open",
        dependsOn: [],
        pipeline: "market_data",
        verification: {
          type: "log_grep",
          serverIp: "10.240.12.82",
          logPath: "/var/log/marketdata/fastfeed.log",
          grepRegex: "MULTICAST_FEED_ACTIVE_PACKETS_FLOWING",
          expectedString: "FEED_ACTIVE",
        },
      },
      {
        id: "M7",
        process: "Health Reports Checks",
        desc: "Inspect system, memory, CPU and latency health dashboards.",
        time: "07:00",
        mode: "Manual",
        executor: "Monitoring",
        role: "L1 Support",
        priority: "high",
        status: "open",
        dependsOn: [],
        pipeline: "infra",
        verification: {
          type: "manual",
          serverIp: "10.240.40.10",
          logPath: "/opt/monitoring/health_summary.log",
          grepRegex: "ALL_NODES_HEALTHY",
        },
      },
      {
        id: "M8",
        process: "Executors",
        desc: "Start trading order execution engines and gateways.",
        time: "07:10",
        mode: "Auto/Manual",
        executor: "ControlM",
        role: "L1 Support",
        priority: "high",
        status: "open",
        dependsOn: [],
        pipeline: "execution",
        verification: {
          type: "log_grep",
          serverIp: "10.240.15.5",
          logPath: "/opt/executors/gateway.log",
          grepRegex: "EXECUTION_GATEWAYS_ONLINE",
        },
      },
      {
        id: "M9",
        process: "Control M BOD Dashboard & Alerts Checks",
        desc: "Verify Control-M batch jobs and ensure no unhandled alerts exist.",
        time: "07:30",
        mode: "Manual",
        executor: "ControlM/Pulse",
        role: "L1 Support",
        priority: "high",
        status: "open",
        dependsOn: [],
        pipeline: "execution",
        verification: {
          type: "manual",
          serverIp: "10.240.50.2",
          logPath: "/controlm/alerts/active_alerts.log",
          grepRegex: "NO_CRITICAL_ALERTS",
        },
      },
      {
        id: "M10",
        process: "K2 & Kavach (Trade Listener, Corporate Dropcopy, Kavach, K2 BOD)",
        desc: "Validate Trade Listener, Corporate Dropcopy, Kavach risk suite, and K2 BOD.",
        time: "08:00",
        mode: "Manual",
        executor: "Core Ops",
        role: "L2 Support",
        priority: "critical",
        status: "open",
        dependsOn: ["M2"],
        pipeline: "execution",
        verification: {
          type: "log_grep",
          serverIp: "10.240.22.18",
          logPath: "/kavach/logs/risk_suite.log",
          grepRegex: "RISK_LISTENER_ACTIVE",
        },
      },
      {
        id: "M11",
        process: "TBT Recorder",
        desc: "Verify Tick-By-Tick market data recording instance status.",
        time: "08:00",
        mode: "Manual",
        executor: "ControlM",
        role: "L1 Support",
        priority: "high",
        status: "open",
        dependsOn: ["M5", "M6"],
        pipeline: "market_data",
        verification: {
          type: "log_grep",
          serverIp: "10.240.12.90",
          logPath: "/var/log/tbt/recorder.log",
          grepRegex: "RECORDING_ACTIVE_PCAP_BUFFER_OK",
        },
      },
      {
        id: "M12",
        process: "NSE Windows UDP Check",
        desc: "Check Windows UDP multicast socket buffer & packet drops.",
        time: "08:05",
        mode: "Manual",
        executor: "Infra Ops",
        role: "L2 Support",
        priority: "high",
        status: "open",
        dependsOn: ["M7"],
        pipeline: "infra",
        verification: {
          type: "manual",
          serverIp: "10.240.60.4",
          logPath: "C:\\MarketData\\udp_buffer_check.log",
          grepRegex: "UDP_PACKET_LOSS_0_PERCENT",
        },
      },
      {
        id: "M13",
        process: "BCP BOD Check",
        desc: "Confirm Business Continuity site readiness and data replication status.",
        time: "08:15",
        mode: "Manual",
        executor: "BCP Desk",
        role: "Shift Lead",
        priority: "critical",
        status: "open",
        dependsOn: [],
        pipeline: "infra",
        verification: {
          type: "manual",
          serverIp: "10.240.70.1",
          logPath: "/bcp/dr_replication_status.log",
          grepRegex: "DR_DATA_SYNC_100_PERCENT",
        },
      },
      {
        id: "M14",
        process: "After Restart, Any Application / start dependency like trade listener Dropcopy etc.",
        desc: "Verify post-reboot dependency chains and service handshakes.",
        time: "08:20",
        mode: "Manual",
        executor: "App Support",
        role: "Shift Lead",
        priority: "critical",
        status: "open",
        dependsOn: ["M8"],
        pipeline: "execution",
        verification: {
          type: "manual",
          serverIp: "10.240.15.20",
          logPath: "/opt/app_support/post_restart.log",
          grepRegex: "HANDSHAKES_VERIFIED",
        },
      },
      {
        id: "M15",
        process: "Audit check",
        desc: "Verify audit trails, session logs, and compliance records.",
        time: "08:30",
        mode: "Manual",
        executor: "Audit Desk",
        role: "L2 Support",
        priority: "medium",
        status: "open",
        dependsOn: [],
        pipeline: "infra",
        verification: {
          type: "manual",
          serverIp: "10.240.80.5",
          logPath: "/audit/compliance_trail.log",
          grepRegex: "AUDIT_LOGS_SIGNED",
        },
      },
      {
        id: "M16",
        process: "LTP check",
        desc: "Confirm Last Traded Price broadcast sanity across major indices.",
        time: "09:15",
        mode: "Manual",
        executor: "Market Ops",
        role: "L1 Support",
        priority: "critical",
        status: "open",
        dependsOn: ["M5", "M8"],
        pipeline: "execution",
        verification: {
          type: "manual",
          serverIp: "10.240.12.50",
          logPath: "/marketops/ltp_sanity.log",
          grepRegex: "INDEX_BROADCAST_SANITY_OK",
        },
      },
      {
        id: "M17",
        process: "UAT Test Environment BOD",
        desc: "Bring up UAT testing environments and mock market gateways.",
        time: "10:30",
        mode: "Manual",
        executor: "UAT Team",
        role: "L1 Support",
        priority: "low",
        status: "open",
        dependsOn: [],
        pipeline: "infra",
        verification: {
          type: "manual",
          serverIp: "10.240.90.10",
          logPath: "/uat/gateway_mock.log",
          grepRegex: "MOCK_GATEWAYS_ONLINE",
        },
      },
      {
        id: "M18",
        process: "Eagle BOD",
        desc: "Execute Eagle beginning-of-day valuation and risk workflows.",
        time: "12:35",
        mode: "Auto/Manual",
        executor: "Eagle Ops",
        role: "L1 Support",
        priority: "medium",
        status: "open",
        dependsOn: ["M8"],
        pipeline: "execution",
        verification: {
          type: "log_grep",
          serverIp: "10.240.100.2",
          logPath: "/eagle/logs/eod_bod.log",
          grepRegex: "VALUATION_AND_RISK_COMPLETE",
        },
      },
    ],
    Evening: [
      {
        id: "E1",
        process: "Pulse Trade file process for FNO & CM",
        time: "3:31 / 3:35",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E2",
        process: "TBT-Data Validation & Comparison",
        time: "03:30–04:00",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E3",
        process: "OTA reports",
        time: "03:45–04:15",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E4",
        process: "Latency Report",
        time: "03:35–03:40",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E5",
        process: "TBT File copy process",
        time: "04:05–04:30",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E6",
        process: "Trade file process for CD",
        time: "5:15",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E7",
        process: "Span file download",
        time: "5:30",
        mode: "Auto",
        executor: "File Downloader",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E8",
        process: "Inhouse EOD",
        time: "8:15",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "medium",
        status: "open",
      },
      {
        id: "E9",
        process: "NSE Stream ID Mail",
        time: "10:00",
        mode: "Auto/Manual",
        executor: "—",
        role: "L1 Support",
        priority: "medium",
        status: "open",
      },
      {
        id: "E10",
        process: "BSE Stream ID Mail",
        time: "10:00",
        mode: "Auto/Manual",
        executor: "—",
        role: "L1 Support",
        priority: "medium",
        status: "open",
      },
      {
        id: "E11",
        process: "Exchange file download (evening)",
        time: "8:00",
        mode: "Auto",
        executor: "File Downloader",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E12",
        process: "Sub2 HFT Token activity",
        time: "8:10",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E13",
        process: "Commvault backup for ML",
        time: "8:20",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E14",
        process: "Commvault backup for GP",
        time: "8:20",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E15",
        process: "Commvault backup for FES",
        time: "8:20",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E16",
        process: "Commvault backup for CORMS",
        time: "8:20",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E17",
        process: "Commvault backup for CONREV",
        time: "8:20",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E18",
        process: "Greeksoft EOD Check",
        time: "10:10",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "medium",
        status: "open",
      },
      {
        id: "E19",
        process: "Inhouse Token activity",
        time: "10:15",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E20",
        process: "Check Audit mail",
        time: "10:30",
        mode: "Manual",
        executor: "EOD Team",
        role: "L2 Support",
        priority: "medium",
        status: "open",
      },
      {
        id: "E21",
        process: "Sub2 EOD check",
        time: "10:30",
        mode: "Auto",
        executor: "Auto",
        role: "L1 Support",
        priority: "medium",
        status: "open",
      },
      {
        id: "E22",
        process: "Mail check & reply & forwarding",
        time: "—",
        mode: "Partial Auto",
        executor: "—",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "E23",
        process: "Control-M Dashboard Monitoring",
        time: "—",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "medium",
        status: "open",
      },
      {
        id: "E24",
        process: "Deployment (SUB2, Inhouse, TBT Adaptor, Greeksoft, FM)",
        time: "—",
        mode: "Manual",
        executor: "—",
        role: "Shift Lead",
        priority: "high",
        status: "open",
      },
      {
        id: "E25",
        process: "Start FM Converge EOD",
        time: "As per mail",
        mode: "Manual",
        executor: "—",
        role: "Shift Lead",
        priority: "medium",
        status: "open",
      },
      {
        id: "E26",
        process: "SUB2 Password Change",
        time: "Thursday",
        mode: "Auto",
        executor: "—",
        role: "Admin",
        priority: "high",
        status: "open",
      },
      {
        id: "E27",
        process: "INHOUSE Password Change",
        time: "Wednesday",
        mode: "Auto",
        executor: "—",
        role: "Admin",
        priority: "high",
        status: "open",
      },
      {
        id: "E28",
        process: "Greeksoft Password change (EQ/FO/CD)",
        time: "Wednesday",
        mode: "Manual",
        executor: "—",
        role: "Admin",
        priority: "high",
        status: "open",
      },
    ],
    Night: [
      {
        id: "N1",
        process: "Control-M Executing jobs kill & Hold job clearance activity",
        desc: "Clear stuck hold jobs and terminate stale execution pipelines.",
        time: "23:50–00:10",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "high",
        status: "open",
      },
      {
        id: "N2",
        process: "Control-M Dashboard Monitoring for MCX Jobs",
        desc: "Monitor commodity MCX batch processing queues.",
        time: "23:50–00:10",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "medium",
        status: "open",
      },
      {
        id: "N3",
        process: "Latency Report",
        desc: "Generate and verify nightly trading latency summaries.",
        time: "23:54",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "N4",
        process: "COM Trade Report",
        desc: "Process commodity trade records and reconciliation files.",
        time: "00:05",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "N5",
        process: "MCX Eod Check",
        desc: "Verify end-of-day closure status for MCX trading engines.",
        time: "00:10",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "medium",
        status: "open",
      },
      {
        id: "N6",
        process: "UDP Stop",
        desc: "Gracefully shut down night UDP broadcast sockets.",
        time: "00:30",
        mode: "Manual",
        executor: "Infra Ops",
        role: "L1 Support",
        priority: "high",
        status: "open",
      },
      {
        id: "N7",
        process: "Commvault backup for MCX",
        desc: "Run scheduled Commvault backup jobs for MCX storage.",
        time: "00:50",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "medium",
        status: "open",
      },
      {
        id: "N8",
        process: "Disk Space",
        desc: "Check server partition utilization across critical DB/app mounts.",
        time: "01:00",
        mode: "Manual",
        executor: "Infra Ops",
        role: "L1 Support",
        priority: "high",
        status: "open",
      },
      {
        id: "N9",
        process: "TBT Recorder BOD Check",
        desc: "Verify TBT recorder readiness for the next trade date.",
        time: "01:00",
        mode: "Manual",
        executor: "ControlM",
        role: "L1 Support",
        priority: "high",
        status: "open",
      },
      {
        id: "N10",
        process: "FM Converge EOD",
        desc: "Execute Financial Messenger Converge EOD batch.",
        time: "01:30",
        mode: "Manual",
        executor: "FM",
        role: "Shift Lead",
        priority: "high",
        status: "open",
      },
      {
        id: "N11",
        process: "Eagle IB (Monday)",
        desc: "Run Eagle Inbound Monday batch pipeline.",
        time: "04:00",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "low",
        status: "open",
      },
      {
        id: "N12",
        process: "File Download for 8.24",
        desc: "Download and parse security / bhavcopy files for cluster 8.24.",
        time: "05:00",
        mode: "Auto/Manual",
        executor: "File Downloader",
        role: "L1 Support",
        priority: "high",
        status: "open",
      },
      {
        id: "N13",
        process: "File Download for 5.101",
        desc: "Download and parse security / bhavcopy files for cluster 5.101.",
        time: "05:00",
        mode: "Auto/Manual",
        executor: "File Downloader",
        role: "L1 Support",
        priority: "high",
        status: "open",
      },
      {
        id: "N14",
        process: "Server Reboot Status and Accessibility",
        desc: "Audit scheduled server reboot cycles and verify ping/SSH accessibility.",
        time: "05:00",
        mode: "Manual",
        executor: "ControlM",
        role: "L2 Support",
        priority: "critical",
        status: "open",
      },
      {
        id: "N15",
        process: "Control-M/Pulse Dashboard Monitoring",
        desc: "Continuous health surveillance of morning batch workflows.",
        time: "05:00–08:00",
        mode: "Manual",
        executor: "ControlM/Pulse",
        role: "L1 Support",
        priority: "high",
        status: "open",
      },
      {
        id: "N16",
        process: "UDP",
        desc: "Initialize and verify UDP multicast feed connections.",
        time: "06:15",
        mode: "Manual",
        executor: "Infra Ops",
        role: "L1 Support",
        priority: "high",
        status: "open",
      },
      {
        id: "N17",
        process: "SUB2 GP BOD & Mail",
        desc: "Execute SUB2 Global Parameters BOD run and dispatch verification mail.",
        time: "06:20",
        mode: "Auto/Manual",
        executor: "ControlM",
        role: "L1 Support",
        priority: "high",
        status: "open",
      },
      {
        id: "N18",
        process: "Greeksoft BOD & Mail",
        desc: "Trigger Greeksoft BOD routine and notify desk leads.",
        time: "06:30",
        mode: "Auto/Manual",
        executor: "ControlM",
        role: "L1 Support",
        priority: "high",
        status: "open",
      },
      {
        id: "N19",
        process: "Executor BOD check",
        desc: "Validate order routing and executor instances readiness.",
        time: "07:00",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "high",
        status: "open",
      },
      {
        id: "N20",
        process: "Metanoia Bod Check",
        desc: "Verify Metanoia risk and execution engine health status.",
        time: "07:00",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "medium",
        status: "open",
      },
      {
        id: "N21",
        process: "Fastfeed Adapter Bod Check",
        desc: "Ensure fastfeed adapters are locked and streaming tick data.",
        time: "07:15",
        mode: "Auto",
        executor: "ControlM",
        role: "L2 Support",
        priority: "critical",
        status: "open",
      },
      {
        id: "N22",
        process: "TBT Adapter Bod Check",
        desc: "Ensure TBT adapters are locked and streaming order book depth.",
        time: "07:15",
        mode: "Auto",
        executor: "ControlM",
        role: "L2 Support",
        priority: "critical",
        status: "open",
      },
      {
        id: "N23",
        process: "K2 Prod & Pre-Prod Bod Check",
        desc: "Perform sanity verification on K2 Production and Pre-Prod environments.",
        time: "07:30",
        mode: "Auto",
        executor: "ControlM",
        role: "L2 Support",
        priority: "critical",
        status: "open",
      },
      {
        id: "N24",
        process: "MCX GP Bod Check & Mail",
        desc: "Verify MCX GP beginning-of-day status and send confirmation mail.",
        time: "07:50",
        mode: "Auto",
        executor: "ControlM",
        role: "L1 Support",
        priority: "high",
        status: "open",
      },
      {
        id: "N25",
        process: "Incident update in ITSM",
        desc: "Log and update overnight tickets and handover notes in ITSM.",
        time: "07:45",
        mode: "Manual",
        executor: "IT Ops",
        role: "L1 Support",
        priority: "medium",
        status: "open",
      },
    ],
  };
}
