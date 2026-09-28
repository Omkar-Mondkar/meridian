import React from 'react';

interface PanelProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  id?: string;
}

/** Glass morphism panel — base building block for all cards. */
export function Panel({ className = '', style, children, id }: PanelProps) {
  return (
    <div id={id} className={`panel ${className}`} style={style}>
      {children}
    </div>
  );
}
