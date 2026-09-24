// The CRT monitor on your desk runs SynergyCRM 3.1 — a live diegetic UI.
import * as THREE from 'three';
import { TACTICS } from '../data/script.js';

const W = 640, H = 480;
const G = '#7dff9a';
const DIM = 'rgba(125,255,154,0.45)';
const AMBER = '#ffcf5a';
const RED = '#ff5f5f';

export class CRMScreen {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.t = 0;
    this.accum = 0;
  }

  bar(x, y, w, h, v, color, label) {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.strokeRect(x, y, w, h);
    c.fillStyle = color;
    const segs = 20;
    const filled = Math.round(Math.max(0, Math.min(1, v)) * segs);
    for (let i = 0; i < filled; i++) c.fillRect(x + 3 + i * ((w - 6) / segs), y + 3, (w - 6) / segs - 2, h - 6);
    if (label) {
      c.font = '16px "VT323", "Courier New", monospace';
      c.fillText(label, x, y - 5);
    }
  }

  draw(dt, s) {
    this.t += dt;
    this.accum += dt;
    if (this.accum < 1 / 24) return;
    this.accum = 0;
    const c = this.ctx;
    const { game, mode, wave } = s;
    c.fillStyle = '#031208';
    c.fillRect(0, 0, W, H);
    c.fillStyle = G;
    c.font = '22px "VT323", "Courier New", monospace';
    c.textBaseline = 'alphabetic';

    // header
    c.fillStyle = G;
    c.fillRect(0, 0, W, 30);
    c.fillStyle = '#031208';
    c.fillText('SynergyCRM 3.1  ::  APEX SYNERGY SOLUTIONS', 12, 22);
    c.textAlign = 'right';
    c.fillText(game?.clock ?? '', W - 12, 22);
    c.textAlign = 'left';
    c.fillStyle = G;

    if (mode === 'title') {
      c.font = '44px "VT323", monospace';
      c.fillText('> WELCOME, JORDAN', 40, 140);
      c.font = '26px "VT323", monospace';
      c.fillText('> PASSWORD: ********', 40, 190);
      c.fillText('> LOGIN OK. QUOTA LOADED.', 40, 230);
      if (Math.floor(this.t * 2) % 2) c.fillText('> _', 40, 270);
      c.fillStyle = DIM;
      c.fillText('Remember: Always. Be. Closing.', 40, 420);
    } else if (mode === 'call' || mode === 'dialing') {
      this.drawCall(s);
    } else {
      this.drawIdle(s);
    }

    // waveform strip
    if (wave) {
      c.strokeStyle = mode === 'call' ? G : DIM;
      c.lineWidth = 2;
      c.beginPath();
      const y0 = H - 34;
      for (let i = 0; i < W; i += 4) {
        const v = (wave[Math.floor((i / W) * wave.length)] - 128) / 128;
        const y = y0 + v * 40;
        i ? c.lineTo(i, y) : c.moveTo(i, y);
      }
      c.stroke();
    }

    // scanlines + vignette
    c.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
    const roll = (this.t * 60) % H;
    c.fillStyle = 'rgba(125,255,154,0.04)';
    c.fillRect(0, roll, W, 40);
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    this.texture.needsUpdate = true;
  }

  drawIdle({ game, nextLead }) {
    const c = this.ctx;
    if (!game?.day) return;
    c.font = '28px "VT323", monospace';
    c.fillText(`${game.day.name.toUpperCase()}  ::  QUOTA $${game.day.quota.toLocaleString()}`, 20, 66);
    this.bar(20, 90, 600, 26, game.bookings / game.day.quota, game.bookings >= game.day.quota ? AMBER : G, '');
    c.font = '22px "VT323", monospace';
    c.fillText(`BOOKED TODAY: $${game.bookings.toLocaleString()}    COMMISSION: $${game.player.cash.toLocaleString()}`, 20, 146);
    c.fillText('— DIAL LIST —', 20, 186);
    game.leads.slice(0, 6).forEach((pid, i) => {
      const p = nextLead?.all?.[pid];
      c.fillStyle = i === 0 ? AMBER : DIM;
      const txt = p ? `${i === 0 ? '>' : ' '} ${p.name.padEnd(24)} ${p.company.slice(0, 26).padEnd(27)} $${p.value.toLocaleString()}` : pid;
      c.fillText(txt, 20, 216 + i * 26);
    });
    c.fillStyle = Math.floor(this.t * 2) % 2 ? AMBER : G;
    if (game.leads.length) c.fillText('[ CLICK THE PHONE OR PRESS D TO DIAL ]', 120, 400);
  }

  drawCall({ game, mode }) {
    const c = this.ctx;
    const call = game.call;
    if (!call) return;
    const p = call.def;
    c.font = '30px "VT323", monospace';
    c.fillStyle = AMBER;
    c.fillText(p.name.toUpperCase(), 20, 64);
    c.font = '20px "VT323", monospace';
    c.fillStyle = G;
    c.fillText(`${p.title} · ${p.company}`, 20, 88);
    c.fillText(`${p.city}   DEAL: $${p.value.toLocaleString()}`, 20, 110);

    if (mode === 'dialing') {
      c.font = '40px "VT323", monospace';
      c.fillStyle = Math.floor(this.t * 3) % 2 ? AMBER : G;
      c.fillText('DIALING' + '.'.repeat(1 + (Math.floor(this.t * 3) % 3)), 200, 250);
      return;
    }

    this.bar(20, 145, 290, 22, call.interest / 100, call.interest >= p.threshold ? AMBER : G, `INTEREST ${Math.round(call.interest)}%  (close @ ${p.threshold})`);
    this.bar(330, 145, 290, 22, call.patience / call.maxPatience, call.patience <= 2 ? RED : G, `PATIENCE ${Math.max(0, call.patience)}/${call.maxPatience}`);

    c.font = '20px "VT323", monospace';
    c.fillStyle = G;
    c.fillText('NOTES:', 20, 200);
    c.fillStyle = DIM;
    p.notes.forEach((n, i) => c.fillText('· ' + n, 20, 222 + i * 20));

    c.fillStyle = G;
    c.fillText('PROFILE:', 330, 200);
    const tactics = Object.keys(TACTICS);
    tactics.forEach((t, i) => {
      const m = p.weak[t] ?? 1;
      const x = 330 + (i % 2) * 150;
      const y = 222 + Math.floor(i / 2) * 20;
      if (!call.revealed) {
        c.fillStyle = DIM;
        c.fillText(`${TACTICS[t].label.padEnd(9)} ???`, x, y);
      } else {
        c.fillStyle = m >= 1.5 ? AMBER : m <= 0.6 ? RED : G;
        c.fillText(`${TACTICS[t].label.padEnd(9)} ${m >= 1.5 ? 'WEAK' : m <= 0.6 ? 'RESIST' : 'ok'}`, x, y);
      }
    });

    if (call.objection !== null) {
      const o = p.objections[call.objection];
      c.fillStyle = Math.floor(this.t * 2) % 2 ? RED : AMBER;
      c.font = '22px "VT323", monospace';
      c.fillText(`!! OBJECTION: ${o.type}  →  counter with ${TACTICS[o.counter].label.toUpperCase()}`, 20, 318);
    }
    if (p.boss) {
      c.fillStyle = AMBER;
      c.fillText(`OBJECTION LAYERS: ${'■'.repeat(call.cleared.size)}${'□'.repeat(p.objections.length - call.cleared.size)}`, 20, 344);
    }

    const secs = Math.floor(this.t - (this.callStart ?? this.t));
    c.fillStyle = DIM;
    c.font = '20px "VT323", monospace';
    c.fillText(`CALL ${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}   TURN ${call.turn}   CLOSE ODDS ${Math.round(game.closeOdds() * 100)}%`, 20, 400);
  }

  startCallTimer() {
    this.callStart = this.t;
  }
}
