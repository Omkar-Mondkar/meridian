/**
 * sky.ts — Solar position + sky gradient engine.
 * Pure math, no React, no DOM. Drop in anywhere.
 *
 * Algorithm: simplified NOAA solar position formulas — accurate to a fraction
 * of a degree, more than sufficient for a background gradient.
 */

import type { TimeParts } from './timeSync';

// Mumbai, IST — override via config if the desk is elsewhere.
export const DEFAULT_LAT = 19.076;
export const DEFAULT_LON = 72.8777;
export const DEFAULT_TZ_OFFSET = 5.5; // IST = UTC+5:30

export interface SkyState {
  gradient: string;
  elevation: number; // degrees
  phaseLabel: string;
  isSun: boolean;     // true = sun visible, false = moon
  sunTopPct: number;  // CSS top% for the sun/moon glyph
}

/* ---- Gradient keyframe table calibrated for control-room legibility ---- */
interface Stop {
  el: number;
  c: [string, string, string];
}

const STOPS: Stop[] = [
  // Deep night
  { el: -90,   c: ['#020407', '#040810', '#08101E'] },
  // Astronomical twilight
  { el: -18,   c: ['#050912', '#0C1226', '#141A34'] },
  // Nautical twilight
  { el: -12,   c: ['#0C1228', '#1E1740', '#32194A'] },
  // Civil twilight / deep dusk
  { el: -6,    c: ['#1C1640', '#4A1E42', '#732840'] },
  // Sunrise / Sunset horizon glow
  { el: -0.83, c: ['#2C1E50', '#7A3050', '#B04A38'] },
  // Golden hour — warm amber sky
  { el: 6,     c: ['#1E3A6A', '#6B4E28', '#D4843A'] },
  // Blue hour / early day
  { el: 12,    c: ['#1A4A8A', '#3A7AC8', '#87BEEA'] },
  // Full day — vibrant sky blue
  { el: 20,    c: ['#186DBE', '#3698E8', '#86CEF8'] },
  // Noon peak — bright luminous azure
  { el: 40,    c: ['#1674C8', '#38A0F2', '#96D7FA'] },
  // High sun — clear radiant daytime blue
  { el: 90,    c: ['#186DBE', '#3698E8', '#86CEF8'] },
];

const PHASE_LABELS: Array<{ el: number; label: string }> = [
  { el: -90,    label: 'Night' },
  { el: -18,    label: 'Astronomical Twilight' },
  { el: -12,    label: 'Nautical Twilight' },
  { el: -6,     label: 'Civil Twilight' },
  { el: -0.83,  label: 'Sunrise / Sunset' },
  { el: 6,      label: 'Golden Hour' },
  { el: 20,     label: 'Full Day' },
];

/* ---- Colour helpers ---- */
function hexToRgb(h: string): { r: number; g: number; b: number } {
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lerpHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return `rgb(${Math.round(A.r + (B.r - A.r) * t)},${Math.round(A.g + (B.g - A.g) * t)},${Math.round(A.b + (B.b - A.b) * t)})`;
}

/** Compute a CSS linear-gradient string for a given solar elevation (degrees). */
export function gradientForElevation(el: number): string {
  let lo = STOPS[0];
  let hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (el >= STOPS[i].el && el <= STOPS[i + 1].el) {
      lo = STOPS[i];
      hi = STOPS[i + 1];
      break;
    }
  }
  if (el <= STOPS[0].el) { lo = hi = STOPS[0]; }
  if (el >= STOPS[STOPS.length - 1].el) { lo = hi = STOPS[STOPS.length - 1]; }

  const t = Math.min(1, Math.max(0, (el - lo.el) / ((hi.el - lo.el) || 1)));
  return [
    `linear-gradient(180deg,`,
    `${lerpHex(lo.c[0], hi.c[0], t)} 0%,`,
    `${lerpHex(lo.c[1], hi.c[1], t)} 55%,`,
    `${lerpHex(lo.c[2], hi.c[2], t)} 100%)`,
  ].join(' ');
}

/** Human-readable phase label for a given elevation. */
export function phaseForElevation(el: number): string {
  let label = PHASE_LABELS[0].label;
  for (const p of PHASE_LABELS) {
    if (el >= p.el) label = p.label;
  }
  return label;
}

/**
 * Compute solar elevation in degrees.
 * Algorithm: simplified NOAA formulas (Design Doc §5.2).
 */
export function solarElevationDeg(
  parts: TimeParts,
  lat: number = DEFAULT_LAT,
  lon: number = DEFAULT_LON,
  tzOffsetHours: number = DEFAULT_TZ_OFFSET,
): number {
  const rad = Math.PI / 180;
  const dayOfYear = Math.floor(
    (Date.UTC(parts.year, parts.month - 1, parts.day) - Date.UTC(parts.year, 0, 0)) / 86_400_000,
  );
  const hourFrac = parts.hour + parts.minute / 60 + parts.second / 3600;
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (hourFrac - 12) / 24);

  const eqTime =
    229.18 * (
      0.000075
      + 0.001868 * Math.cos(gamma)
      - 0.032077 * Math.sin(gamma)
      - 0.014615 * Math.cos(2 * gamma)
      - 0.040849 * Math.sin(2 * gamma)
    );

  const decl =
    0.006918
    - 0.399912 * Math.cos(gamma)
    + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma)
    + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma)
    + 0.00148  * Math.sin(3 * gamma);

  const timeOffset = eqTime + 4 * lon - 60 * tzOffsetHours;
  const minutesOfDay = parts.hour * 60 + parts.minute + parts.second / 60;
  const trueSolarTime = minutesOfDay + timeOffset;
  const hourAngle = (trueSolarTime / 4 - 180) * rad;
  const latRad = lat * rad;
  const elevRad = Math.asin(
    Math.sin(latRad) * Math.sin(decl)
    + Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle),
  );
  return elevRad / rad;
}

/** Derive the full SkyState from a solar elevation. */
export function skyStateFromElevation(el: number): SkyState {
  const isSun = el > -0.83;
  const glow = Math.max(0.15, 1 - Math.abs(el) / 40);
  const warm = isSun ? Math.max(0, 1 - el / 25) : 0;

  let sunBg: string;
  let sunShadow: string;
  if (isSun) {
    sunBg = `radial-gradient(circle, ${lerpHex('#FFE9B0', '#FFA76B', warm)}, ${lerpHex('#FFC24D', '#FF7A45', warm)})`;
    sunShadow = `0 0 ${18 + glow * 26}px ${18 + glow * 26}px rgba(255,180,90,${0.10 + glow * 0.10})`;
  } else {
    sunBg = 'radial-gradient(circle, #E9EDF5, #B9C4D6)';
    sunShadow = `0 0 ${14 + glow * 18}px ${10 + glow * 14}px rgba(180,200,230,0.10)`;
  }

  return {
    gradient: gradientForElevation(el),
    elevation: el,
    phaseLabel: phaseForElevation(el),
    isSun,
    sunTopPct: Math.min(94, Math.max(6, 50 - el * 0.9)),
  };
}

// Re-export lerpHex for use in sun/moon colour computation in components
export { lerpHex };
