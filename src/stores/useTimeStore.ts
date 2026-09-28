/**
 * useTimeStore — Central clock store.
 * Drives a requestAnimationFrame loop that updates IST parts every second.
 * All components subscribe here rather than calling getISTParts() themselves.
 */
import { create } from 'zustand';
import { getISTParts, type TimeParts } from '../engines/timeSync';

interface TimeState {
  parts: TimeParts;
  nowMin: number;
  /** Start the rAF loop (call once on mount). */
  startLoop: () => () => void;
}

const initial = getISTParts();

export const useTimeStore = create<TimeState>((set) => ({
  parts: initial,
  nowMin: initial.hour * 60 + initial.minute,

  startLoop: () => {
    let lastSecond = -1;
    let rafId = 0;

    function tick() {
      const p = getISTParts();
      if (p.second !== lastSecond) {
        lastSecond = p.second;
        set({ parts: p, nowMin: p.hour * 60 + p.minute });
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  },
}));
