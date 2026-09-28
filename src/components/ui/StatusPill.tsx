import React, { forwardRef } from 'react';
import type { TaskStatus } from '../../data/roster';

export interface StatusPillProps {
  status: TaskStatus;
  disabled?: boolean;
  title?: string;
  onClick?: (e?: React.MouseEvent) => void;
  'data-id'?: string;
}

const LABELS: Record<TaskStatus, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  completed:   'Completed',
};

export const StatusPill = forwardRef<HTMLButtonElement, StatusPillProps>(function StatusPill(
  { status, disabled, title, onClick, 'data-id': dataId },
  ref
) {
  const cls = `status-pill ${status}${disabled ? ' disabled' : ''}`;
  return (
    <button
      ref={ref}
      className={cls}
      disabled={disabled}
      title={title}
      data-id={dataId}
      onClick={disabled ? undefined : (e) => onClick && onClick(e)}
      type="button"
    >
      {LABELS[status]}
    </button>
  );
});
