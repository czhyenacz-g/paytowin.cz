/**
 * scheduleMorseAudio — naplánuje přehrání morseovky na WebAudio timeline.
 *
 * Timing (UNIT = 35 ms):
 *   dit = 1 UNIT, dah = 3 UNIT, inter-element gap = 1 UNIT,
 *   inter-letter gap = 3 UNIT, inter-word gap = 7 UNIT.
 */
export function scheduleMorseAudio(ctx: AudioContext, morse: string): void {
  const UNIT = 0.035; // 35 ms
  const FREQ = 660;
  const VOL  = 0.22;
  let t = ctx.currentTime + 0.05;

  function beep(dur: number) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = FREQ;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(VOL, t + 0.004);
    gain.gain.setValueAtTime(VOL, t + dur - 0.004);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.01);
    t += dur + UNIT; // symbol + inter-element gap
  }

  const words = morse.split("  /  ");
  for (let wi = 0; wi < words.length; wi++) {
    const letters = words[wi].split(" ");
    for (let li = 0; li < letters.length; li++) {
      for (const sym of letters[li]) {
        if (sym === "·") beep(UNIT);
        else if (sym === "−") beep(3 * UNIT);
      }
      if (li < letters.length - 1) t += 2 * UNIT; // inter-letter = 3 UNIT total
    }
    if (wi < words.length - 1) t += 6 * UNIT; // inter-word = 7 UNIT total
  }
}
