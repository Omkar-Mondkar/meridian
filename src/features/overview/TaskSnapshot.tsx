import React from 'react';
import { useTaskStore } from '../../stores/useTaskStore';
import { useTimeStore } from '../../stores/useTimeStore';
import { currentShiftName } from '../../data/roster';

export function TaskSnapshot() {
  const { nowMin } = useTimeStore();
  const { checklists } = useTaskStore();
  const shiftKey = currentShiftName(nowMin);
  const rows = checklists[shiftKey] ?? [];
  const counts = { open: 0, in_progress: 0, completed: 0 };
  rows.forEach((t) => { counts[t.status]++; });

  return (
    <div id="taskSnapshot">
      <div style={{ fontSize: 10, color: 'var(--text-lo)', letterSpacing: '.03em', marginBottom: 8 }}>
        LIVE · {shiftKey} shift
      </div>
      <div className="mini-row">
        <span className="pip off" />Open
        <span style={{ marginLeft: 'auto' }}>{counts.open}</span>
      </div>
      <div className="mini-row">
        <span className="pip on" style={{ background: 'var(--cyan)' }} />In Progress
        <span style={{ marginLeft: 'auto' }}>{counts.in_progress}</span>
      </div>
      <div className="mini-row">
        <span className="pip on" />Completed
        <span style={{ marginLeft: 'auto' }}>{counts.completed}</span>
      </div>
    </div>
  );
}
