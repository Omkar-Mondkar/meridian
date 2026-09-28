import React from 'react';
import { useTimeStore } from '../../stores/useTimeStore';
import { pad2 } from '../../engines/timeSync';

/** Large digital IST wall clock for the header. */
export function WallClock() {
  const { parts } = useTimeStore();
  const { hour, minute, second, day, month, year, weekday } = parts;
  const timeStr = `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
  const dateStr = `${weekday}, ${pad2(day)}/${pad2(month)}/${year} IST`;

  return (
    <div className="clock-block">
      <div className="clock-time mono" id="headerClock">{timeStr}</div>
      <div className="clock-date" id="headerDate">{dateStr}</div>
    </div>
  );
}
