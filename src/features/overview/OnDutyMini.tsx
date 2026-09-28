import React from 'react';
import { PERSONNEL, dutyState } from '../../data/roster';
import { useTimeStore } from '../../stores/useTimeStore';

export function OnDutyMini() {
  const { nowMin } = useTimeStore();
  const onNow: { name: string; role: string }[] = [];
  Object.entries(PERSONNEL).forEach(([shiftName, data]) => {
    if (dutyState(shiftName, nowMin) === 'on') {
      data.people.forEach((p) => onNow.push(p));
    }
  });

  return (
    <div id="onDutyMini">
      {onNow.length > 0
        ? onNow.map((p) => (
            <div key={p.name} className="mini-row">
              <span className="pip on" />
              {p.name}
              <span style={{ color: 'var(--text-lo)', marginLeft: 'auto' }}>{p.role}</span>
            </div>
          ))
        : <div className="mini-row"><span className="pip off" />No shift active</div>
      }
    </div>
  );
}
