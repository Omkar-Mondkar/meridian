import React, { useState } from "react";
import { useScheduleStore } from "../../stores/useScheduleStore";
import { useTaskStore } from "../../stores/useTaskStore";
import { BrandLogo } from "../ui/BrandLogo";
import { SshSettingsModal } from "./SshSettingsModal";
import { OperatorSwitcher } from "./OperatorSwitcher";

interface HeaderProps {
  liveChipLabel: string | null;
  muted: boolean;
  onMuteToggle: () => void;
  onEnableSound: () => void;
  soundEnabled: boolean;
}

export function Header({
  liveChipLabel,
  muted,
  onMuteToggle,
  onEnableSound,
  soundEnabled,
}: HeaderProps) {
  const { session } = useScheduleStore();
  const { syncStatus, dbMode, pollerStatus } = useTaskStore();
  const [sshModalOpen, setSshModalOpen] = useState(false);

  return (
    <header className="header">
      <div className="brand">
        <BrandLogo size={36} />
        <div>
          <div className="brand-title">MERIDIAN · APS CONTROL CENTER</div>
          <div className="brand-sub" id="phaseLabelSmall">
            {session.label}
          </div>
        </div>
      </div>

      {/* WallClock rendered here via slot — passed as children */}
      <div className="clock-block">
        <ClockSlot />
      </div>

      <div className="header-status">
        {liveChipLabel && (
          <div
            className="chip live-chip"
            id="globalLiveChip"
            aria-live="polite"
          >
            <span className="dot" />
            <span id="globalLiveChipText">{liveChipLabel.toUpperCase()}</span>
          </div>
        )}

        <div className="chip" id="sessionChip">
          <span className="dot" />
          <span id="sessionChipText">{session.label}</span>
        </div>

        <div className="chip" id="syncChip">
          <span className="dot" />
          IST · SYNCED
        </div>

        <div
          className={`chip sync-status-chip ${syncStatus}`}
          id="wsSyncChip"
          title={
            syncStatus === "connected"
              ? `Connected to real-time operations hub (${dbMode.toUpperCase()})`
              : syncStatus === "connecting"
                ? "Connecting to real-time sync server..."
                : "Offline mode: local state cached"
          }
          style={{
            borderColor:
              syncStatus === "connected"
                ? "rgba(34, 197, 94, 0.4)"
                : syncStatus === "connecting"
                  ? "rgba(234, 179, 8, 0.4)"
                  : "rgba(148, 163, 184, 0.25)",
            background:
              syncStatus === "connected"
                ? "rgba(34, 197, 94, 0.08)"
                : syncStatus === "connecting"
                  ? "rgba(234, 179, 8, 0.08)"
                  : "rgba(148, 163, 184, 0.05)",
          }}
        >
          <span
            className="dot"
            style={{
              background:
                syncStatus === "connected"
                  ? "#22c55e"
                  : syncStatus === "connecting"
                    ? "#eab308"
                    : "#64748b",
              boxShadow:
                syncStatus === "connected"
                  ? "0 0 8px #22c55e"
                  : syncStatus === "connecting"
                    ? "0 0 6px #eab308"
                    : "none",
            }}
          />
          <span className="mono" style={{ fontSize: "11px", letterSpacing: "0.04em" }}>
            {syncStatus === "connected"
              ? `LIVE SYNC · ${dbMode === "mongodb" ? "MONGO" : "LOCAL"}`
              : syncStatus === "connecting"
                ? "CONNECTING..."
                : "OFFLINE"}
          </span>
        </div>

        {/* Automated Server Poller Chip */}
        <div
          className={`chip poller-status-chip ${pollerStatus.state}`}
          id="pollerStatusChip"
          onClick={() => setSshModalOpen(true)}
          title={
            pollerStatus.state === "active"
              ? `Automated Server Poller Active${pollerStatus.lastProbedTaskId ? ` · Last probed ${pollerStatus.lastProbedTaskId}` : ""} (Click to open SSH Vault)`
              : pollerStatus.state === "circuit_open"
                ? "Poller circuit breaker tripped: SSH connections temporarily paused (Click to check settings)"
                : pollerStatus.state === "no_credentials"
                  ? "Poller standing by: No SSH credentials configured (Click to configure)"
                  : "Poller daemon standing by (Click to configure)"
          }
          style={{
            cursor: "pointer",
            borderColor:
              pollerStatus.state === "active"
                ? "rgba(79, 217, 208, 0.4)"
                : pollerStatus.state === "circuit_open"
                  ? "rgba(255, 77, 94, 0.4)"
                  : "rgba(148, 163, 184, 0.25)",
            background:
              pollerStatus.state === "active"
                ? "rgba(79, 217, 208, 0.08)"
                : pollerStatus.state === "circuit_open"
                  ? "rgba(255, 77, 94, 0.08)"
                  : "rgba(148, 163, 184, 0.05)",
          }}
        >
          <span
            className="dot"
            style={{
              background:
                pollerStatus.state === "active"
                  ? "#4FD9D0"
                  : pollerStatus.state === "circuit_open"
                    ? "#FF4D5E"
                    : pollerStatus.state === "no_credentials"
                      ? "#FFB020"
                      : "#64748b",
              boxShadow:
                pollerStatus.state === "active"
                  ? "0 0 8px #4FD9D0"
                  : pollerStatus.state === "circuit_open"
                    ? "0 0 8px #FF4D5E"
                    : "none",
            }}
          />
          <span className="mono" style={{ fontSize: "11px", letterSpacing: "0.04em" }}>
            {pollerStatus.state === "active"
              ? "POLLER · ACTIVE"
              : pollerStatus.state === "circuit_open"
                ? "POLLER · PAUSED"
                : pollerStatus.state === "no_credentials"
                  ? "POLLER · NO KEY"
                  : "POLLER · IDLE"}
          </span>
        </div>

        {!soundEnabled && (
          <button
            className="btn"
            onClick={onEnableSound}
            title="Enable voice announcements"
            style={{ fontSize: "11px", padding: "6px 10px" }}
          >
            🔕 Enable sound
          </button>
        )}

        <OperatorSwitcher />

        <button
          className="icon-btn"
          id="sshSettingsBtn"
          title="Central Reporting Server SSH Configuration & Vault"
          onClick={() => setSshModalOpen(true)}
          aria-label="SSH Settings"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 9px",
            borderRadius: 7,
            background: "rgba(79, 217, 208, 0.08)",
            border: "1px solid rgba(79, 217, 208, 0.28)",
            color: "var(--cyan)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <span>⚡</span>
          <span className="mono">SSH VAULT</span>
        </button>

        <button
          className="icon-btn"
          id="muteBtn"
          title="Toggle voice announcements"
          onClick={onMuteToggle}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      <SshSettingsModal
        isOpen={sshModalOpen}
        onClose={() => setSshModalOpen(false)}
      />
    </header>
  );
}

// Inner component that reads from time store directly
import { useTimeStore } from "../../stores/useTimeStore";
import { pad2 } from "../../engines/timeSync";

function ClockSlot() {
  const { parts } = useTimeStore();
  const { hour, minute, second, day, month, year, weekday } = parts;
  return (
    <>
      <div className="clock-time mono" id="headerClock">
        {pad2(hour)}:{pad2(minute)}:{pad2(second)}
      </div>
      <div className="clock-date" id="headerDate">
        {weekday}, {pad2(day)}/{pad2(month)}/{year} IST
      </div>
    </>
  );
}
