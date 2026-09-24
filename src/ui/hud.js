// DOM overlay: stats, move cards, items, subtitles, modals.
import { MOVES, ITEMS, WIRED_BPM, DANGER_BPM } from '../game/rules.js';
import { TACTICS, CAST } from '../data/script.js';
import { audio } from '../audio/engine.js';
import { stripTags } from '../data/lines.js';

const $ = (sel) => document.querySelector(sel);
const h = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const money = (v) => '$' + Math.round(v).toLocaleString();
const ITEM_KEYS = { beer: 'Q', snow: 'W', coffee: 'E', ball: 'R', leads: 'L', gong: 'G' };

export class HUD {
  constructor() {
    this.root = $('#hud');
    this.resolver = null;
    this.mode = 'off'; // off | idle | call | busy
    this.build();
    addEventListener('keydown', (e) => this.onKey(e));
  }

  build() {
    this.root.innerHTML = `
      <div id="stats" class="panel">
        <div class="day"><span id="dayname">—</span> <span id="clock">9:00 AM</span></div>
        <div class="stat"><label>Confidence</label><div class="bar"><i id="conf"></i></div></div>
        <div class="stat"><label>Energy</label><div class="bar"><i id="energy"></i></div></div>
        <div class="stat row"><label>Buzz</label><b id="bac">0.000</b><em id="bacword">stone sober</em></div>
        <div class="stat row"><label>Heart</label><b id="bpm">72</b><em>bpm</em><canvas id="ecg" width="120" height="28"></canvas></div>
        <div class="stat"><label>Booked today <span id="quotaTxt"></span></label><div class="bar quota"><i id="quota"></i></div></div>
        <div class="stat row"><label>Commission</label><b id="cash">$0</b><em id="strikes"></em></div>
      </div>
      <div id="prospect" class="panel hidden">
        <div class="pname" id="pname"></div>
        <div class="ptitle" id="ptitle"></div>
        <div class="stat"><label>Interest <span id="closeat"></span></label><div class="bar interest"><i id="interest"></i><s id="thresh"></s></div></div>
        <div class="stat"><label>Patience</label><div id="patience" class="pips"></div></div>
        <div id="objection" class="objection hidden"></div>
        <div id="weak" class="weak"></div>
        <div id="odds" class="odds"></div>
      </div>
      <div id="items" class="panel"></div>
      <div id="subtitle" class="hidden"><b></b><span></span><i class="skip">SPACE to skip</i></div>
      <div id="moves" class="hidden"></div>
      <div id="floaters"></div>
      <div id="toasts"></div>
      <div id="leadcard" class="panel hidden"></div>
      <div id="modal" class="hidden"><div class="card"></div></div>
      <div id="tip" class="hidden"></div>
    `;
    this.ecg = $('#ecg').getContext('2d');
    this.ecgX = 0;

    const moves = $('#moves');
    for (const m of MOVES) {
      const t = m.tactic ? TACTICS[m.tactic] : null;
      const b = h('button', `move ${m.id}`, `
        <kbd>${m.key}</kbd>
        <span class="icon">${t ? t.icon : { discovery: '🔍', takeaway: '🚪', silence: '🤐', close: '✍️', freestyle: '🎤' }[m.id]}</span>
        <span class="mname">${m.name}</span>
        <span class="mtype" style="color:${t ? t.color : '#ddd'}">${t ? t.label : m.id === 'close' ? '<span id="closeodds"></span>' : 'special'}</span>
        <span class="cost">⚡${m.energy}</span>`);
      b.dataset.move = m.id;
      b.title = m.desc;
      b.onclick = () => this.pick({ type: 'move', id: m.id });
      b.onmouseenter = () => this.showTip(m.desc, b);
      b.onmouseleave = () => this.hideTip();
      moves.appendChild(b);
    }
    const hang = h('button', 'move hangup', '<kbd>X</kbd><span class="icon">📵</span><span class="mname">Hang Up</span><span class="mtype">bail</span>');
    hang.onclick = () => this.pick({ type: 'hangup' });
    moves.appendChild(hang);

    const items = $('#items');
    items.appendChild(h('div', 'ititle', 'DESK'));
    for (const [id, it] of Object.entries(ITEMS)) {
      const b = h('button', `item ${id}`, `<span class="icon">${it.icon}</span><span class="iname">${it.name}</span><span class="count" id="count-${id}"></span><kbd>${ITEM_KEYS[id]}</kbd>`);
      b.dataset.item = id;
      b.onclick = () => this.pick({ type: 'item', id });
      b.onmouseenter = () => this.showTip(it.desc, b);
      b.onmouseleave = () => this.hideTip();
      items.appendChild(b);
    }

    $('#subtitle').onclick = () => this.onSkip?.();
  }

