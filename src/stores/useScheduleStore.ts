/**
 * useScheduleStore — NSE session schedule state.
 */
import { create } from 'zustand';
import {
  currentSession,
  nextEventLabel,
  type CurrentSessionResult,
} from '../engines/schedule';

export interface LogEntry {
  time: string;
  text: string;
}

interface ScheduleState {
  session: CurrentSessionResult;
  nextLabel: string;
  log: LogEntry[];
  lastSessionId: string | null;
  update: (nowMin: number, weekday: string, timeStr: string) => void;
  addLog: (entry: LogEntry) => void;
}

const initialSession: CurrentSessionResult = {
  id: 'LOADING',
  label: 'Loading session state…',
  voice: '',
};

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  session: initialSession,
  nextLabel: '—',
  log: [{ time: '—', text: 'Normal market is now open. (demo seed entry)' }],
  lastSessionId: null,

  update: (nowMin: number, weekday: string, timeStr: string) => {
    const sess = currentSession(nowMin, weekday);
    const nextLabel = nextEventLabel(nowMin);
    const { lastSessionId } = get();

    if (lastSessionId !== null && lastSessionId !== sess.id && sess.voice) {
      // Trigger voice outside the store (via subscription in the hook)
      get().addLog({ time: timeStr, text: sess.voice });
    }

    set({ session: sess, nextLabel, lastSessionId: sess.id });
  },

  addLog: (entry: LogEntry) => {
    set((s) => ({ log: [entry, ...s.log].slice(0, 50) }));
  },
}));
