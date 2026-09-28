import React, { useEffect, useRef } from 'react';
import { useTimeStore } from '../../stores/useTimeStore';

/** Mini SVG analog clock for the IST clock carousel page. */
export function AnalogClock() {
  const hRef = useRef<SVGLineElement>(null);
  const mRef = useRef<SVGLineElement>(null);
  const sRef = useRef<SVGLineElement>(null);

  useEffect(() => {
    const unsub = useTimeStore.subscribe((state) => {
      const { hour, minute, second } = state.parts;
      const secDeg = second * 6;
      const minDeg = minute * 6 + second * 0.1;
      const hourDeg = (hour % 12) * 30 + minute * 0.5;
      hRef.current?.setAttribute('transform', `rotate(${hourDeg} 75 75)`);
      mRef.current?.setAttribute('transform', `rotate(${minDeg} 75 75)`);
      sRef.current?.setAttribute('transform', `rotate(${secDeg} 75 75)`);
    });
    return unsub;
  }, []);

  return (
    <svg className="analog mini" viewBox="0 0 150 150" width={52} height={52} aria-label="Analog clock">
      <circle cx={75} cy={75} r={70} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={1.5} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30) * Math.PI / 180;
        return (
          <line
            key={i}
            x1={75 + 60 * Math.sin(a)} y1={75 - 60 * Math.cos(a)}
            x2={75 + 66 * Math.sin(a)} y2={75 - 66 * Math.cos(a)}
            stroke="rgba(255,255,255,.35)" strokeWidth={2}
          />
        );
      })}
      <line ref={hRef} x1={75} y1={75} x2={75} y2={42} stroke="#E9EBEF" strokeWidth={4} strokeLinecap="round" />
      <line ref={mRef} x1={75} y1={75} x2={75} y2={26} stroke="#E9EBEF" strokeWidth={3} strokeLinecap="round" />
      <line ref={sRef} x1={75} y1={75} x2={75} y2={20} stroke="#FFB020" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={75} cy={75} r={4} fill="#FFB020" />
    </svg>
  );
}
