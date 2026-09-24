// ─────────────────────────────────────────────────────────────────────────────
//  The Director stages everything: it asks the rules what happened and turns
//  it into voices, sound, camera moves and HUD beats.
// ─────────────────────────────────────────────────────────────────────────────
import { Game, DAYS, SHOP, ITEMS, classifyFreestyle, DANGER_BPM, FATAL_BPM } from './rules.js';
import { PROSPECTS, OFFICE_LINES, TACTICS } from '../data/script.js';
import { lineById } from '../data/lines.js';
import { audio } from '../audio/engine.js';
import { voice } from '../audio/voice.js';
import { tween, wait } from '../scene/tween.js';

const pickI = (arr) => Math.floor(Math.random() * arr.length);
const money = (v) => '$' + Math.round(v).toLocaleString();

export class Director {
  constructor(office, hud, post) {
    this.office = office;
    this.hud = hud;
    this.post = post;
    this.game = new Game();
    this.crmMode = 'title';
    this.board = [
      { name: 'BRAD', value: 0, rate: 1.4 },
      { name: 'DEB', value: 0, rate: 0.9 },
      { name: 'MARCUS', value: 0, rate: 0.7 },
      { name: 'PRIYA', value: 0, rate: 1.0 },
      { name: 'GUS', value: 0, rate: 0.35 },
      { name: 'YOU', value: 0, you: true },
    ];
    this.fx = { flash: 0, gold: 0, black: 0 };
    hud.onSkip = () => voice.stop();
  }

  // ── speech helpers ────────────────────────────────────────────────────────
  async say(id, channel, override) {
    const line = lineById(id);
    if (!line) {
      console.warn('missing line', id);
      return;
    }
    const speaker = line.speaker;
    this.hud.subtitle(speaker, override ?? line.text);
    this.speaking = speaker;
    if (speaker === 'chad') this.office.chad.mode = 'talk';
    await voice.speak({ id, speaker, text: line.text, channel, style: line.style });
    this.speaking = null;
    if (speaker === 'chad') this.office.chad.mode = 'idle';
    this.hud.clearSubtitle();
  }

  async prospectSays(key, idx) {
    const c = this.game.call;
    const lines = c.def.lines[key];
    const i = idx ?? pickI(lines);
    await this.say(`${c.pid}.${key}.${i}`, 'phone');
  }

  async chadSays(key) {
    const i = pickI(OFFICE_LINES.chad[key]);
    await this.say(`chad.${key}.${i}`, 'room');
  }

  refreshBoard() {
    this.board.find((b) => b.you).value = this.game.player.totalBookings;
    this.office.drawBoard(this.board);
  }

  bumpCoworkers() {
    for (const b of this.board) if (!b.you && Math.random() < 0.35) b.value += Math.round((5000 + Math.random() * 40000) * b.rate / 1000) * 1000;
    this.refreshBoard();
  }

