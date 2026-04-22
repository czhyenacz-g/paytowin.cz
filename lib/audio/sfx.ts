/**
 * sfx.ts — syntetizované zvukové efekty přes WebAudio API.
 * Žádné soubory, žádné sítě. Čistě procedurální.
 *
 * Použití:
 *   sfxPlay("dice", audioCtx);
 */

export type SoundId = "dice" | "coin_gain" | "coin_loss" | "race" | "newspaper" | "bankrupt";

// Cooldown guard — zabraňuje spamování (ms)
const COOLDOWNS: Record<SoundId, number> = {
  dice:      400,
  coin_gain: 150,
  coin_loss: 150,
  race:      600,
  newspaper: 300,
  bankrupt:  1200,
};
const lastPlayed = new Map<SoundId, number>();

function canPlay(id: SoundId): boolean {
  const now = Date.now();
  return now - (lastPlayed.get(id) ?? 0) >= COOLDOWNS[id];
}

// ─── Syntetizéry ─────────────────────────────────────────────────────────────

function synthDice(ctx: AudioContext): void {
  for (let i = 0; i < 5; i++) {
    const t = ctx.currentTime + i * 0.055;
    const size = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < size; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / size, 4);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 700 + i * 120;
    filt.Q.value = 1.0;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    src.start(t); src.stop(t + 0.1);
  }
}

function synthCoinGain(ctx: AudioContext): void {
  [660, 880, 1100].forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.07;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.32);
  });
}

function synthCoinLoss(ctx: AudioContext): void {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(320, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.3);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.28, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.36);
}

function synthRace(ctx: AudioContext): void {
  // Fanfára — krátké vzestupné tóny
  [330, 415, 494, 659, 880].forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.065;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.12);
  });
}

function synthNewspaper(ctx: AudioContext): void {
  // Šustění papíru — filtrovaný šum s obálkou
  const size = Math.floor(ctx.sampleRate * 0.18);
  const buf = ctx.createBuffer(1, size, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < size; i++) {
    const env = Math.sin((i / size) * Math.PI);
    d[i] = (Math.random() * 2 - 1) * env * 0.6;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 3500;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 9000;
  const gain = ctx.createGain();
  gain.gain.value = 0.3;
  src.connect(hp); hp.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
  src.start();
}

function synthBankrupt(ctx: AudioContext): void {
  // Smutné sestupné tóny
  [440, 349, 262].forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.22;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.92, t + 0.28);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.42);
  });
}

// ─── Dispatch tabulka ─────────────────────────────────────────────────────────

const SYNTHS: Record<SoundId, (ctx: AudioContext) => void> = {
  dice:      synthDice,
  coin_gain: synthCoinGain,
  coin_loss: synthCoinLoss,
  race:      synthRace,
  newspaper: synthNewspaper,
  bankrupt:  synthBankrupt,
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function sfxPlay(id: SoundId, ctx: AudioContext): void {
  if (!canPlay(id)) return;
  lastPlayed.set(id, Date.now());
  try {
    SYNTHS[id](ctx);
  } catch {
    // Silently ignore — AudioContext může být suspendován
  }
}
