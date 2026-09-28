/**
 * schedule.ts — NSE market session config and state machine.
 * All times are IST. Config is data-driven (Design Doc §6.3).
 */

import { toMin } from './timeSync';

export interface Session {
  id: string;
  label: string;
  start: string;
  end: string;
  voice: string;
}

/** NSE cash-segment session config — effective 3 Aug 2026 CAS rollout.
 *  Treat every time here as CONFIG, not code. Update when NSE issues the
 *  next circular (next phase changes pre-open from 7 Sep 2026). */
export const SESSIONS: Session[] = [
  { id: 'PRE_OPEN_COLLECT', label: 'Pre-Open · Collection',   start: '09:00', end: '09:08', voice: 'Pre-open session has started.' },
  { id: 'PRE_OPEN_MATCH',   label: 'Pre-Open · Matching',     start: '09:08', end: '09:12', voice: 'Pre-open order matching is underway.' },
  { id: 'PRE_OPEN_BUFFER',  label: 'Pre-Open · Buffer',       start: '09:12', end: '09:15', voice: 'Pre-open buffer window.' },
  { id: 'NORMAL',           label: 'Normal Market',           start: '09:15', end: '15:15', voice: 'Normal market is now open.' },
  { id: 'CAS_WINDOW',       label: 'Closing Auction (CAS)',   start: '15:15', end: '15:35', voice: 'Closing auction session has begun.' },
  { id: 'CAS_SETTLEMENT',   label: 'Auction Confirmation',    start: '15:35', end: '15:50', voice: 'Closing auction price is being confirmed.' },
  { id: 'POST_CLOSE',       label: 'Post-Close',              start: '15:50', end: '16:00', voice: 'Post-close session has started.' },
  { id: 'MODIFICATION',     label: 'Trade Modification',      start: '16:00', end: '16:15', voice: 'Trade modification window is open.' },
];

export const SESSION_ICON: Record<string, string> = {
  PRE_OPEN_COLLECT: '🌅',
  PRE_OPEN_MATCH:   '🌅',
  PRE_OPEN_BUFFER:  '🌅',
  NORMAL:           '📈',
  CAS_WINDOW:       '🔔',
  CAS_SETTLEMENT:   '🔔',
  POST_CLOSE:       '🌇',
  MODIFICATION:     '🗂️',
};

export const SESSION_START = toMin(SESSIONS[0].start);
export const SESSION_END   = toMin(SESSIONS[SESSIONS.length - 1].end);
export const TOTAL_WINDOW  = SESSION_END - SESSION_START;

export interface CurrentSessionResult {
  id: string;
  label: string;
  voice: string;
}

/** Return the active session for a given IST minute-of-day + weekday. */
export function currentSession(nowMin: number, weekday: string): CurrentSessionResult {
  if (weekday === 'Sat' || weekday === 'Sun') {
    return { id: 'HOLIDAY', label: 'Market Closed · Weekend', voice: 'Market is closed today.' };
  }
  if (nowMin < SESSION_START) {
    return { id: 'CLOSED_PRE', label: 'Market Closed', voice: 'Market is closed.' };
  }
  if (nowMin >= SESSION_END) {
    return { id: 'CLOSED_POST', label: 'Market Closed for the Day', voice: 'Market is now closed for the day.' };
  }
  for (const s of SESSIONS) {
    if (nowMin >= toMin(s.start) && nowMin < toMin(s.end)) return s;
  }
  return { id: 'CLOSED', label: 'Market Closed', voice: 'Market is closed.' };
}

/** Compute next-event label for the countdown display. */
export function nextEventLabel(nowMin: number): string {
  const upcoming = SESSIONS.find((s) => toMin(s.start) > nowMin);
  if (nowMin < SESSION_START) return `Pre-open opens at 09:00 IST`;
  if (upcoming) {
    const mins = toMin(upcoming.start) - nowMin;
    return `${upcoming.label} in ${mins} min`;
  }
  if (nowMin < SESSION_END) return `Market closes at 16:15 IST`;
  return `Next pre-open at 09:00 IST tomorrow`;
}

/** Session phase for each segment: 'done' | 'current' | '' */
export function segmentPhase(session: Session, currentId: string, nowMin: number): 'done' | 'current' | '' {
  if (toMin(session.end) <= nowMin) return 'done';
  if (session.id === currentId) return 'current';
  return '';
}
