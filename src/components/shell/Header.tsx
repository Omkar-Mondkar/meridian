import React from "react";
import { useScheduleStore } from "../../stores/useScheduleStore";
import { BrandLogo } from "../ui/BrandLogo";

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
