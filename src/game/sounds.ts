import { useSettingsStore } from '../store/settingsStore';

/**
 * All sounds are synthesized with WebAudio — no audio assets to load.
 * The context is created lazily on first use (after a user gesture, so
 * autoplay policies are satisfied by the "Take your seat" click).
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!useSettingsStore.getState().soundEnabled) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Single decaying tone. */
function tone(
  ac: AudioContext,
  freq: number,
  opts: { type?: OscillatorType; at?: number; dur?: number; gain?: number } = {},
): void {
  const { type = 'sine', at = 0, dur = 0.18, gain = 0.08 } = opts;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Short filtered-noise burst (card swishes). */
function swish(ac: AudioContext, opts: { at?: number; dur?: number; gain?: number; freq?: number } = {}): void {
  const { at = 0, dur = 0.09, gain = 0.05, freq = 3200 } = opts;
  const t0 = ac.currentTime + at;
  const len = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.8;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
}

export const sounds = {
  /** Cards hitting the felt. */
  deal(): void {
    const ac = audio();
    if (!ac) return;
    swish(ac, { dur: 0.07, gain: 0.045 });
    swish(ac, { at: 0.06, dur: 0.07, gain: 0.035 });
  },
  /** Chips clacking into the pot. */
  chips(): void {
    const ac = audio();
    if (!ac) return;
    tone(ac, 2400, { type: 'square', dur: 0.03, gain: 0.025 });
    tone(ac, 2900, { type: 'square', at: 0.035, dur: 0.03, gain: 0.02 });
    tone(ac, 2600, { type: 'square', at: 0.07, dur: 0.025, gain: 0.015 });
  },
  /** Knuckle knock on the table. */
  check(): void {
    const ac = audio();
    if (!ac) return;
    tone(ac, 160, { type: 'sine', dur: 0.07, gain: 0.09 });
  },
  /** Cards sliding to the muck. */
  fold(): void {
    const ac = audio();
    if (!ac) return;
    swish(ac, { dur: 0.12, gain: 0.03, freq: 1800 });
  },
  /** Somebody shoved. */
  allIn(): void {
    const ac = audio();
    if (!ac) return;
    tone(ac, 196, { type: 'triangle', dur: 0.3, gain: 0.07 });
    tone(ac, 262, { type: 'triangle', at: 0.12, dur: 0.32, gain: 0.07 });
  },
  /** Hero drags the pot. */
  win(): void {
    const ac = audio();
    if (!ac) return;
    tone(ac, 523, { at: 0, dur: 0.28, gain: 0.05 });
    tone(ac, 659, { at: 0.09, dur: 0.28, gain: 0.05 });
    tone(ac, 784, { at: 0.18, dur: 0.4, gain: 0.055 });
  },
  /** Gentle nudge: it's your turn. */
  yourTurn(): void {
    const ac = audio();
    if (!ac) return;
    tone(ac, 880, { dur: 0.12, gain: 0.03 });
    tone(ac, 1174, { at: 0.08, dur: 0.16, gain: 0.025 });
  },
};
