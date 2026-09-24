// ─────────────────────────────────────────────────────────────────────────────
//  Voice manager
//  Priority for any line:
//    1. Baked neural clip from public/audio/voice (Kokoro / Chatterbox / Dia /
//       Maya1 / IndexTTS2 bakes — see tools/voice)
//    2. Live in-browser neural TTS: Kokoro-82M via kokoro-js (WebGPU or WASM),
//       downloaded on demand. Used for freestyle lines you type yourself.
//    3. The browser's Web Speech API
//    4. Silence, timed to reading speed (subtitles still show)
//  Every clip is routed through the right acoustic space: prospects come
//  down a band-limited phone line, you are close-mic'd, the boss is in the room.
// ─────────────────────────────────────────────────────────────────────────────
import { audio } from './engine.js';
import { CAST } from '../data/script.js';
import { STYLES, stripTags } from '../data/lines.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class VoiceManager {
  constructor() {
    this.manifest = { lines: {} };
    this.cache = new Map();
    this.live = null; // kokoro-js instance
    this.liveStatus = 'off'; // off | loading | ready | error
    this.liveProgress = 0;
    this.current = null;
    this.enabled = true;
    this.engineName = 'none';
  }

  async init() {
    try {
      const res = await fetch('audio/voice/manifest.json');
      if (res.ok) {
        this.manifest = await res.json();
        this.engineName = this.manifest.engine;
      }
    } catch {
      /* no pack */
    }
    return this.manifest;
  }

  hasBaked(id) {
    return !!this.manifest.lines?.[id];
  }

  async _buffer(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const entry = this.manifest.lines[id];
    const p = fetch('audio/voice/' + entry.file)
      .then((r) => r.arrayBuffer())
      .then((b) => audio.ctx.decodeAudioData(b));
    this.cache.set(id, p);
    return p;
  }

  // Warm the cache for lines we're likely to need soon.
  prefetch(ids) {
    for (const id of ids) if (this.hasBaked(id)) this._buffer(id).catch(() => {});
  }

  // ── live Kokoro (kokoro-js) ───────────────────────────────────────────────
  async loadLive(onProgress) {
    if (this.liveStatus === 'ready' || this.liveStatus === 'loading') return this._livePromise;
    this.liveStatus = 'loading';
    this._livePromise = (async () => {
      try {
        const { KokoroTTS } = await import('kokoro-js');
        const device = navigator.gpu ? 'webgpu' : 'wasm';
        this.live = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
          dtype: device === 'webgpu' ? 'fp32' : 'q8',
          device,
          progress_callback: (p) => {
            if (p.status === 'progress' && p.total) {
              this.liveProgress = p.loaded / p.total;
              onProgress?.(this.liveProgress, p.file);
            }
          },
        });
        this.liveStatus = 'ready';
        this.liveDevice = device;
      } catch (e) {
        console.warn('Live Kokoro failed', e);
        this.liveStatus = 'error';
      }
    })();
    return this._livePromise;
  }

  async _synthLive(text, speaker, style) {
    const voice = CAST[speaker]?.kokoro || 'am_michael';
    const raw = await this.live.generate(stripTags(text), { voice, speed: STYLES[style]?.speed ?? 1 });
    const buf = audio.ctx.createBuffer(1, raw.audio.length, raw.sampling_rate);
    buf.copyToChannel(raw.audio, 0);
    return buf;
  }

  // ── playback ──────────────────────────────────────────────────────────────
  _route(channel) {
    if (channel === 'phone') return audio.phoneIn;
    if (channel === 'room') return audio.roomBus;
    return audio.voiceBus;
  }

  stop() {
    if (this.current) this.current.stop();
  }

  /**
   * Speak a line. Resolves when finished (or skipped).
   * @param {{id?:string, speaker:string, text:string, channel?:'phone'|'self'|'room', style?:string, live?:boolean}} line
   */
  async speak(line, { onStart } = {}) {
    this.stop();
    const { id, speaker, text, channel = 'self', style = 'sober' } = line;
    let buffer = null;
    if (this.enabled) {
      try {
        if (id && this.hasBaked(id) && !line.live) buffer = await this._buffer(id);
        else if (this.liveStatus === 'ready') buffer = await this._synthLive(text, speaker, style);
      } catch (e) {
        console.warn('voice failed', id, e);
      }
    }

    let stopFn;
    const done = new Promise((resolve) => {
      if (buffer) {
        const src = audio.ctx.createBufferSource();
        src.buffer = buffer;
        const g = audio.ctx.createGain();
        g.gain.value = channel === 'room' ? 0.9 : 1;
        src.connect(g).connect(this._route(channel));
        src.onended = resolve;
        src.start();
        stopFn = () => {
          try {
            src.stop();
          } catch {}
          resolve();
        };
      } else if (this.enabled && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(stripTags(text));
        const v = this._browserVoice(speaker);
        if (v) u.voice = v;
        u.rate = style === 'wired' ? 1.5 : style === 'drunk' ? 0.8 : 1.05;
        u.pitch = { chad: 0.7, gerald: 0.6, walter: 0.7, tyler: 1.2, mom: 1.1, marjorie: 1.15 }[speaker] ?? 1;
        let settled = false;
        const fin = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };
        u.onend = fin;
        u.onerror = fin;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
        // Safety: some browsers never fire onend.
        setTimeout(fin, 1500 + stripTags(text).length * 90);
        stopFn = () => {
          speechSynthesis.cancel();
          fin();
        };
      } else {
        const t = setTimeout(resolve, 800 + stripTags(text).length * 55);
        stopFn = () => {
          clearTimeout(t);
          resolve();
        };
      }
    });
    const handle = { stop: stopFn, done, duration: buffer?.duration };
    this.current = handle;
    onStart?.(handle);
    await done;
    if (this.current === handle) this.current = null;
    await sleep(120);
    return handle;
  }

  _browserVoice(speaker) {
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
    if (!voices.length) return null;
    const female = ['karen', 'marjorie', 'siobhan', 'denise', 'mom', 'victoria'].includes(speaker);
    const pool = voices.filter((v) => /female|samantha|victoria|karen|moira|tessa|zira|susan|serena|fiona/i.test(v.name) === female);
    const list = pool.length ? pool : voices;
    const h = [...speaker].reduce((a, c) => a + c.charCodeAt(0), 0);
    return list[h % list.length];
  }
}

export const voice = new VoiceManager();
