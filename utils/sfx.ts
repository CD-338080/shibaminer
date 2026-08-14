export type SfxName = 'click' | 'success' | 'claim' | 'nav';

type Tone = { freq: number; duration: number; type?: OscillatorType; gain?: number };

const SFX: Record<SfxName, Tone[]> = {
  click: [{ freq: 520, duration: 0.05, type: 'square', gain: 0.04 }],
  nav: [{ freq: 640, duration: 0.04, type: 'triangle', gain: 0.035 }],
  success: [
    { freq: 523, duration: 0.08, type: 'sine', gain: 0.05 },
    { freq: 659, duration: 0.1, type: 'sine', gain: 0.05 },
  ],
  claim: [
    { freq: 440, duration: 0.07, type: 'triangle', gain: 0.06 },
    { freq: 660, duration: 0.09, type: 'triangle', gain: 0.06 },
    { freq: 880, duration: 0.12, type: 'triangle', gain: 0.05 },
  ],
};

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

function playTone(ctx: AudioContext, tone: Tone, when: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tone.type ?? 'sine';
  osc.frequency.value = tone.freq;
  const peak = tone.gain ?? 0.05;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + tone.duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + tone.duration + 0.02);
}

export function playSfx(name: SfxName) {
  try {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('sfxEnabled') === 'false') return;
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const tones = SFX[name];
    if (!tones) return;
    let t = ctx.currentTime;
    for (const tone of tones) {
      playTone(ctx, tone, t);
      t += tone.duration * 0.85;
    }
  } catch {
    // Ignore audio failures (autoplay policies, etc.)
  }
}
