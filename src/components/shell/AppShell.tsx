import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSkyStore } from "../../stores/useSkyStore";
import { useTimeStore } from "../../stores/useTimeStore";
import { useScheduleStore } from "../../stores/useScheduleStore";
import { StarField } from "../StarField";
import { Header } from "./Header";
import { TabBar, type TabId } from "./TabBar";
import { SkyPreview } from "./SkyPreview";
import { OverviewTab } from "../../features/overview/OverviewTab";
import { TimelineTab } from "../../features/timeline/TimelineTab";
import { RosterTab } from "../../features/roster/RosterTab";
import { TasksTab } from "../../features/tasks/TasksTab";
import { pad2 } from "../../engines/timeSync";
import {
  toggleMute,
  isMuted,
  enableSound,
  isSoundEnabled,
} from "../../lib/voice";

import "./AppShell.css";

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [liveChipLabel, setLiveChipLabel] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(false);

  const { gradient, sunTopPct, isSun, fastTransition, elevation } =
    useSkyStore();
  const { parts, nowMin, startLoop } = useTimeStore();
  const { update: updateSchedule } = useScheduleStore();

  // Start the rAF clock loop on mount
  useEffect(() => startLoop(), [startLoop]);

  // Update sky on mount + every 30s (short interval catches HMR stale-init)
  useEffect(() => {
    const { recompute } = useSkyStore.getState();
    recompute();
    // Second call after 500ms ensures fresh gradient after Vite HMR module re-init
    const warmup = setTimeout(() => useSkyStore.getState().recompute(), 500);
    const id = setInterval(() => useSkyStore.getState().recompute(), 30_000);
    return () => {
      clearTimeout(warmup);
      clearInterval(id);
    };
  }, []);

  // Update schedule every second
  useEffect(() => {
    const unsub = useTimeStore.subscribe((s) => {
      const timeStr = `${pad2(s.parts.hour)}:${pad2(s.parts.minute)}:${pad2(s.parts.second)}`;
      updateSchedule(s.nowMin, s.parts.weekday, timeStr);
    });
    return unsub;
  }, [updateSchedule]);

  // Night amount CSS var
  useEffect(() => {
    const nightAmount = Math.min(1, Math.max(0, -elevation / 18));
    document.documentElement.style.setProperty(
      "--night-amount",
      nightAmount.toFixed(2),
    );
  }, [elevation]);

  // Sun/moon colour via inline refs
  const sunRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sunRef.current) return;
    const warm = isSun ? Math.max(0, 1 - elevation / 25) : 0;
    const glow = Math.max(0.15, 1 - Math.abs(elevation) / 40);
    function lerpHex(a: string, b: string, t: number): string {
      const n1 = parseInt(a.slice(1), 16),
        n2 = parseInt(b.slice(1), 16);
      const r = (c: number, i: number) => (c >> i) & 255;
      return `rgb(${Math.round(r(n1, 16) + (r(n2, 16) - r(n1, 16)) * t)},${Math.round(r(n1, 8) + (r(n2, 8) - r(n1, 8)) * t)},${Math.round(r(n1, 0) + (r(n2, 0) - r(n1, 0)) * t)})`;
    }
    if (isSun) {
      sunRef.current.style.background = `radial-gradient(circle, ${lerpHex("#FFE9B0", "#FFA76B", warm)}, ${lerpHex("#FFC24D", "#FF7A45", warm)})`;
      sunRef.current.style.boxShadow = `0 0 ${18 + glow * 26}px ${18 + glow * 26}px rgba(255,180,90,${0.1 + glow * 0.1})`;
    } else {
      sunRef.current.style.background =
        "radial-gradient(circle, #E9EDF5, #B9C4D6)";
      sunRef.current.style.boxShadow = `0 0 ${14 + glow * 18}px ${10 + glow * 14}px rgba(180,200,230,0.10)`;
    }
  }, [elevation, isSun]);

  const handleMuteToggle = useCallback(() => {
    const nowMuted = toggleMute();
    setMutedState(nowMuted);
  }, []);

  const handleEnableSound = useCallback(() => {
    enableSound();
    setSoundEnabledState(true);
  }, []);

  const handleLiveChipChange = useCallback((label: string | null) => {
    setLiveChipLabel(label);
  }, []);

  return (
    <div className="app-shell">
      {/* Sky layers */}
      <div
        className={`sky-bg${fastTransition ? " fast" : ""}`}
        id="skyBg"
        style={{ background: gradient }}
        aria-hidden="true"
      />
      <StarField />
      <div
        className={`sun-moon${fastTransition ? " fast" : ""}`}
        id="sunMoon"
        ref={sunRef}
        style={{ top: sunTopPct + "%" }}
        aria-hidden="true"
      />
      <div className="sky-scrim" aria-hidden="true" />

      {/* App chrome */}
      <Header
        liveChipLabel={liveChipLabel}
        muted={muted}
        onMuteToggle={handleMuteToggle}
        onEnableSound={handleEnableSound}
        soundEnabled={soundEnabled}
      />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <main className="content">
        <div className={activeTab === "overview" ? "" : "view-hidden"}>
          <OverviewTab onLiveChipChange={handleLiveChipChange} />
        </div>
        <div className={activeTab === "timeline" ? "" : "view-hidden"}>
          <TimelineTab muted={muted} />
        </div>
        <div className={activeTab === "roster" ? "" : "view-hidden"}>
          <RosterTab />
        </div>
        <div className={activeTab === "tasks" ? "" : "view-hidden"}>
          <TasksTab />
        </div>
      </main>

      <SkyPreview />
    </div>
  );
}
