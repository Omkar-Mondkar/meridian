import React, { useRef, useEffect } from 'react';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useTimeStore } from '../../stores/useTimeStore';
import {
  SESSIONS,
  SESSION_ICON,
  SESSION_START,
  TOTAL_WINDOW,
  segmentPhase,
} from '../../engines/schedule';
import { toMin } from '../../engines/timeSync';
import { speak } from '../../lib/voice';
import { Panel } from '../../components/ui/Panel';

function AnnouncementLog() {
  const { log } = useScheduleStore();
  return (
    <Panel className="log-panel" id="logPanel" style={{ marginTop: 16 }}>
      <div className="mini-title" style={{ padding: '2px 2px 8px' }}>
        Announcement log
      </div>
      <div id="logRows">
        {log.map((entry, i) => (
          <div key={i} className="log-row">
            <span className="t mono">{entry.time}</span>
            <span className="log-text">{entry.text}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function TimelineTab({ muted }: { muted: boolean }) {
  const { session, nextLabel } = useScheduleStore();
  const { nowMin } = useTimeStore();
  const markerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // rAF-driven linear now-marker
  useEffect(() => {
    function tick() {
      if (!markerRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const { parts } = useTimeStore.getState();
      const nm = parts.hour * 60 + parts.minute + parts.second / 60;
      const pct = Math.min(
        100,
        Math.max(0, ((nm - SESSION_START) / TOTAL_WINDOW) * 100),
      );
      const visible = nm >= SESSION_START && nm <= SESSION_START + TOTAL_WINDOW;
      markerRef.current.style.left = `${pct}%`;
      markerRef.current.style.display = visible ? 'block' : 'none';
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Voice on session change
  const lastIdRef = useRef<string | null>(null);
  useEffect(() => {
    const unsub = useScheduleStore.subscribe((s) => {
      if (
        lastIdRef.current !== null &&
        lastIdRef.current !== s.session.id &&
        s.session.voice
      ) {
        speak(s.session.voice);
      }
      lastIdRef.current = s.session.id;
    });
    return unsub;
  }, [muted]);

  return (
    <section
      className="view"
      id="view-timeline"
      role="tabpanel"
      aria-labelledby="tab-timeline"
    >
      <Panel style={{ padding: 22 }}>
        <div className="phase-header">
          <div>
            <div className="phase-now" id="phaseNow">
              {session.label}
            </div>
            <div
              className="phase-countdown"
              id="phaseCountdown"
              dangerouslySetInnerHTML={{
                __html: nextLabel.replace(
                  /(\d+ min|\d{2}:\d{2} IST)/,
                  '<b>$1</b>',
                ),
              }}
            />
          </div>
        </div>

        {/* Linear Timeline track with proportional segment fills */}
        <div className="timeline-track" id="timelineTrack">
          {SESSIONS.map((s) => {
            const sStart = toMin(s.start);
            const sEnd = toMin(s.end);
            const dur = sEnd - sStart;
            const phase = segmentPhase(s, session.id, nowMin);

            let fillPct = 0;
            if (phase === 'done') {
              fillPct = 100;
            } else if (phase === 'current') {
              fillPct = Math.min(100, Math.max(0, ((nowMin - sStart) / dur) * 100));
            }

            return (
              <div
                key={s.id}
                className={`seg ${phase}`}
                data-id={s.id}
                style={{ flex: dur }}
                title={`${s.label} · ${s.start}–${s.end} IST`}
              >
                {fillPct > 0 && (
                  <div
                    className="seg-fill"
                    style={{ width: `${fillPct}%` }}
                  />
                )}
              </div>
            );
          })}
          <div className="now-marker" ref={markerRef} aria-hidden="true" />
        </div>

        {/* Phase card strip */}
        <div className="phase-strip" id="phaseStrip">
          {SESSIONS.map((s) => {
            const phase = segmentPhase(s, session.id, nowMin);
            return (
              <div key={s.id} className={`phase-card ${phase}`} data-id={s.id}>
                <div className="phase-card-icon">
                  {SESSION_ICON[s.id] ?? '•'}
                </div>
                <div>
                  <div className="phase-card-label">{s.label}</div>
                  <div className="phase-card-time mono">
                    {s.start} – {s.end}
                  </div>
                </div>
                <div className="phase-card-state" />
              </div>
            );
          })}
        </div>

        <div className="voice-row">
          <button
            type="button"
            className="btn primary"
            id="testVoiceBtn"
            onClick={() => speak(session.voice || 'Market status update.')}
          >
            ▶ Test voice alert for current phase
          </button>
        </div>
      </Panel>

      <AnnouncementLog />
    </section>
  );
}
