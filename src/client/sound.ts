// Tiny procedural WebAudio synth — hits, pickups, level-ups, transmutes.
let ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function blip(freq: number, dur: number, type: OscillatorType, vol = 0.12, slide = 0) {
  try {
    const a = ac();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
  } catch { /* audio unavailable */ }
}

function noise(dur: number, vol = 0.1, low = 400) {
  try {
    const a = ac();
    const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = low;
    const g = a.createGain();
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start();
  } catch { /* audio unavailable */ }
}

export const SFX = {
  swing: () => { noise(0.08, 0.06, 1200); },
  hit: () => { noise(0.09, 0.12, 500); blip(120, 0.08, "square", 0.08, -60); },
  hurt: () => { blip(180, 0.15, "sawtooth", 0.1, -100); },
  shoot: () => { blip(600, 0.12, "square", 0.06, -350); },
  boom: () => { noise(0.3, 0.18, 300); blip(70, 0.3, "sine", 0.15, -40); },
  nova: () => { blip(900, 0.25, "sine", 0.08, -700); noise(0.2, 0.06, 900); },
  die: () => { blip(200, 0.3, "sawtooth", 0.1, -160); noise(0.2, 0.08, 400); },
  pickup: () => { blip(700, 0.07, "square", 0.07, 200); },
  gold: () => { blip(1100, 0.06, "square", 0.06, 300); blip(1400, 0.06, "square", 0.05, 200); },
  potion: () => { blip(400, 0.15, "sine", 0.1, 220); },
  levelup: () => { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => blip(f, 0.25, "triangle", 0.12), i * 90)); },
  transmute: () => { [300, 450, 600, 900].forEach((f, i) => setTimeout(() => blip(f, 0.18, "sine", 0.09, 100), i * 60)); },
  chest: () => { blip(300, 0.12, "square", 0.08, 80); setTimeout(() => blip(500, 0.12, "square", 0.07, 100), 90); },
  playerdie: () => { blip(300, 0.8, "sawtooth", 0.14, -240); noise(0.6, 0.1, 250); },
  teleport: () => { blip(1200, 0.2, "sine", 0.08, -800); },
  shrine: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.3, "triangle", 0.09), i * 70)); },
  error: () => { blip(160, 0.12, "square", 0.07, -30); },
  socket: () => { blip(880, 0.1, "square", 0.08, 60); setTimeout(() => blip(1320, 0.12, "square", 0.06), 70); },
};
