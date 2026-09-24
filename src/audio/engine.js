// ─────────────────────────────────────────────────────────────────────────────
//  Audio engine
//  • Buses: voice (close-mic), phone (band-limited line), room (reverb), sfx
//  • Procedural WebAudio SFX for everything, so the game is fully playable
//    with zero assets. Baked neural SFX (tools/sfx) override them when present.
//  • A "body" layer that reacts to the player's state: drunk muffling,
//    heartbeat when wired, ringing ears.
// ─────────────────────────────────────────────────────────────────────────────

const rand = (a, b) => a + Math.random() * (b - a);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.baked = {};
    this.bakedBuffers = new Map();
  }

  async init() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    await ctx.resume();

    // master → "body" lowpass (drunk muffle) → compressor → out
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.bodyFilter = ctx.createBiquadFilter();
    this.bodyFilter.type = 'lowpass';
    this.bodyFilter.frequency.value = 20000;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 3;
    this.master.connect(this.bodyFilter).connect(this.comp).connect(ctx.destination);

    // Room reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.2, 2.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);

    this.sfxBus = this._bus(0.8, 0.18);
    this.roomBus = this._bus(0.9, 0.55); // boss / coworkers, far & wet
    this.voiceBus = this._bus(1.0, 0.04); // your own voice, dry
    this.ambBus = this._bus(0.35, 0.2);

    // Telephone line: HPF 300 → LPF 3400 → presence bump → soft clip
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 320;
    hp.Q.value = 0.8;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3300;
    lp.Q.value = 0.9;
    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 1800;
    peak.gain.value = 5;
    const shaper = ctx.createWaveShaper();
    shaper.curve = this._softClip(3.5);
    this.phoneIn = ctx.createGain();
    this.phoneIn.gain.value = 1.4;
    this.phoneOut = ctx.createGain();
    this.phoneOut.gain.value = 0.75;
    this.phoneIn.connect(hp).connect(lp).connect(peak).connect(shaper).connect(this.phoneOut);
    this.phoneOut.connect(this.master);
    const phoneRoom = ctx.createGain();
    phoneRoom.gain.value = 0.03;
    this.phoneOut.connect(phoneRoom).connect(this.reverbSend);

    // Line hiss while a call is connected
    this.lineHiss = ctx.createGain();
    this.lineHiss.gain.value = 0;
    this._noiseSource(this.lineHiss, 'pink', true);
    this.lineHiss.connect(this.phoneIn);

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.phoneOut.connect(this.analyser);
    this.voiceBus.connect(this.analyser);

    this._noiseBuf = this._makeNoise(2);
    this._pinkBuf = this._makeNoise(2, 'pink');
    this._brownBuf = this._makeNoise(4, 'brown');

    this._startAmbience();
    this._startHeart();
    this.loadBaked();
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  _bus(gain, wet) {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(this.master);
    const s = this.ctx.createGain();
    s.gain.value = wet;
    g.connect(s).connect(this.reverbSend);
    return g;
  }

  _softClip(k) {
    const n = 1024;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return c;
  }

  _impulse(secs, decay) {
    const { ctx } = this;
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // early reflections + diffuse tail
        const er = i < ctx.sampleRate * 0.08 && Math.random() < 0.004 ? rand(-1, 1) * 0.8 : 0;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * 0.5 + er;
      }
    }
    return buf;
  }

  _makeNoise(secs, color = 'white') {
    const { ctx } = this;
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      } else if (color === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  _noiseSource(dest, color = 'white', loop = false, when = 0, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = color === 'pink' ? this._pinkBuf || this._makeNoise(2, 'pink') : color === 'brown' ? this._brownBuf : this._noiseBuf || this._makeNoise(2);
    src.loop = loop || (dur && dur > src.buffer.duration);
    src.connect(dest);
    src.start(this.ctx.currentTime + when, Math.random() * 0.5);
    if (dur) src.stop(this.ctx.currentTime + when + dur);
    return src;
  }

  _osc(type, freq, dest, when = 0, dur = 1) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(dest);
    o.start(this.ctx.currentTime + when);
    o.stop(this.ctx.currentTime + when + dur + 0.05);
    return o;
  }

  _env(dest, when, a, peak, hold, rel) {
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
    g.connect(dest);
    return g;
  }

  _filter(type, freq, q, dest) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q !== undefined) f.Q.value = q;
    f.connect(dest);
    return f;
  }

  // ── baked (neural) SFX override ───────────────────────────────────────────
  async loadBaked() {
    try {
      const res = await fetch('audio/sfx/manifest.json');
      if (!res.ok) return;
      const m = await res.json();
      this.baked = m.sfx || {};
      if (this.baked.ambience) {
        // a baked room tone replaces the synthesized murmur
        const src = await this._playBaked('ambience', this.ambBus, 0.8);
        if (src) {
          src.loop = true;
          this.murmur.gain.value = 0.05;
        }
      }
    } catch {
      /* none baked; procedural it is */
    }
  }

  async _playBaked(id, bus, gain = 1) {
    const entry = this.baked[id];
    if (!entry) return false;
    let buf = this.bakedBuffers.get(id);
    if (!buf) {
      const data = await fetch('audio/sfx/' + entry.file).then((r) => r.arrayBuffer());
      buf = await this.ctx.decodeAudioData(data);
      this.bakedBuffers.set(id, buf);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(bus);
    src.start();
    return src;
  }

  // ── public: play a named effect ───────────────────────────────────────────
  play(id, opts = {}) {
    if (!this.ctx) return;
    if (this.baked[id] && !opts.procedural) {
      const bus = opts.phone || id === 'ringback' || id === 'busy' ? this.phoneIn : id === 'gong' || id === 'cheer' ? this.roomBus : this.sfxBus;
      this._playBaked(id, bus, opts.gain ?? 1);
      return;
    }
    const fn = this['_' + id];
    if (fn) return fn.call(this, opts);
  }

  // Phone bell (two metallic bells hammered at 20 Hz)
  _phone_ring({ far = false } = {}) {
    const out = this.ctx.createGain();
    out.gain.value = far ? 0.05 : 0.22;
    out.connect(far ? this.roomBus : this.sfxBus);
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 20;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.5;
    const trem = this.ctx.createGain();
    trem.gain.value = 0.5;
    lfo.connect(lfoGain).connect(trem.gain);
    trem.connect(out);
    const env = this._env(trem, 0, 0.01, 1, 1.6, 0.25);
    for (const f of [1175, 1480, 2390, 3150]) this._osc('sine', f * rand(0.995, 1.005), env, 0, 2);
    lfo.start();
    lfo.stop(this.ctx.currentTime + 2);
  }

  _ringback() {
    const env = this._env(this.phoneIn, 0, 0.02, 0.12, 1.9, 0.05);
    this._osc('sine', 440, env, 0, 2);
    this._osc('sine', 480, env, 0, 2);
  }

  _busy() {
    for (let i = 0; i < 4; i++) {
      const env = this._env(this.phoneIn, i * 0.5, 0.01, 0.1, 0.23, 0.02);
      this._osc('sine', 480, env, i * 0.5, 0.3);
      this._osc('sine', 620, env, i * 0.5, 0.3);
    }
  }

  _dial({ digits = '5558675309' } = {}) {
    const rows = [697, 770, 852, 941];
    const cols = [1209, 1336, 1477];
    const map = '123456789*0#';
    [...digits].forEach((d, i) => {
      const k = Math.max(0, map.indexOf(d));
      const t = i * 0.11 + (i > 2 ? 0.08 : 0) + (i > 5 ? 0.08 : 0);
      const env = this._env(this.sfxBus, t, 0.005, 0.05, 0.06, 0.01);
      this._osc('sine', rows[Math.floor(k / 3)], env, t, 0.08);
      this._osc('sine', cols[k % 3], env, t, 0.08);
    });
    return digits.length * 0.11 + 0.3;
  }

  _click(bus = this.sfxBus, when = 0, gain = 0.6, freq = 2500) {
    const env = this._env(bus, when, 0.001, gain, 0.005, 0.04);
    this._noiseSource(this._filter('bandpass', freq, 1.5, env), 'white', false, when, 0.06);
  }

  _thunk(when = 0, gain = 0.5, freq = 120) {
    const env = this._env(this.sfxBus, when, 0.002, gain, 0.01, 0.15);
    const o = this._osc('sine', freq * 1.6, env, when, 0.2);
    o.frequency.exponentialRampToValueAtTime(freq, this.ctx.currentTime + when + 0.1);
  }

  _pickup() {
    this._click(this.sfxBus, 0, 0.4, 1800);
    this._thunk(0.02, 0.25, 180);
    this._click(this.sfxBus, 0.12, 0.2, 3500);
  }

  _hangup() {
    this._click(this.sfxBus, 0, 0.9, 1200);
    this._thunk(0, 0.8, 90);
    this._click(this.sfxBus, 0.05, 0.4, 2800);
  }

  _ui() {
    this._click(this.sfxBus, 0, 0.15, 4000);
  }

  _hover() {
    this._click(this.sfxBus, 0, 0.04, 6000);
  }

  _beer_open() {
    // sharp pop
    const pop = this._env(this.sfxBus, 0, 0.001, 1.0, 0.004, 0.05);
    this._noiseSource(this._filter('highpass', 2500, 0.7, pop), 'white', false, 0, 0.07);
    this._thunk(0, 0.2, 400);
    // carbonation fizz with crackles
    const fizz = this._env(this.sfxBus, 0.02, 0.02, 0.35, 0.3, 1.6);
    this._noiseSource(this._filter('highpass', 5000, 0.5, fizz), 'white', false, 0.02, 2.2);
    for (let i = 0; i < 40; i++) this._click(this.sfxBus, 0.05 + Math.random() * 1.8, rand(0.02, 0.09), rand(3000, 9000));
  }

  _beer_gulp() {
    for (let i = 0; i < 3; i++) {
      const t = 0.35 + i * 0.42;
      const env = this._env(this.sfxBus, t, 0.01, 0.6, 0.05, 0.16);
      const lp = this._filter('lowpass', 600, 4, env);
      const o = this._osc('sine', 320, lp, t, 0.3);
      o.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + t + 0.2);
      this._noiseSource(this._filter('bandpass', 400, 3, env), 'pink', false, t, 0.25);
    }
    // "ahhh"
    const ah = this._env(this.voiceBus, 1.7, 0.05, 0.25, 0.3, 0.5);
    const f1 = this._filter('bandpass', 750, 6, ah);
    const f2 = this._filter('bandpass', 1200, 8, ah);
    const src = this._osc('sawtooth', 115, f1, 1.7, 0.9);
    src.connect(f2);
    src.frequency.linearRampToValueAtTime(95, this.ctx.currentTime + 2.6);
    this._noiseSource(this._filter('bandpass', 1500, 1, ah), 'white', false, 1.7, 0.9);
  }

  _burp() {
    const env = this._env(this.voiceBus, 0, 0.03, 0.5, 0.35, 0.2);
    const f = this._filter('bandpass', 480, 3, env);
    const o = this._osc('sawtooth', 78, f, 0, 0.7);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 28;
    const lg = this.ctx.createGain();
    lg.gain.value = 18;
    lfo.connect(lg).connect(o.frequency);
    lfo.start();
    lfo.stop(this.ctx.currentTime + 0.7);
    o.frequency.linearRampToValueAtTime(60, this.ctx.currentTime + 0.55);
  }

  _sniff() {
    for (const [t, len, g] of [[0, 0.9, 0.9], [1.05, 0.25, 0.5]]) {
      const env = this.ctx.createGain();
      const now = this.ctx.currentTime + t;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(g, now + len * 0.85);
      env.gain.exponentialRampToValueAtTime(0.0001, now + len);
      env.connect(this.voiceBus);
      const bp = this._filter('bandpass', 1800, 1.2, env);
      bp.frequency.setValueAtTime(1200, now);
      bp.frequency.linearRampToValueAtTime(4200, now + len);
      this._noiseSource(bp, 'white', false, t, len + 0.05);
    }
  }

  _heartbeat({ gain = 0.7 } = {}) {
    for (const [t, g] of [[0, 1], [0.16, 0.65]]) {
      const env = this._env(this.sfxBus, t, 0.005, gain * g, 0.02, 0.18);
      const o = this._osc('sine', 70, this._filter('lowpass', 160, 1, env), t, 0.25);
      o.frequency.exponentialRampToValueAtTime(38, this.ctx.currentTime + t + 0.15);
    }
  }

  _gong() {
    const base = 98;
    const partials = [1, 1.52, 2.03, 2.61, 3.19, 3.98, 5.4, 6.8];
    const out = this.ctx.createGain();
    out.gain.value = 0.35;
    out.connect(this.roomBus);
    partials.forEach((p, i) => {
      const dec = 7 / (1 + i * 0.35);
      const env = this._env(out, 0, 0.004 + i * 0.01, 0.5 / (1 + i * 0.4), 0.02, dec);
      const o = this._osc('sine', base * p * rand(0.99, 1.01), env, 0, dec + 0.1);
      o.frequency.linearRampToValueAtTime(base * p * 1.012, this.ctx.currentTime + 1.2); // pitch bloom
    });
    const strike = this._env(out, 0, 0.001, 0.8, 0.01, 0.2);
    this._noiseSource(this._filter('lowpass', 1800, 0.7, strike), 'white', false, 0, 0.25);
  }

  _cheer({ gain = 0.5 } = {}) {
    const out = this.ctx.createGain();
    out.gain.value = gain;
    out.connect(this.roomBus);
    // voices: many formant-filtered saw "whoos"
    for (let v = 0; v < 9; v++) {
      const t = rand(0, 0.6);
      const len = rand(0.8, 2.2);
      const env = this._env(out, t, 0.08, rand(0.05, 0.12), len * 0.5, len * 0.5);
      const f1 = this._filter('bandpass', rand(500, 900), 5, env);
      const f2 = this._filter('bandpass', rand(1100, 1800), 7, env);
      const o = this._osc('sawtooth', rand(110, 220), f1, t, len);
      o.connect(f2);
      o.frequency.linearRampToValueAtTime(rand(180, 330), this.ctx.currentTime + t + len * 0.4);
      o.frequency.linearRampToValueAtTime(rand(100, 200), this.ctx.currentTime + t + len);
    }
    // claps
    for (let i = 0; i < 38; i++) {
      const t = rand(0.1, 3);
      const env = this._env(out, t, 0.001, rand(0.1, 0.3), 0.004, 0.05);
      this._noiseSource(this._filter('bandpass', rand(900, 2200), 1.2, env), 'white', false, t, 0.07);
    }
    // crowd bed
    const bed = this._env(out, 0, 0.3, 0.12, 1.8, 1.2);
    this._noiseSource(this._filter('bandpass', 900, 0.8, bed), 'pink', false, 0, 3.4);
  }

  _cash() {
    this._click(this.sfxBus, 0, 0.5, 1500);
    this._thunk(0.03, 0.3, 200);
    for (const [f, t] of [[2637, 0.12], [3520, 0.2]]) {
      const env = this._env(this.sfxBus, t, 0.002, 0.18, 0.02, 1.1);
      this._osc('sine', f, env, t, 1.2);
      this._osc('sine', f * 2.76, this._env(this.sfxBus, t, 0.002, 0.05, 0.01, 0.4), t, 0.5);
    }
    const drawer = this._env(this.sfxBus, 0.25, 0.01, 0.2, 0.2, 0.2);
    this._noiseSource(this._filter('bandpass', 700, 2, drawer), 'white', false, 0.25, 0.5);
  }

  _typing({ secs = 1.5 } = {}) {
    let t = 0;
    while (t < secs) {
      this._click(this.sfxBus, t, rand(0.08, 0.2), rand(1800, 3800));
      t += rand(0.05, 0.16);
    }
  }

  _record_scratch() {
    const env = this._env(this.sfxBus, 0, 0.01, 0.6, 0.3, 0.1);
    const bp = this._filter('bandpass', 800, 3, env);
    const now = this.ctx.currentTime;
    bp.frequency.setValueAtTime(400, now);
    bp.frequency.exponentialRampToValueAtTime(3000, now + 0.15);
    bp.frequency.exponentialRampToValueAtTime(300, now + 0.4);
    this._noiseSource(bp, 'white', false, 0, 0.45);
  }

  _coffee() {
    const env = this._env(this.sfxBus, 0, 0.1, 0.25, 0.9, 0.2);
    const bp = this._filter('bandpass', 900, 4, env);
    const now = this.ctx.currentTime;
    for (let i = 0; i < 12; i++) bp.frequency.setValueAtTime(rand(700, 1300), now + i * 0.1);
    bp.frequency.linearRampToValueAtTime(500, now + 1.2);
    this._noiseSource(bp, 'white', false, 0, 1.3);
    // slurp
    const s = this._env(this.voiceBus, 1.5, 0.05, 0.35, 0.25, 0.1);
    const sb = this._filter('bandpass', 2000, 2, s);
    sb.frequency.linearRampToValueAtTime(4500, now + 1.85);
    this._noiseSource(sb, 'white', false, 1.5, 0.45);
  }

  _squeeze() {
    const env = this._env(this.sfxBus, 0, 0.05, 0.4, 0.15, 0.2);
    const bp = this._filter('lowpass', 600, 8, env);
    bp.frequency.linearRampToValueAtTime(250, this.ctx.currentTime + 0.35);
    this._noiseSource(bp, 'pink', false, 0, 0.45);
  }

  _paper() {
    const env = this._env(this.sfxBus, 0, 0.002, 0.8, 0.02, 0.25);
    this._noiseSource(this._filter('bandpass', 1400, 0.6, env), 'white', false, 0, 0.3);
    this._thunk(0, 0.4, 100);
  }

  _whoosh() {
    const env = this._env(this.sfxBus, 0, 0.12, 0.25, 0.05, 0.25);
    const bp = this._filter('bandpass', 400, 1.5, env);
    bp.frequency.exponentialRampToValueAtTime(2500, this.ctx.currentTime + 0.3);
    this._noiseSource(bp, 'white', false, 0, 0.45);
  }

  _alarm() {
    const out = this._env(this.roomBus, 0, 0.5, 0.12, 2.5, 1.0);
    const o = this._osc('triangle', 700, out, 0, 4);
    const now = this.ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      o.frequency.linearRampToValueAtTime(i % 2 ? 700 : 1300, now + i * 0.5);
    }
  }

  _flatline() {
    const env = this._env(this.sfxBus, 0, 0.01, 0.25, 3, 0.4);
    this._osc('sine', 1000, env, 0, 3.5);
  }

  _ding() {
    const env = this._env(this.sfxBus, 0, 0.002, 0.25, 0.02, 0.8);
    this._osc('sine', 1568, env, 0, 1);
    this._osc('sine', 2093, this._env(this.sfxBus, 0.12, 0.002, 0.2, 0.02, 1), 0.12, 1.2);
  }

  _fail() {
    [392, 370, 349, 262].forEach((f, i) => {
      const env = this._env(this.sfxBus, i * 0.28, 0.01, 0.12, 0.18, i === 3 ? 0.8 : 0.08);
      const o = this._osc('square', f / 2, this._filter('lowpass', 1400, 1, env), i * 0.28, i === 3 ? 1.2 : 0.3);
      if (i === 3) {
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 6;
        const lg = this.ctx.createGain();
        lg.gain.value = 5;
        lfo.connect(lg).connect(o.frequency);
        lfo.start(this.ctx.currentTime + 0.84);
        lfo.stop(this.ctx.currentTime + 2);
      }
    });
  }

  _hiccup() {
    const env = this._env(this.voiceBus, 0, 0.005, 0.5, 0.02, 0.08);
    const o = this._osc('sawtooth', 200, this._filter('bandpass', 900, 4, env), 0, 0.12);
    o.frequency.exponentialRampToValueAtTime(420, this.ctx.currentTime + 0.05);
  }

  // ── continuous layers ─────────────────────────────────────────────────────
  _startAmbience() {
    const { ctx } = this;
    // HVAC rumble
    const hvac = ctx.createGain();
    hvac.gain.value = 0.35;
    hvac.connect(this.ambBus);
    this._noiseSource(this._filter('lowpass', 220, 0.5, hvac), 'brown', true);
    // Fluorescent 120 Hz buzz
    const buzz = ctx.createGain();
    buzz.gain.value = 0.012;
    buzz.connect(this.ambBus);
    this._osc('sawtooth', 120, this._filter('bandpass', 240, 4, buzz), 0, 1e6);
    // Crowd murmur: pink noise through wandering vowel formants
    this.murmur = ctx.createGain();
    this.murmur.gain.value = 0.22;
    this.murmur.connect(this.ambBus);
    for (let i = 0; i < 3; i++) {
      const bp = this._filter('bandpass', 600, 2.5, this.murmur);
      this._noiseSource(bp, 'pink', true);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rand(1.5, 4);
      const lg = ctx.createGain();
      lg.gain.value = rand(150, 350);
      lfo.connect(lg).connect(bp.frequency);
      lfo.start();
    }
    // Distant phones and keyboards, forever
    const tick = () => {
      if (Math.random() < 0.35) this._phone_ring({ far: true });
      if (Math.random() < 0.5) {
        const t = Math.random() * 2;
        for (let k = 0; k < 14; k++) this._click(this.ambBus, t + k * rand(0.06, 0.14), rand(0.02, 0.05), rand(2000, 3500));
      }
      this._ambTimer = setTimeout(tick, rand(2500, 6000));
    };
    tick();
  }

  _startHeart() {
    this.bpm = 72;
    this.heartGain = 0;
    const beat = () => {
      if (this.heartGain > 0.02) this._heartbeat({ gain: this.heartGain });
      setTimeout(beat, 60000 / Math.max(40, this.bpm));
    };
    beat();
  }

  // Called every frame by the game with the player's physiology.
  setBody({ bac = 0, bpm = 72, ringing = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const cutoff = bac > 0.04 ? 20000 * Math.pow(0.25, Math.min(1, (bac - 0.04) / 0.16)) : 20000;
    this.bodyFilter.frequency.setTargetAtTime(Math.max(1400, cutoff), t, 0.5);
    this.bpm = bpm;
    this.heartGain = bpm > 110 ? Math.min(0.9, (bpm - 110) / 70) : 0;
    this.master.gain.setTargetAtTime(0.9 - ringing * 0.4, t, 0.3);
  }

  setLine(active) {
    if (!this.ctx) return;
    this.lineHiss.gain.setTargetAtTime(active ? 0.015 : 0, this.ctx.currentTime, 0.1);
  }

  duck(amount = 0.45) {
    if (!this.ctx) return;
    this.ambBus.gain.setTargetAtTime(amount, this.ctx.currentTime, 0.3);
  }

  level() {
    if (!this.analyser) return 0;
    const d = (this._lvl ||= new Uint8Array(this.analyser.fftSize));
    this.analyser.getByteTimeDomainData(d);
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += Math.abs(d[i] - 128);
    return s / (d.length / 4) / 128;
  }

  waveform() {
    if (!this.analyser) return null;
    const d = (this._wf ||= new Uint8Array(this.analyser.fftSize));
    this.analyser.getByteTimeDomainData(d);
    return d;
  }
}

export const audio = new AudioEngine();