  // ── main loop ────────────────────────────────────────────────────────────
  async run() {
    this.hud.setVisible(true);
    this.refreshBoard();
    for (let d = 0; d < DAYS.length; d++) {
      const day = this.game.startDay();
      this.office.refillDesk();
      this.crmMode = 'idle';
      await this.fade(0, 0.8);
      await this.hud.modal(
        `<div class="daybig">${day.name}</div>
         <p class="quota">Quota: <b>${money(day.quota)}</b> in bookings</p>
         ${d === 0 ? `<p>Your desk comes stocked each morning: <b>6 tallboys</b>, <b>3 lines of Desk Snow™</b>, <b>4 coffees</b> and one set of <b>Glengarry leads</b>. Miss quota twice and you're fired.</p>
         <p class="hint">How a call works: each turn you pick one pitch move. Ask a <b>Discovery Question</b> first to see what they're weak to. Counter their objections with the tactic shown. Use your desk items between moves (one per turn). When Interest crosses the line, <b>ALWAYS BE CLOSING</b>.</p>` : ''}
         ${d === 4 ? '<p class="warn">Word is that <b>Victoria Sterling</b>, CFO of OmniCorp Global, is on today\'s dial list. $2.4M. Don\'t blow it.</p>' : ''}
         ${this.game.player.strikes ? `<p class="warn">You have ${this.game.player.strikes} strike. One more and you're done.</p>` : ''}`,
        [{ id: 'go', label: 'Clock in', key: 'ENTER' }],
        'day',
      );
      // Chad's morning pep talk
      this.office.chadWalk([0.9, 0, -1.9]).then(() => {});
      await wait(2.2);
      await this.say(`chad.morning.${Math.min(d, 1) + (d === 4 ? 1 : 0)}`, 'room');
      this.office.chadWalk([1.2 + Math.random() * 3, 0, -10.5], false).then(() => (this.office.chad.mode = 'idle'));

      while (!this.game.dayOver) {
        const pid = await this.betweenCalls();
        if (!pid) break;
        await this.runCall(pid); // a collapse sets the clock to 5pm, ending the day
        this.bumpCoworkers();
      }
      const ok = await this.endOfDay();
      if (!ok) return;
    }
    await this.ending();
  }

  // ── between calls ────────────────────────────────────────────────────────
  async betweenCalls() {
    const g = this.game;
    this.crmMode = 'idle';
    audio.duck(0.8);
    this.randomEvents = (this.randomEvents || 0) + 1;
    if (g.stats.calls > 0 && Math.random() < 0.45) {
      const inbound = await this.randomEvent();
      if (inbound) return inbound;
    }
    while (true) {
      if (g.dayOver) return null;
      this.hud.showLead(PROSPECTS[g.leads[0]]);
      const a = await this.hud.chooseAction('idle', g);
      if (a.type === 'item') {
        await this.useItem(a.id);
        this.collapsedNow = false;
        continue;
      }
      if (a.type === 'dial') {
        this.hud.showLead(null);
        const pid = g.leads.shift();
        // fat-finger: speed-dial #1 is Mom
        if (!g.momDone && Math.random() < 0.08) {
          g.momDone = true;
          g.leads.unshift(pid);
          this.hud.toast('You fat-fingered speed dial #1...', 'warn');
          return 'mom';
        }
        return pid;
      }
    }
  }

  async randomEvent() {
    const g = this.game;
    const o = this.office;
    const roll = Math.random();
    if (!g.inboundDone && roll < 0.25 && g.dayIndex < 4) {
      g.inboundDone = true;
      audio.play('phone_ring');
      o.ring(1.8);
      this.hud.toast('📞 Inbound call on line 1!');
      await wait(2.2);
      audio.play('phone_ring');
      o.ring(1.8);
      const r = await this.hud.modal('<h2>📞 Your phone is ringing</h2><p>Unknown number. Could be a lead. Could be a pizza order. Could be anything.</p>', [
        { id: 'answer', label: 'Answer it', key: 'ENTER' },
        { id: 'ignore', label: 'Let it ring', key: 'I', cls: 'ghost' },
      ]);
      if (r === 'answer') {
        this.inbound = true;
        return 'sal';
      }
      return null;
    }
    if (roll < 0.55) {
      // Brad closes something
      const brad = o.brad;
      brad?.cheer();
      audio.play('gong');
      await wait(0.4);
      audio.play('cheer', { gain: 0.3 });
      const b = this.board.find((x) => x.name === 'BRAD');
      b.value += 20000 + Math.round(Math.random() * 40) * 1000;
      this.refreshBoard();
      await this.say(`brad.${Math.random() < 0.5 ? 'gong' : 'taunt'}.${pickI(OFFICE_LINES.brad.gong)}`, 'room');
      g.player.confidence = Math.max(0, g.player.confidence - 5);
      this.hud.float('-5 CONFIDENCE (envy)', '#ff8a8a');
      return null;
    }
    // Chad prowls by
    await o.chadWalk([0.7, 0, -1.4]);
    const p = g.player;
    const key = p.bac >= 0.08 ? 'drunk' : p.hr >= 110 ? 'wired' : 'walkby';
    await this.chadSays(key);
    o.chadWalk([1.2 + Math.random() * 4, 0, -10.5], false).then(() => (o.chad.mode = 'idle'));
    return null;
  }

  // ── the call ─────────────────────────────────────────────────────────────
  async runCall(pid, { transferred = false } = {}) {
    const g = this.game;
    const o = this.office;
    const hud = this.hud;
    const call = g.startCall(pid);
    g.advance(2);
    hud.busy();
    hud.refresh(g);
    voice.prefetch(Object.entries(call.def.lines).flatMap(([k, v]) => v.map((_, i) => `${pid}.${k}.${i}`)));

    const inbound = this.inbound;
    this.inbound = false;
    if (inbound) {
      await o.liftHandset(true);
      audio.play('pickup');
    } else if (transferred) {
      // hold music, obviously
      this.crmMode = 'dialing';
      hud.subtitle('denise', '♪ ♫ (smooth jazz hold music) ♫ ♪');
      await this.holdMusic(4);
      hud.clearSubtitle();
    } else {
      this.crmMode = 'dialing';
      audio.play('pickup');
      await o.liftHandset(true);
      await wait(0.3);
      const digits = String(2000000000 + Math.floor(Math.random() * 7999999999)).slice(0, 10);
      const dur = audio.play('dial', { digits });
      await wait(dur || 1.3);
      const rings = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < rings; i++) {
        audio.play('ringback');
        await wait(i === rings - 1 ? 2.3 : 3.2);
      }
      audio.play('pickup', {});
    }
    audio.setLine(true);
    audio.duck(0.35);
    o.setLineLight(true);
    this.crmMode = 'call';
    o.crm.startCallTimer();

    await this.prospectSays('intro');
    if (!pid.startsWith('mom')) {
      const st = g.voiceStyle();
      const oi = pickI([0, 1]);
      await this.say(`player.opener.${oi}.${st}`, 'self');
    }

    while (true) {
      g.beginTurn();
      hud.refresh(g);
      while (g.call.actionsLeft > 0) {
        const a = await hud.chooseAction('call', g);
        if (a.type === 'item') {
          await this.useItem(a.id);
          if (this.collapsedNow) {
            this.collapsedNow = false;
            return 'collapse';
          }
          continue;
        }
        if (a.type === 'hangup') {
          audio.play('hangup');
          await this.endCall('bail');
          hud.toast('You hung up on them. Bold.', 'warn');
          return 'bail';
        }
        let fs;
        if (a.id === 'freestyle') {
          if (voice.liveStatus === 'off') {
            hud.toast('🎤 Downloading Kokoro-82M so your freestyle gets a real neural voice…');
            voice.loadLive().then(() => voice.liveStatus === 'ready' && hud.toast(`🎤 Live neural voice ready (${voice.liveDevice})`));
          }
          const text = await hud.freestyle(call.def.name);
          if (!text) continue;
          fs = classifyFreestyle(text, pid);
        }
        const out = g.playerMove(a.id, fs);
        const res = await this.presentMove(out);
        if (res) return res;
        if (g.call.patience <= 0) return this.hangup();
      }
      const pt = g.prospectTurn();
      hud.refresh(g);
      if (pt.type === 'hangup') return this.hangup();
      if (pt.type === 'objection') {
        audio.play('record_scratch');
        hud.float('🛡️ OBJECTION!', '#ff6b6b', true);
        hud.refresh(g);
        await this.say(`${pid}.obj.${pt.index}`, 'phone');
        hud.toast(`Counter with ${TACTICS[pt.obj.counter].icon} ${TACTICS[pt.obj.counter].label}`);
      }
      // Physiology alarms
      const p = g.player;
      if (p.hr >= DANGER_BPM && !this.warnedHeart) {
        this.warnedHeart = true;
        hud.toast('💔 Your chest feels tight. Maybe squeeze the stress ball.', 'danger');
      }
    }
  }

  async presentMove(out) {
    const g = this.game;
    const hud = this.hud;
    const c = g.call;
    hud.busy();

    // 1. You speak
    if (out.id === 'silence') {
      hud.subtitle('player', '. . .  (strategic silence)  . . .');
      audio.play('typing', { secs: 0.4 });
      await wait(2.4);
      hud.clearSubtitle();
    } else if (out.freestyle) {
      hud.subtitle('player', out.freestyle.text);
      await voice.speak({ speaker: 'player', text: out.freestyle.text, channel: 'self', style: out.style, live: true });
      hud.clearSubtitle();
    } else if (out.lineId) {
      await this.say(out.lineId, 'self');
    }
    if (out.slurred && Math.random() < 0.5) audio.play('hiccup');

    // 2. Numbers
    for (const n of out.freestyle?.notes || []) hud.float(n, '#ffd166');
    if (out.freestyle) hud.float(`read as ${TACTICS[out.tactic].icon} ${TACTICS[out.tactic].label}`, TACTICS[out.tactic].color);
    if (out.close) {
      hud.float(`${Math.round(out.odds * 100)}% ... ${out.close === 'yes' ? 'SIGNED!' : 'DENIED'}`, out.close === 'yes' ? '#ffd166' : '#ff6b6b', true);
    } else if (out.id !== 'silence') {
      const col = out.gain >= 13 ? '#7dffa1' : out.gain >= 4 ? '#ffffff' : '#ff6b6b';
      hud.float(`${out.gain >= 0 ? '+' : ''}${out.gain} INTEREST`, col, true);
      if (out.eff === 'super') hud.float("IT'S SUPER EFFECTIVE!", '#ffd166');
      if (out.eff === 'weak' && out.gain < 0) hud.float("IT'S NOT VERY EFFECTIVE...", '#aaa');
    }
    for (const n of out.notes) hud.float(n, n === 'SLURRED' || n === 'BACKFIRED' ? '#ff8a8a' : '#9fd3ff');
    if (out.tier === 'pos') audio.play('ding');
    if (out.countered) audio.play('cash');
    hud.refresh(g);

    // 3. They react
    if (out.close === 'yes') {
      await this.prospectSays('closeYes');
      return this.closed();
    }
    if (c.patience <= 0) return null;
    if (out.slurred && !c.said.has('slur')) {
      c.said.add('slur');
      await this.prospectSays('slur');
    } else if (out.style === 'wired' && !c.said.has('wired') && Math.random() < 0.6) {
      c.said.add('wired');
      await this.prospectSays('wired');
    } else if (out.id === 'silence') {
      await this.prospectSays('silence');
    } else if (out.close === 'no') {
      await this.prospectSays('closeNo');
    } else {
      await this.prospectSays(out.tier === 'pos' ? 'pos' : out.tier === 'neu' ? 'neu' : 'neg');
    }
    return null;
  }

  async closed() {
    const g = this.game;
    const o = this.office;
    const def = g.call.def;
    if (def.gatekeeper) {
      g.endCall('closed');
      this.hud.float('TRANSFERRED!', '#ffd166', true);
      return this.runCall(def.next, { transferred: true });
    }
    audio.play('hangup');
    const r = await this.endCall('closed');
    audio.play('cash');
    this.fx.gold = 1;
    await wait(0.3);
    audio.play('cheer', { gain: def.value > 100000 ? 0.7 : 0.45 });
    o.cheer(false);
    this.hud.float(`CLOSED! ${money(r.value)}`, '#ffd166', true);
    this.hud.float(`+${money(r.commission)} commission`, '#7dffa1');
    this.hud.toast('🥁 The gong is ready (G)');
    this.refreshBoard();
    if (def.boss) {
      this.victoria = true;
      await this.chadSays('victory');
    } else if (!def.mom) await this.chadSays('close');
    else this.hud.toast('Your mom bought SynergyOS. You have never loved her more.');
    return 'closed';
  }

  async hangup() {
    const g = this.game;
    await this.prospectSays('hangup');
    audio.play('busy');
    this.hud.float('THEY HUNG UP', '#ff6b6b', true);
    await wait(0.8);
    await this.endCall('hangup');
    if (Math.random() < 0.45) await this.chadSays('hangup');
    return 'hangup';
  }

  async endCall(result) {
    const r = this.game.endCall(result);
    audio.setLine(false);
    audio.duck(0.8);
    this.office.setLineLight(false);
    await this.office.liftHandset(false);
    audio.play('hangup');
    this.crmMode = 'idle';
    this.hud.refresh(this.game);
    return r;
  }

  async holdMusic(secs) {
    const ctx = audio.ctx;
    const notes = [60, 64, 67, 71, 69, 65, 62, 67, 72, 71, 67, 64];
    const out = ctx.createGain();
    out.gain.value = 0.08;
    out.connect(audio.phoneIn);
    const step = 0.33;
    notes.forEach((n, i) => {
      const t = ctx.currentTime + i * step;
      if (i * step > secs) return;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 440 * Math.pow(2, (n - 69) / 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.4);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + step * 1.5);
    });
    await wait(secs);
  }

  // ── items ────────────────────────────────────────────────────────────────
  async useItem(id) {
    const g = this.game;
    const o = this.office;
    const before = { ...g.items };
    const out = g.useItem(id);
    if (!out) return;
    this.hud.busy();
    switch (id) {
      case 'beer': {
        audio.play('beer_open');
        const idx = ITEMS.beer.perDay - before.beer;
        await wait(0.3);
        const p = o.drinkBeer(idx);
        await wait(0.5);
        audio.play('beer_gulp');
        await p;
        if (Math.random() < 0.35) audio.play('burp');
        break;
      }
      case 'snow': {
        const idx = ITEMS.snow.perDay - before.snow;
        const p = o.doLine(idx);
        await wait(0.7);
        audio.play('sniff');
        await p;
        this.fx.flash = 1;
        audio.play('whoosh');
        if (out.nosebleed) this.hud.toast('🩸 Your nose is bleeding. Rapport and flattery are 20% less convincing.', 'danger');
        break;
      }
      case 'coffee':
        audio.play('coffee');
        await o.sipCoffee();
        break;
      case 'ball':
        audio.play('squeeze');
        await o.squeeze();
        break;
      case 'leads':
        audio.play('paper');
        await o.slapLeads();
        this.hud.toast(`📇 The good leads. Next up: ${PROSPECTS[out.whale].name}.`);
        break;
      case 'gong':
        await tween(0.01, () => {});
        o.ringGong().then(() => {});
        await wait(0.45);
        audio.play('gong');
        this.fx.flash = 0.4;
        await wait(0.3);
        audio.play('cheer', { gain: 0.6 });
        o.cheer(false);
        await wait(1.6);
        if (Math.random() < 0.5) await this.say(`brad.taunt.${pickI(OFFICE_LINES.brad.taunt)}`, 'room');
        break;
    }
    for (const n of out.notes) this.hud.float(n, id === 'snow' ? '#e0f7ff' : '#ffd166');
    this.hud.refresh(g);
    if (out.fatal === 'cardiac') await this.collapse();
    else if (out.fatal === 'blackout') await this.blackout();
  }

  async collapse() {
    const g = this.game;
    this.collapsedNow = true;
    this.hud.busy();
    voice.stop();
    this.office.shake = 0.03;
    for (let i = 0; i < 6; i++) {
      audio.play('heartbeat', { gain: 1 });
      await wait(0.28);
    }
    audio.play('flatline');
    this.office.shake = 0;
    await this.fade(1, 1.2);
    audio.play('alarm');
    await this.say('chad.paramedics.0', 'room');
    if (g.call) {
      audio.setLine(false);
      g.endCall('hangup');
      this.office.lift = 0;
      this.office.setLineLight(false);
    }
    g.time = 17 * 60;
    g.player.hr = 72;
    g.player.bac = 0;
    await this.hud.modal(
      `<h2>🚑 Cardiac Event</h2>
       <p>Your heart hit ${FATAL_BPM}+ bpm. You wake up at St. Mercy's with a paper bracelet and a bill for $11,400.</p>
       <p>The day is over. Brad took your leads.</p>`,
      [{ id: 'ok', label: 'Discharge yourself AMA', key: 'ENTER' }],
      'grim',
    );
    await this.fade(0, 0.6);
  }

  async blackout() {
    const g = this.game;
    this.collapsedNow = true;
    voice.stop();
    await this.fade(1, 2.5);
    if (g.call) {
      audio.setLine(false);
      g.endCall('hangup');
      this.office.lift = 0;
      this.office.setLineLight(false);
    }
    g.advance(150);
    g.player.bac = 0.07;
    g.player.energy = 25;
    await this.hud.modal(
      `<h2>🍺 Blackout</h2>
       <p>You wake up face-down on your keyboard at <b>${g.clock}</b>. Someone drew a mustache on you with a Sharpie. Brad is filming.</p>
       <p>The call is long gone.</p>`,
      [{ id: 'ok', label: 'Wipe off the drool', key: 'ENTER' }],
      'grim',
    );
    await this.fade(0, 1);
  }

  async fade(to, secs) {
    const from = this.fx.black;
    await tween(secs, (k) => (this.fx.black = from + (to - from) * k));
  }

  // ── end of day / shop / ending ───────────────────────────────────────────
  async endOfDay() {
    const g = this.game;
    this.hud.showLead(null);
    this.crmMode = 'idle';
    const r = g.endDay();
    await wait(0.5);
    await this.say(r.hit ? 'chad.quotaHit.0' : 'chad.quotaMiss.0', 'room');
    if (r.fired) {
      await this.say('chad.fired.0', 'room');
      await this.hud.modal(
        `<div class="daybig bad">FIRED</div>
         <p>Two missed quotas. Security walks you out holding a box containing: one stapler (seized at the door), ${g.stats.beers} empty tallboys, and your dignity (sold separately).</p>
         ${this.statsHTML()}`,
        [{ id: 'again', label: 'Beg for your job back (restart)', key: 'ENTER' }],
        'grim',
      );
      location.reload();
      return false;
    }
    if (g.dayIndex === DAYS.length - 1) return true;

    // Summary + shop
    let bought = '';
    while (true) {
      const p = g.player;
      const shop = SHOP.map(
        (s) => `<button class="shopitem ${p.upgrades[s.id] ? 'owned' : ''}" data-choice="${s.id}" ${p.upgrades[s.id] || p.cash < s.price ? 'disabled' : ''}>
          <b>${s.name}</b><span>${s.desc}</span><em>${p.upgrades[s.id] ? 'OWNED' : money(s.price)}</em></button>`,
      ).join('');
      const choice = await this.hud.modal(
        `<div class="daybig ${r.hit ? '' : 'bad'}">${g.day.name}: ${r.hit ? 'QUOTA HIT' : 'QUOTA MISSED'}</div>
         <p class="quota">${money(r.bookings)} of ${money(r.quota)} ${r.hit ? '🔔' : `— strike ${r.strikes} of 2`}</p>
         <h3>Happy Hour at the Bull &amp; Bear 🍸 <small>Commission to spend: ${money(p.cash)}</small></h3>
         <div class="shop">${shop}</div>${bought}`,
        [{ id: 'next', label: `Go home, come back for ${DAYS[g.dayIndex + 1].name}`, key: 'ENTER' }],
        'shopmodal',
      );
      if (choice === 'next') break;
      if (g.buy(choice)) {
        audio.play('cash');
        bought = `<p class="bought">Bought: ${SHOP.find((s) => s.id === choice).name}.</p>`;
      }
    }
    await this.fade(1, 0.8);
    return true;
  }

  statsHTML() {
    const s = this.game.stats;
    return `<div class="stats">
      <div><b>${s.calls}</b>calls</div><div><b>${s.closes}</b>closes</div><div><b>${s.hangups}</b>hang-ups</div>
      <div><b>${money(s.dollars)}</b>booked</div><div><b>${s.beers}</b>tallboys</div><div><b>${s.lines}</b>lines</div>
      <div><b>${s.coffees}</b>coffees</div><div><b>${s.gongs}</b>gongs rung</div><div><b>${s.freestyles}</b>freestyles</div></div>`;
  }

  async ending() {
    const g = this.game;
    const r = { hit: g.bookings >= g.day.quota };
    const legendary = this.victoria;
    const title = legendary ? 'SALESPERSON OF THE YEAR' : 'YOU SURVIVED THE WEEK';
    const body = legendary
      ? `<p>You closed Victoria Sterling. $2.4M. Chad cried. Brad quit. They're naming the gong after you.</p><p class="hint">First prize: a Cadillac Eldorado. Second prize: a set of steak knives. You got the Cadillac.</p>`
      : `<p>You kept your job. Barely. Next week the quota goes up 40%, as is tradition.</p><p class="hint">${r.hit ? 'You hit Friday\'s number.' : 'You missed Friday, but it was your first strike... or was it?'} Close Victoria Sterling for the real ending.</p>`;
    if (legendary) {
      audio.play('gong');
      audio.play('cheer', { gain: 0.8 });
      this.office.cheer(true);
    }
    await this.hud.modal(`<div class="daybig">${title}</div>${body}${this.statsHTML()}`, [{ id: 'again', label: 'Run it back', key: 'ENTER' }], 'win');
    location.reload();
  }

  // ── per-frame ────────────────────────────────────────────────────────────
  update(dt, t) {
    const g = this.game;
    const p = g.player;
    const o = this.office;
    const pulse = this.hud.drawECG(dt, p.hr, t);
    o.update(dt, { bac: p.bac, hr: p.hr, pulse });
    o.gameMinutes = g.time;
    audio.setBody({ bac: p.bac, bpm: p.hr });

    const u = this.post.body;
    u.uTime.value = t;
    u.uDrunk.value += (Math.min(1.2, Math.max(0, (p.bac - 0.02) / 0.14)) - u.uDrunk.value) * Math.min(1, dt * 2);
    u.uWired.value += (Math.min(1, Math.max(0, (p.hr - 90) / 90)) - u.uWired.value) * Math.min(1, dt * 2);
    u.uPulse.value = pulse;
    u.uRed.value = p.hr >= DANGER_BPM ? 1 : 0;
    this.fx.flash *= Math.pow(0.05, dt);
    this.fx.gold *= Math.pow(0.3, dt);
    u.uFlash.value = this.fx.flash;
    u.uGold.value = this.fx.gold;
    u.uBlack.value = this.fx.black;

    o.crm.draw(dt, { game: g, mode: this.crmMode, wave: audio.waveform(), nextLead: { all: PROSPECTS } });
    if (this._clockAcc === undefined || (this._clockAcc += dt) > 0.5) {
      this._clockAcc = 0;
      this.hud.refresh(g);
    }
  }
}
