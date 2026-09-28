/**
 * voice.ts — Web Speech API wrapper with mute support and first-click gate.
 * Prefers a female English voice. Falls back to any English voice, then the
 * browser default.
 */

let muted = false;
let soundEnabled = false; // requires a user gesture first (autoplay policy)
let selectedVoice: SpeechSynthesisVoice | null = null;

/**
 * Female voice keywords used to rank candidates.
 * Covers Google, Microsoft (Windows), Apple (macOS/iOS) and eSpeak names.
 */
const FEMALE_KEYWORDS = [
  'female', 'woman',
  'samantha',           // macOS default female
  'victoria',           // macOS
  'karen',              // macOS Australian
  'moira',              // macOS Irish
  'veena',              // macOS Indian English
  'zira',               // Windows (Microsoft Zira)
  'hazel',              // Windows (Microsoft Hazel)
  'susan',              // Windows
  'google uk english female',
  'google us english',  // Google US is female on most platforms
];

function pickFemaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // 1. Exact female keyword match on an English voice
  for (const kw of FEMALE_KEYWORDS) {
    const match = voices.find(
      (v) => v.lang.startsWith('en') && v.name.toLowerCase().includes(kw),
    );
    if (match) return match;
  }

  // 2. Any English voice (often female on mobile browsers)
  const anyEn = voices.find((v) => v.lang.startsWith('en'));
  if (anyEn) return anyEn;

  // 3. Browser default
  return voices[0] ?? null;
}

/** Call once after the first user gesture so the voice list is populated. */
function ensureVoice(): void {
  if (selectedVoice) return;
  selectedVoice = pickFemaleVoice();
  // voiceschanged fires asynchronously on some browsers — retry then
  if (!selectedVoice) {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      selectedVoice = pickFemaleVoice();
    }, { once: true });
  }
}

export function isMuted(): boolean { return muted; }
export function isSoundEnabled(): boolean { return soundEnabled; }

export function enableSound(): void {
  soundEnabled = true;
  ensureVoice();
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

export function setMuted(v: boolean): void { muted = v; }

export function speak(text: string): void {
  if (muted || !soundEnabled) return;
  if (!('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.1;   // slightly higher pitch reinforces a female timbre
    if (selectedVoice) u.voice = selectedVoice;
    window.speechSynthesis.speak(u);
  } catch {
    // swallow — TTS is best-effort
  }
}
