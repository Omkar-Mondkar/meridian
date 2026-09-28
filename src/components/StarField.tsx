import React, { useEffect, useRef } from 'react';

/** 70-star field that fades with the sky's night amount. */
export function StarField() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.childElementCount > 0) return;
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('div');
      s.className = 'star' + (Math.random() > 0.4 ? ' tw' : '');
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 70 + '%';
      s.style.animationDelay = (Math.random() * 3) + 's';
      el.appendChild(s);
    }
  }, []);

  return <div className="stars" ref={ref} aria-hidden="true" />;
}
