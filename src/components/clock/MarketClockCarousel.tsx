import React, { useState, useEffect, useCallback } from 'react';
import { getTZParts, toMin, pad2 } from '../../engines/timeSync';
import { MARKETS, type Market } from '../../data/markets';
import { AnalogClock } from './AnalogClock';

interface MarketState {
  parts: ReturnType<typeof getTZParts>;
  isOpen: boolean;
  statusLabel: string;
}

function computeMarketState(m: Market): MarketState {
  const parts = getTZParts(m.tz);
  const nowMin = parts.hour * 60 + parts.minute;
  const openMin = toMin(m.open);
  const closeMin = toMin(m.close);
  const isWeekday = parts.weekday !== 'Sat' && parts.weekday !== 'Sun';
  const isOpen = isWeekday && nowMin >= openMin && nowMin < closeMin;
  let statusLabel: string;
  if (!isWeekday) statusLabel = 'Weekend';
  else if (nowMin < openMin) statusLabel = `Opens in ${openMin - nowMin} min`;
  else if (isOpen) statusLabel = `Closes in ${closeMin - nowMin} min`;
  else statusLabel = 'Closed for the day';
  return { parts, isOpen, statusLabel };
}

/** 3-page swipeable book carousel for IST / US / Korea markets. */
export function MarketClockCarousel({
  onLiveChipChange,
}: {
  onLiveChipChange: (label: string | null) => void;
}) {
  const [activePage, setActivePage] = useState(0);
  const [autoFollow, setAutoFollow] = useState(true);
  const [lastManualAt, setLastManualAt] = useState(0);
  const [states, setStates] = useState<MarketState[]>(() => MARKETS.map(computeMarketState));

  const gotoPage = useCallback((i: number, manual: boolean) => {
    const idx = ((i % MARKETS.length) + MARKETS.length) % MARKETS.length;
    setActivePage(idx);
    if (manual) {
      setAutoFollow(false);
      setLastManualAt(Date.now());
    }
  }, []);

  // Update market states every second
  useEffect(() => {
    const id = setInterval(() => {
      setStates(MARKETS.map(computeMarketState));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-follow logic
  useEffect(() => {
    const istOpen = states[0]?.isOpen;
    const usOpen  = states[1]?.isOpen;
    const krOpen  = states[2]?.isOpen;

    // Resume auto-follow after 90s idle
    let localAuto = autoFollow;
    if (!localAuto && Date.now() - lastManualAt > 90_000) {
      setAutoFollow(true);
      localAuto = true;
    }

    if (localAuto) {
      let target = 0;
      let label: string | null = null;
      if (istOpen) { target = 0; }
      else if (usOpen)  { target = 1; label = 'US Market Live Now'; }
      else if (krOpen)  { target = 2; label = 'Korea Market Live Now'; }
      setActivePage(target);
      onLiveChipChange(label);
    } else {
      onLiveChipChange(null);
    }
  }, [states, autoFollow, lastManualAt, onLiveChipChange]);

  function pageStyle(i: number): React.CSSProperties {
    const offset = i - activePage;
    if (offset === 0) {
      return { transform: 'translateX(0) rotateY(0deg) scale(1)', opacity: 1, zIndex: 3, pointerEvents: 'auto' };
    } else if (Math.abs(offset) === 1) {
      return { transform: `translateX(${offset * 92}%) rotateY(${offset * -28}deg) scale(0.84)`, opacity: 0.35, zIndex: 2, pointerEvents: 'none' };
    } else {
      return { transform: `translateX(${offset * 160}%) rotateY(${offset * -40}deg) scale(0.7)`, opacity: 0, zIndex: 1, pointerEvents: 'none' };
    }
  }

  const liveMarket = !states[0]?.isOpen && (states[1]?.isOpen || states[2]?.isOpen)
    ? (states[1]?.isOpen ? 'US Market Live Now' : 'Korea Market Live Now')
    : null;

  return (
    <div className="clock-book panel">
      {liveMarket && (
        <div className="clock-book-live" aria-live="polite">
          <span className="dot" />
          <span>{liveMarket}</span>
        </div>
      )}

      <div className="clock-book-stage" id="clockStage">
        {MARKETS.map((m, i) => {
          const st = states[i];
          if (!st) return null;
          const { parts, isOpen, statusLabel } = st;
          const timeStr = `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
          const tzCity = m.tz.split('/').pop()?.replace('_', ' ') ?? m.tz;
          const dateStr = `${parts.weekday}, ${pad2(parts.day)}/${pad2(parts.month)} · ${tzCity}`;

          return (
            <div
              key={m.key}
              className="clock-page"
              data-idx={i}
              style={pageStyle(i)}
              onClick={() => gotoPage(i, true)}
            >
              {i === 0 && <AnalogClock />}
              <div className="page-flag">{m.flag}</div>
              <div className="page-market">{m.name}</div>
              <div className={`page-time mono`} id={`page-time-${m.key}`}>{timeStr}</div>
              <div className="page-date" id={`page-date-${m.key}`}>{dateStr}</div>
              <div className={`page-status${isOpen ? ' open' : ''}`} id={`page-status-${m.key}`}>
                <span className="dot" />
                {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'} · {statusLabel}
              </div>
            </div>
          );
        })}
      </div>

      <div className="clock-book-controls">
        <button
          className="page-nav"
          id="pagePrev"
          title="Previous market"
          onClick={() => gotoPage(activePage - 1, true)}
          aria-label="Previous market"
        >‹</button>

        <div className="page-dots" id="pageDots">
          {MARKETS.map((m, i) => (
            <div
              key={m.key}
              className={`pd${i === activePage ? ' active' : ''}`}
              title={m.name}
              onClick={() => gotoPage(i, true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && gotoPage(i, true)}
            />
          ))}
        </div>

        <button
          className="page-nav"
          id="pageNext"
          title="Next market"
          onClick={() => gotoPage(activePage + 1, true)}
          aria-label="Next market"
        >›</button>

        <button
          className={`auto-pill${autoFollow ? ' active' : ''}`}
          id="autoFollowBtn"
          title="Auto-follow whichever market is live"
          onClick={() => { setAutoFollow(true); }}
        >⟳ AUTO</button>
      </div>
    </div>
  );
}