  showTip(text, el) {
    const tip = $('#tip');
    tip.textContent = text;
    tip.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    tip.style.left = Math.min(innerWidth - 280, Math.max(8, r.left + r.width / 2 - 130)) + 'px';
    tip.style.top = r.top - 12 + 'px';
  }
  hideTip() {
    $('#tip').classList.add('hidden');
  }

  onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      this.onSkip?.();
      return;
    }
    const k = e.key.toUpperCase();
    if (this.modalKeys && this.modalKeys[k]) return this.modalKeys[k]();
    if (!this.resolver) return;
    const m = MOVES.find((m) => m.key === k);
    if (m) return this.pick({ type: 'move', id: m.id });
    const item = Object.entries(ITEM_KEYS).find(([, v]) => v === k);
    if (item) return this.pick({ type: 'item', id: item[0] });
    if (k === 'D') return this.pick({ type: 'dial' });
    if (k === 'X') return this.pick({ type: 'hangup' });
  }

  // ── choice plumbing ───────────────────────────────────────────────────────
  chooseAction(mode, game) {
    this.mode = mode;
    this.game = game;
    this.refresh(game);
    $('#moves').classList.toggle('hidden', mode !== 'call');
    return new Promise((res) => (this.resolver = res));
  }

  pick(action) {
    if (!this.resolver) return;
    const g = this.game;
    if (action.type === 'move' && this.mode !== 'call') return;
    if (action.type === 'hangup' && this.mode !== 'call') return;
    if (action.type === 'dial' && this.mode !== 'idle') return;
    if (action.type === 'item' && !g.canUse(action.id)) {
      audio.play('ui');
      this.toast(this.whyNot(action.id, g), 'warn');
      return;
    }
    audio.play('ui');
    const r = this.resolver;
    this.resolver = null;
    this.mode = 'busy';
    this.refresh(g);
    r(action);
  }

  whyNot(id, g) {
    if (g.items[id] <= 0) return `Out of ${ITEMS[id].name}.`;
    if (g.call?.itemUsed) return 'One desk item per turn.';
    if (id === 'ball') return 'Your hand is still cramping.';
    if (id === 'leads') return 'Between calls only.';
    if (id === 'gong') return 'You ring the gong after a CLOSE. Those are the rules.';
    return 'Not now.';
  }

  busy() {
    this.mode = 'busy';
    this.refresh(this.game);
  }

  // ── refresh ───────────────────────────────────────────────────────────────
  refresh(g) {
    if (!g) return;
    this.game = g;
    const p = g.player;
    $('#dayname').textContent = g.day?.name ?? '';
    $('#clock').textContent = g.clock ?? '';
    $('#conf').style.width = p.confidence + '%';
    $('#energy').style.width = p.energy + '%';
    $('#energy').classList.toggle('low', p.energy < 20);
    $('#bac').textContent = p.bac.toFixed(3);
    $('#bacword').textContent =
      p.bac < 0.02 ? 'stone sober' : p.bac < 0.06 ? 'buzzed ✨' : p.bac < 0.09 ? 'loose' : p.bac < 0.14 ? 'slurring' : p.bac < 0.19 ? 'hammered' : 'DANGER ZONE';
    $('#bac').className = p.bac >= 0.09 ? 'warn' : '';
    $('#bpm').textContent = Math.round(p.hr);
    $('#bpm').className = p.hr >= DANGER_BPM ? 'danger' : p.hr >= WIRED_BPM ? 'warn' : '';
    if (g.day) {
      $('#quotaTxt').textContent = `${money(g.bookings)} / ${money(g.day.quota)}`;
      $('#quota').style.width = Math.min(100, (g.bookings / g.day.quota) * 100) + '%';
      $('#quota').classList.toggle('hit', g.bookings >= g.day.quota);
    }
    $('#cash').textContent = money(p.cash);
    $('#strikes').textContent = p.strikes ? '❌'.repeat(p.strikes) + ' strike' + (p.strikes > 1 ? 's' : '') : '';

    // moves
    const c = g.call;
    for (const b of document.querySelectorAll('.move')) {
      const id = b.dataset.move;
      b.disabled = this.mode !== 'call';
      if (c && id) {
        const m = MOVES.find((x) => x.id === id);
        b.classList.remove('super', 'weak', 'counter');
        if (c.revealed && m.tactic) {
          const w = c.def.weak[m.tactic] ?? 1;
          if (w >= 1.5) b.classList.add('super');
          if (w <= 0.6) b.classList.add('weak');
        }
        if (c.objection !== null && m.tactic === c.def.objections[c.objection].counter) b.classList.add('counter');
      }
    }
    const co = $('#closeodds');
    if (co) co.textContent = c ? `${Math.round(g.closeOdds() * 100)}% odds` : '';
    // items
    for (const [id] of Object.entries(ITEMS)) {
      const cnt = g.items?.[id] ?? 0;
      $('#count-' + id).textContent = id === 'ball' ? (g.ballCooldown ? `⏳${g.ballCooldown}` : '') : id === 'gong' ? (g.justClosed ? 'READY' : '') : '×' + cnt;
      const btn = document.querySelector(`.item.${id}`);
      btn.disabled = !(this.mode === 'call' || this.mode === 'idle') || !g.canUse(id);
      btn.classList.toggle('ready', id === 'gong' && g.justClosed);
    }

    // prospect card
    const pc = $('#prospect');
    if (c) {
      pc.classList.remove('hidden');
      $('#pname').textContent = c.def.name;
      $('#ptitle').textContent = `${c.def.title}, ${c.def.company}`;
      $('#interest').style.width = c.interest + '%';
      $('#interest').classList.toggle('hot', c.interest >= c.def.threshold);
      $('#thresh').style.left = c.def.threshold + '%';
      $('#closeat').textContent = `${Math.round(c.interest)} / close @ ${c.def.threshold}`;
      $('#patience').innerHTML = Array.from({ length: c.maxPatience > 20 ? 10 : c.maxPatience }, (_, i) => `<i class="${i < c.patience ? 'on' : ''} ${c.patience <= 2 ? 'low' : ''}"></i>`).join('');
      const ob = $('#objection');
      if (c.objection !== null) {
        const o = c.def.objections[c.objection];
        ob.classList.remove('hidden');
        ob.innerHTML = `🛡️ OBJECTION: <b>${o.type}</b> → counter with <span style="color:${TACTICS[o.counter].color}">${TACTICS[o.counter].icon} ${TACTICS[o.counter].label}</span>`;
      } else ob.classList.add('hidden');
      $('#weak').innerHTML = c.revealed
        ? Object.entries(c.def.weak)
            .filter(([, v]) => v >= 1.5 || v <= 0.6)
            .map(([t, v]) => `<span class="chip ${v >= 1.5 ? 'w' : 'r'}">${TACTICS[t].icon} ${TACTICS[t].label} ${v >= 1.5 ? 'WEAK' : 'RESISTS'}</span>`)
            .join('')
        : '<span class="chip q">🔍 Ask a Discovery Question to reveal weaknesses</span>';
      $('#odds').textContent = g.wired ? `⚡ WIRED: ${c.actionsLeft} action${c.actionsLeft === 1 ? '' : 's'} left this turn` : '';
    } else pc.classList.add('hidden');
  }

  drawECG(dt, bpm, t) {
    const ctx = this.ecg;
    const W = 120, H = 28;
    const period = 60 / bpm;
    const ph = (t % period) / period;
    let y = 0;
    if (ph < 0.08) y = Math.sin((ph / 0.08) * Math.PI) * 0.15;
    else if (ph < 0.12) y = -0.2;
    else if (ph < 0.15) y = 1;
    else if (ph < 0.18) y = -0.35;
    else if (ph > 0.35 && ph < 0.5) y = Math.sin(((ph - 0.35) / 0.15) * Math.PI) * 0.25;
    const x = (this.ecgX = (this.ecgX + dt * 60) % W);
    ctx.fillStyle = 'rgba(8,10,14,1)';
    ctx.fillRect(x, 0, 6, H);
    ctx.fillStyle = bpm >= DANGER_BPM ? '#ff3b3b' : bpm >= WIRED_BPM ? '#ffcf5a' : '#39ff6a';
    ctx.fillRect(x, H / 2 - y * (H / 2 - 2), 2, 2);
    return ph < 0.15 ? 1 - ph / 0.15 : 0;
  }

  // ── presentation helpers ─────────────────────────────────────────────────
  subtitle(speaker, text) {
    const s = $('#subtitle');
    s.classList.remove('hidden');
    s.querySelector('b').textContent = CAST[speaker]?.name ?? speaker;
    s.querySelector('b').className = speaker === 'player' ? 'me' : speaker === 'chad' || speaker === 'brad' ? 'room' : 'them';
    s.querySelector('span').textContent = stripTags(text);
  }
  clearSubtitle() {
    $('#subtitle').classList.add('hidden');
  }

  float(text, color = '#fff', big = false) {
    const f = h('div', 'floater' + (big ? ' big' : ''), text);
    f.style.color = color;
    // stack simultaneous floaters instead of piling them on top of each other
    const now = performance.now();
    this._floatSlots = (this._floatSlots || []).filter((t) => now - t < 900);
    const slot = this._floatSlots.length;
    this._floatSlots.push(now);
    f.style.left = 50 + (slot % 2 ? 1 : -1) * Math.min(slot, 1) * 6 + (Math.random() - 0.5) * 4 + '%';
    f.style.top = slot * (big ? 44 : 30) + 'px';
    $('#floaters').appendChild(f);
    setTimeout(() => f.remove(), 2200);
  }

  toast(text, kind = '') {
    const t = h('div', 'toast ' + kind, text);
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 3800);
    setTimeout(() => t.remove(), 4400);
  }

  showLead(p, extra = '') {
    const lc = $('#leadcard');
    if (!p) return lc.classList.add('hidden');
    lc.classList.remove('hidden');
    lc.innerHTML = `
      <div class="lh">NEXT LEAD</div>
      <div class="ln">${p.name}</div>
      <div class="lt">${p.title} · ${p.company}</div>
      <div class="lc">${p.city}</div>
      <div class="lv">${p.value ? money(p.value) + ' ARR' : 'Gatekeeper'}</div>
      ${extra}
      <button class="dial"><kbd>D</kbd> PICK UP &amp; DIAL</button>`;
    lc.querySelector('.dial').onclick = () => this.pick({ type: 'dial' });
  }

  modal(html, buttons = [{ id: 'ok', label: 'Continue', key: 'ENTER' }], cls = '') {
    const m = $('#modal');
    m.className = cls;
    const card = m.querySelector('.card');
    card.innerHTML = html;
    const row = h('div', 'buttons');
    card.appendChild(row);
    return new Promise((res) => {
      this.modalKeys = {};
      const done = (id) => {
        m.className = 'hidden';
        this.modalKeys = null;
        audio.play('ui');
        res(id);
      };
      for (const b of buttons) {
        const el = h('button', b.cls || '', b.label + (b.key ? ` <kbd>${b.key === 'ENTER' ? '⏎' : b.key}</kbd>` : ''));
        el.disabled = !!b.disabled;
        el.onclick = () => !el.disabled && done(b.id);
        row.appendChild(el);
        if (b.key) this.modalKeys[b.key] = () => !el.disabled && done(b.id);
      }
      card.querySelectorAll('[data-choice]').forEach((el) => (el.onclick = () => done(el.dataset.choice)));
    });
  }

  freestyle(prospectName) {
    return new Promise((res) => {
      const m = $('#modal');
      m.className = 'freestyle';
      const card = m.querySelector('.card');
      card.innerHTML = `
        <h2>🎤 Freestyle</h2>
        <p>Say anything to <b>${prospectName}</b>. The game reads your line for tactics (numbers → Logic, deadlines → Urgency, compliments → Flattery, rivals → FOMO, jokes → Humor, feelings → Rapport) and speaks it with live neural TTS.</p>
        <textarea id="fs" maxlength="240" placeholder="e.g. Your competitor just signed and I only have one slot left before 5pm."></textarea>
        <div class="buttons"><button id="fsgo">Say it <kbd>⏎</kbd></button><button id="fsno" class="ghost">Never mind <kbd>Esc</kbd></button></div>`;
      const ta = card.querySelector('#fs');
      setTimeout(() => ta.focus(), 50);
      const done = (v) => {
        m.className = 'hidden';
        res(v);
      };
      card.querySelector('#fsgo').onclick = () => done(ta.value.trim() || null);
      card.querySelector('#fsno').onclick = () => done(null);
      ta.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          done(ta.value.trim() || null);
        }
        if (e.key === 'Escape') done(null);
      };
    });
  }

  setVisible(v) {
    this.root.classList.toggle('hidden', !v);
  }
}
