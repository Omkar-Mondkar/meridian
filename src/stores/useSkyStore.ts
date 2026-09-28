/**
 * useSkyStore — Sky gradient state.
 * Recomputes every 60 seconds (or on preview changes).
 */
import { create } from 'zustand';
import { solarElevationDeg, skyStateFromElevation, type SkyState } from '../engines/sky';
import { getISTParts, type TimeParts } from '../engines/timeSync';
import { DEFAULT_LAT, DEFAULT_LON, DEFAULT_TZ_OFFSET } from '../engines/sky';

interface SkyStore extends SkyState {
  previewMode: boolean;
  previewMinute: number; // 0-1439
  fastTransition: boolean;
  setPreviewMinute: (m: number) => void;
  setLive: () => void;
  recompute: (parts?: TimeParts) => void;
}

function compute(parts: TimeParts): SkyState {
  const el = solarElevationDeg(parts, DEFAULT_LAT, DEFAULT_LON, DEFAULT_TZ_OFFSET);
  return skyStateFromElevation(el);
}

const initialParts = getISTParts();
const initialState = compute(initialParts);

export const useSkyStore = create<SkyStore>((set, get) => ({
  ...initialState,
  previewMode: false,
  previewMinute: 480,
  fastTransition: false,

  setPreviewMinute: (m: number) => {
    const parts = getISTParts();
    parts.hour = Math.floor(m / 60);
    parts.minute = m % 60;
    parts.second = 0;
    const state = compute(parts);
    set({ ...state, previewMode: true, previewMinute: m, fastTransition: true });
  },

  setLive: () => {
    const parts = getISTParts();
    const state = compute(parts);
    set({ ...state, previewMode: false, fastTransition: false });
  },

  recompute: (parts?: TimeParts) => {
    if (get().previewMode) return;
    const p = parts ?? getISTParts();
    const state = compute(p);
    set({ ...state });
  },
}));
