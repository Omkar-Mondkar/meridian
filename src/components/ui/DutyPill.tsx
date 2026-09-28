import React from 'react';

interface DutyPillProps {
  state: 'on' | 'up' | 'off';
}

const LABELS = { on: 'ON DUTY', up: 'UPCOMING', off: 'OFF' };

export function DutyPill({ state }: DutyPillProps) {
  return <span className={`duty-pill ${state}`}>{LABELS[state]}</span>;
}
