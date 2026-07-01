/**
 * sfx.ts — syntetizované zvukové efekty přes WebAudio API.
 * Žádné soubory, žádné sítě. Čistě procedurální.
 *
 * Použití:
 *   sfxPlay("dice", audioCtx);
 */

export type SoundId = "dice" | "coin_gain" | "coin_loss" | "race" | "newspaper" | "bankrupt"
  | "hoof_hover" | "engine_hover" | "hoof_move" | "engine_move"
  | "hoof_step" | "engine_step"
  | "countdown_tick" | "countdown_go"
  | "duel_nitro"
  | "auction_start" | "auction_tick";

// Cooldown guard — zabraňuje spamování (ms)
const COOLDOWNS: Record<SoundId, number> = {
  dice:           400,
  coin_gain:      150,
  coin_loss:      150,
  race:           600,
  newspaper:      300,
  bankrupt:       1200,
  auction_start:  3000,
  auction_tick:   850,
  hoof_hover:     350,
  engine_hover:   350,
  hoof_move:      500,
  engine_move:    500,
  hoof_step:      130,
  engine_step:    130,
  countdown_tick: 800,
  countdown_go:   1500,
  duel_nitro:     200,
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

// Jemný hover klapot — dva tiché úderky
function synthHoofHover(ctx: AudioContext): void {
  for (let i = 0; i < 2; i++) {
    const t = ctx.currentTime + i * 0.040;
    const size = Math.floor(ctx.sampleRate * 0.022);
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < size; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / size, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 550 - i * 80;
    filt.Q.value = 1.5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    src.start(t); src.stop(t + 0.08);
  }
}

// Krátký záblesk motoru při hoveru
function synthEngineHover(ctx: AudioContext): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(70, t);
  osc.frequency.exponentialRampToValueAtTime(115, t + 0.06);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0, t);
  gain.gain.linearRampToValueAtTime(0.09, t + 0.016);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.12);
}

// Cval — tři střídavé kopy
function synthHoofMove(ctx: AudioContext): void {
  for (let i = 0; i < 3; i++) {
    const t = ctx.currentTime + i * 0.095;
    const size = Math.floor(ctx.sampleRate * 0.028);
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < size; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / size, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 500 + (i % 2) * 120;
    filt.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.028);
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    src.start(t); src.stop(t + 0.1);
  }
}

// Krátký nastartování / rev motoru
function synthEngineMove(ctx: AudioContext): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(160, t + 0.14);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.28);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0, t);
  gain.gain.linearRampToValueAtTime(0.17, t + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.34);
  const sub = ctx.createOscillator();
  sub.type = "square";
  sub.frequency.setValueAtTime(40, t);
  sub.frequency.exponentialRampToValueAtTime(80, t + 0.14);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0, t);
  subGain.gain.linearRampToValueAtTime(0.07, t + 0.04);
  subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  sub.connect(subGain); subGain.connect(ctx.destination);
  sub.start(t); sub.stop(t + 0.28);
}

// Jeden krok koně — dvojklik (dva krátké noise hity ~45 ms od sebe)
function synthHoofStep(ctx: AudioContext): void {
  const base = ctx.currentTime;
  const r = () => Math.random();

  for (let i = 0; i < 2; i++) {
    const t = base + i * 0.045 + (r() * 2 - 1) * 0.005;
    const g = i === 0 ? 1.0 : 0.7;
    const size = Math.floor(ctx.sampleRate * 0.018);
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < size; j++) d[j] = (r() * 2 - 1) * Math.pow(1 - j / size, 5);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = (900 + r() * 200) * (1 + (r() * 2 - 1) * 0.05);
    filt.Q.value = 2.0;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.38 * g, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    src.start(t); src.stop(t + 0.03);
  }
}

// Jeden krok auta — pattern 4 hitů, každý s engine thump + click + exhaust noise
function synthEngineStep(ctx: AudioContext): void {
  const base = ctx.currentTime;
  const r = () => Math.random();

  // Čistý motor thump — 2 údery, sine sweep, bez šumu
  const hits: [number, number][] = [
    [0,     1.00],
    [0.120, 0.65],
  ];

  for (const [offset, gainScale] of hits) {
    const t = base + offset + (r() * 2 - 1) * 0.008;
    const fv = 1 + (r() * 2 - 1) * 0.04;
    const g  = gainScale * (1 + (r() * 2 - 1) * 0.08);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80 * fv, t);
    osc.frequency.exponentialRampToValueAtTime(42 * fv, t + 0.080);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18 * g, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.090);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.10);
  }
}

// Krátké ostré pípnutí pro countdown 3/2/1
function synthCountdownTick(ctx: AudioContext): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1100, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.06);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.32, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.09);
}

// Vzestupný čtyřtónový burst pro GO!
function synthCountdownGo(ctx: AudioContext): void {
  [440, 660, 880, 1100].forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.055;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.20, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.14);
  });
}

// Krátký whoosh pro nitro/boost aktivaci v Neon Rope Duelu
function synthDuelNitro(ctx: AudioContext): void {
  const t = ctx.currentTime;
  // Filtered noise sweep — stoupající "swoosh"
  const size = Math.floor(ctx.sampleRate * 0.10);
  const buf = ctx.createBuffer(1, size, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < size; i++) {
    const env = Math.sin((i / size) * Math.PI);
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(1200, t);
  hp.frequency.exponentialRampToValueAtTime(5000, t + 0.08);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
  src.connect(hp); hp.connect(gain); gain.connect(ctx.destination);
  src.start(t); src.stop(t + 0.12);
  // Tón — vzestupný sweep
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(1800, t + 0.08);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.13, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(oscGain); oscGain.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.11);
}

// Slavnostní cinkání při startu aukce — zvon s harmoniky, dlouhý dozvuk
function synthAuctionStart(ctx: AudioContext): void {
  // Tři harmoniky zvonu: základní tón + 2× vyšší
  const freqs = [880, 1760, 2640];
  const gains = [0.30, 0.15, 0.08];
  freqs.forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.01;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gains[i], t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 1.5);
  });
  // Druhé cinknutí po 0.35 s — jako dvojité cinkání
  const freqs2 = [1108, 2216];
  const gains2 = [0.18, 0.09];
  freqs2.forEach((freq, i) => {
    const t = ctx.currentTime + 0.35 + i * 0.01;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gains2[i], t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 1.1);
  });
}

// Krátké pípnutí pro poslední 3 sekundy aukce — vyšší než countdown_tick
function synthAuctionTick(ctx: AudioContext): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1400, t);
  osc.frequency.exponentialRampToValueAtTime(1100, t + 0.05);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.08);
}

// ─── Dispatch tabulka ─────────────────────────────────────────────────────────

const SYNTHS: Record<SoundId, (ctx: AudioContext) => void> = {
  dice:           synthDice,
  coin_gain:      synthCoinGain,
  coin_loss:      synthCoinLoss,
  race:           synthRace,
  newspaper:      synthNewspaper,
  bankrupt:       synthBankrupt,
  hoof_hover:     synthHoofHover,
  engine_hover:   synthEngineHover,
  hoof_move:      synthHoofMove,
  engine_move:    synthEngineMove,
  hoof_step:      synthHoofStep,
  engine_step:    synthEngineStep,
  countdown_tick: synthCountdownTick,
  countdown_go:   synthCountdownGo,
  duel_nitro:     synthDuelNitro,
  auction_start:  synthAuctionStart,
  auction_tick:   synthAuctionTick,
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
