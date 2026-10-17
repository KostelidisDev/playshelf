/* The sound of the Halloween jump scare, made with the Web Audio API rather
 * than shipped as a file: a burst of noise, a shriek of detuned sawtooths
 * sliding down, and a low boom underneath. Browsers only let a page make
 * sound after the visitor has interacted with it, so a scare that comes by
 * itself before then is silent; that's fine, the face does the work. */

const LENGTH = 1.3;

export function shriek(): void {
  if (typeof AudioContext === "undefined") return;
  try {
    const ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    const t = ctx.currentTime;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    out.gain.exponentialRampToValueAtTime(0.0001, t + LENGTH);
    out.connect(ctx.destination);

    for (const detune of [-40, 0, 35]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(1600, t);
      osc.frequency.exponentialRampToValueAtTime(320, t + LENGTH);
      osc.connect(out);
      osc.start(t);
      osc.stop(t + LENGTH);
    }

    const boom = ctx.createOscillator();
    boom.frequency.setValueAtTime(90, t);
    boom.frequency.exponentialRampToValueAtTime(30, t + LENGTH);
    boom.connect(out);
    boom.start(t);
    boom.stop(t + LENGTH);

    const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
    const hiss = ctx.createBufferSource();
    hiss.buffer = noise;
    hiss.connect(out);
    hiss.start(t);

    boom.onended = () => void ctx.close().catch(() => {});
  } catch {
    // No sound is better than a broken page.
  }
}
