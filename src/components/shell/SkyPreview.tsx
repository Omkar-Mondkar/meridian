import React, { useState, useRef } from 'react';
import { useSkyStore } from '../../stores/useSkyStore';
import { Panel } from '../ui/Panel';

/** Demo-only sky scrubber in the bottom-right corner. */
export function SkyPreview() {
  const [collapsed, setCollapsed] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const sweepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setPreviewMinute, setLive, previewMinute } = useSkyStore();

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    setPreviewMinute(+e.target.value);
  }

  function handleSweep() {
    if (sweepRef.current) clearInterval(sweepRef.current);
    setSweeping(true);
    let m = 0;
    sweepRef.current = setInterval(() => {
      m += 24;
      if (m >= 1440) {
        clearInterval(sweepRef.current!);
        setSweeping(false);
        setLive();
        return;
      }
      setPreviewMinute(m);
    }, 90);
  }

  function handleLive() {
    if (sweepRef.current) clearInterval(sweepRef.current);
    setSweeping(false);
    setLive();
  }

  return (
    <Panel className={`sky-preview${collapsed ? ' collapsed' : ''}`} id="skyPreview">
      <div
        className="sky-preview-head"
        id="skyPreviewToggle"
        onClick={() => setCollapsed((c) => !c)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <span id="skyPreviewLabel">🌤 Sky preview</span>
        <span id="skyPreviewCaret">{collapsed ? '▸' : '▾'}</span>
      </div>
      {!collapsed && (
        <div className="sky-preview-body">
          <div style={{ color: 'var(--text-lo)', fontSize: 11 }}>
            Demo-only: scrub or sweep a full day to see the sky engine react.
            Doesn't affect the clock, session or tasks.
          </div>
          <input
            type="range"
            id="previewSlider"
            min={0}
            max={1439}
            value={previewMinute}
            onChange={handleSlider}
            style={{ width: '100%', accentColor: 'var(--amber)' }}
          />
          <div className="preview-row" style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn"
              id="previewPlayBtn"
              onClick={handleSweep}
              disabled={sweeping}
              style={{ flex: 1, padding: '7px 10px', fontSize: 11 }}
            >
              {sweeping ? '⏸ Sweeping…' : '▶ Sweep 24h'}
            </button>
            <button
              className="btn"
              id="previewLiveBtn"
              onClick={handleLive}
              style={{ flex: 1, padding: '7px 10px', fontSize: 11 }}
            >
              Live sky
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
