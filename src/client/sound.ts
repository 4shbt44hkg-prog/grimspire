// Procedural WebAudio soundscape — layered oscillators with envelopes,
// filtered noise, pitch drops, and a feedback-delay echo bus for space.
// No samples; everything is synthesized richer than the old bleeps.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let echoIn: GainNode | null = null;

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    // echo bus: delay -> soft lowpass -> feedback, mixed back in
    echoIn = ctx.createGain();
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.17;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const dampen = ctx.createBiquadFilter();
    dampen.type = "lowpass";
    dampen.frequency.value = 2200;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    echoIn.connect(delay);
    delay.connect(dampen);
    dampen.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(master);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  slideTo?: number;      // exponential glide target
  attack?: number;
  echo?: number;         // 0..1 send to the echo bus
  fat?: boolean;         // detuned twin oscillator for width
  delay?: number;        // schedule offset (s)
}

function tone(freq: number, dur: number, o: ToneOpts = {}) {
  try {
    const a = ac();
    const t0 = a.currentTime + (o.delay ?? 0);
    const vol = o.vol ?? 0.1;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (o.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(master!);
    if (o.echo) {
      const send = a.createGain();
      send.gain.value = o.echo;
      g.connect(send);
      send.connect(echoIn!);
    }
    const mk = (detune: number) => {
      const osc = a.createOscillator();
      osc.type = o.type ?? "sine";
      osc.frequency.setValueAtTime(freq, t0);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(25, o.slideTo), t0 + dur);
      osc.detune.value = detune;
      osc.connect(g);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    };
    mk(0);
    if (o.fat) mk(9);
  } catch { /* audio unavailable */ }
}

interface NoiseOpts {
  vol?: number;
  filter?: BiquadFilterType;
  from?: number;         // filter frequency start
  to?: number;           // filter frequency end
  q?: number;
  echo?: number;
  attack?: number;
  delay?: number;
}

function noise(dur: number, o: NoiseOpts = {}) {
  try {
    const a = ac();
    const t0 = a.currentTime + (o.delay ?? 0);
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur) + 1, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = o.filter ?? "lowpass";
    f.frequency.setValueAtTime(o.from ?? 800, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t0 + dur);
    f.Q.value = o.q ?? 0.8;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol ?? 0.1, t0 + (o.attack ?? 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master!);
    if (o.echo) {
      const send = a.createGain();
      send.gain.value = o.echo;
      g.connect(send);
      send.connect(echoIn!);
    }
    src.start(t0);
  } catch { /* audio unavailable */ }
}

// low percussive body: fast pitch drop
function thump(f0: number, f1: number, dur: number, vol: number, delay = 0) {
  tone(f0, dur, { type: "sine", vol, slideTo: f1, attack: 0.004, delay });
}

// small metallic partial stack
function chime(base: number, vol: number, dur = 0.5, echo = 0.4, delay = 0) {
  tone(base, dur, { vol, echo, attack: 0.004, delay });
  tone(base * 1.5, dur * 0.8, { vol: vol * 0.5, echo, attack: 0.004, delay });
  tone(base * 2.01, dur * 0.6, { vol: vol * 0.3, echo, attack: 0.004, delay });
}

export const SFX = {
  swing: () => {
    noise(0.14, { filter: "bandpass", from: 700, to: 2600, q: 1.6, vol: 0.09 });
  },
  hit: () => {
    thump(170, 62, 0.14, 0.2);
    noise(0.09, { from: 1100, to: 300, vol: 0.14 });
  },
  hurt: () => {
    thump(230, 95, 0.16, 0.16);
    tone(190, 0.18, { type: "sawtooth", vol: 0.05, slideTo: 110 });
  },
  shoot: () => {
    tone(640, 0.16, { type: "sawtooth", vol: 0.045, slideTo: 220, fat: true });
    noise(0.08, { filter: "highpass", from: 1800, vol: 0.03 });
  },
  boom: () => {
    thump(95, 34, 0.5, 0.24);
    noise(0.5, { from: 900, to: 120, vol: 0.16, echo: 0.5 });
  },
  nova: () => {
    tone(980, 0.35, { type: "sine", vol: 0.08, slideTo: 240, echo: 0.5, fat: true });
    noise(0.3, { filter: "bandpass", from: 1400, to: 300, q: 2, vol: 0.07, echo: 0.4 });
  },
  die: () => {
    tone(150, 0.4, { type: "sawtooth", vol: 0.08, slideTo: 55 });
    noise(0.3, { from: 500, to: 90, vol: 0.09 });
    thump(120, 45, 0.3, 0.1);
  },
  pickup: () => {
    tone(520, 0.14, { type: "triangle", vol: 0.07, attack: 0.003, echo: 0.2 });
    tone(780, 0.12, { type: "triangle", vol: 0.045, attack: 0.003, delay: 0.03 });
  },
  gold: () => {
    chime(2650, 0.05, 0.22, 0.25);
    chime(3400, 0.035, 0.18, 0.2, 0.04);
  },
  potion: () => {
    // a couple of soft "glugs" then a satisfied shimmer
    thump(300, 210, 0.1, 0.08);
    thump(260, 180, 0.1, 0.08, 0.09);
    noise(0.14, { from: 500, to: 240, vol: 0.05, delay: 0.02 });
    tone(660, 0.25, { vol: 0.035, echo: 0.3, delay: 0.18 });
  },
  levelup: () => {
    const notes = [440, 554, 659, 880];
    notes.forEach((f, i) => {
      tone(f, 0.6, { type: "sawtooth", vol: 0.05, fat: true, echo: 0.55, attack: 0.02, delay: i * 0.1 });
      tone(f * 2, 0.5, { vol: 0.025, echo: 0.5, delay: i * 0.1 + 0.02 });
    });
    noise(0.7, { filter: "highpass", from: 3500, vol: 0.02, echo: 0.5, attack: 0.2, delay: 0.25 });
  },
  transmute: () => {
    [320, 480, 640, 960].forEach((f, i) => {
      tone(f, 0.3, { vol: 0.06, echo: 0.5, fat: true, delay: i * 0.07 });
    });
    noise(0.5, { filter: "bandpass", from: 800, to: 2600, q: 2, vol: 0.05, echo: 0.5, delay: 0.1 });
  },
  chest: () => {
    thump(190, 120, 0.1, 0.12);
    thump(150, 95, 0.12, 0.12, 0.09);
    chime(1900, 0.04, 0.35, 0.4, 0.16);
  },
  playerdie: () => {
    tone(220, 0.9, { type: "sawtooth", vol: 0.1, slideTo: 42, fat: true, echo: 0.5 });
    noise(0.7, { from: 700, to: 80, vol: 0.1, echo: 0.4 });
    thump(110, 30, 0.8, 0.16, 0.1);
  },
  teleport: () => {
    tone(320, 0.3, { vol: 0.07, slideTo: 1250, echo: 0.5, fat: true });
    noise(0.25, { filter: "highpass", from: 900, vol: 0.04, echo: 0.4 });
  },
  shrine: () => {
    chime(880, 0.06, 0.7, 0.55);
    chime(1174, 0.045, 0.6, 0.5, 0.12);
    chime(1568, 0.035, 0.5, 0.5, 0.24);
  },
  error: () => {
    tone(150, 0.12, { type: "square", vol: 0.045, slideTo: 120 });
  },
  socket: () => {
    thump(500, 320, 0.06, 0.08);
    chime(1320, 0.05, 0.4, 0.4, 0.05);
  },
};
