// ─────────────────────────────────────────────────────────────────────────────
//  Rules. Pure game logic: no DOM, no three.js, no audio. The Director turns
//  these outcomes into theatre.
// ─────────────────────────────────────────────────────────────────────────────
import { PROSPECTS, PLAYER_LINES } from '../data/script.js';

export const MOVES = [
  { id: 'rapport', key: '1', tactic: 'RAPPORT', name: 'Small Talk', power: 12, energy: 7, desc: 'Weather, sports, their logo. Builds trust.' },
  { id: 'discovery', key: '2', tactic: null, name: 'Discovery Question', power: 7, energy: 6, desc: 'Ask about their pain. Reveals weaknesses on the CRM.' },
  { id: 'logic', key: '3', tactic: 'LOGIC', name: "Hit 'Em With Stats", power: 14, energy: 11, desc: 'Numbers. ROI. Made-up percentages.' },
  { id: 'urgency', key: '4', tactic: 'URGENCY', name: 'Fake Deadline', power: 14, energy: 11, desc: '"This pricing expires at 5pm."' },
  { id: 'flattery', key: '5', tactic: 'FLATTERY', name: 'Blow Smoke', power: 13, energy: 7, desc: 'You are a visionary, sir.' },
  { id: 'fomo', key: '6', tactic: 'FOMO', name: 'Competitor FOMO', power: 14, energy: 10, desc: 'Their rival signed yesterday. Probably.' },
  { id: 'humor', key: '7', tactic: 'HUMOR', name: 'Crack a Joke', power: 14, energy: 9, desc: 'High risk, high reward. Know your room.' },
  { id: 'takeaway', key: '8', tactic: null, name: 'The Takeaway', power: 22, energy: 8, desc: '"Maybe this isn\'t for you." Devastating on the stubborn. Risky otherwise.' },
  { id: 'silence', key: '9', tactic: null, name: 'Strategic Silence', power: 0, energy: 0, desc: 'Say nothing. Next move hits twice as hard. Costs patience.' },
  { id: 'close', key: '0', tactic: null, name: 'ALWAYS BE CLOSING', power: 0, energy: 12, desc: 'Ask for the signature. Odds shown on the card.' },
  { id: 'freestyle', key: 'F', tactic: null, name: 'Freestyle', power: 16, energy: 10, desc: 'Type your own line. Spoken by live neural TTS.' },
];

export const ITEMS = {
  beer: { name: 'Tallboy', icon: '🍺', perDay: 6, desc: '+Confidence, +Buzz. Buzzed charm is real. So is slurring.' },
  snow: { name: 'Desk Snow™', icon: '❄️', perDay: 3, desc: '+Energy, +Confidence, +Heart rate. Over 120 bpm you act twice per turn. Over 190 you meet the paramedics.' },
  coffee: { name: 'Burnt Coffee', icon: '☕', perDay: 4, desc: '+Energy, a little +Heart rate.' },
  ball: { name: 'Stress Ball', icon: '🔴', perDay: 99, desc: 'Squeeze. Lowers heart rate. 3-turn cooldown.' },
  leads: { name: 'Glengarry Leads', icon: '📇', perDay: 1, desc: 'The good leads. Next dial is a whale. Between calls only.' },
  gong: { name: 'The Gong', icon: '🥁', perDay: 99, desc: 'Ring it after a close. Big confidence. Brad seethes.' },
};

export const SHOP = [
  { id: 'headset', name: 'Pro Headset', price: 1500, desc: 'Every move costs 3 less energy.' },
  { id: 'tape', name: 'Motivational Tapes', price: 900, desc: '+8 Confidence at the start of every call.' },
  { id: 'espresso', name: 'Espresso Machine', price: 2500, desc: 'Coffee gives double energy.' },
  { id: 'rolex', name: 'Rolex Submariner', price: 6000, desc: '+12 Confidence floor. People can hear a Rolex.' },
  { id: 'leads2', name: 'Extra Glengarry Leads', price: 3000, desc: '+1 Glengarry Leads per day.' },
];

export const DAYS = [
  { name: 'Monday', quota: 40000 },
  { name: 'Tuesday', quota: 75000 },
  { name: 'Wednesday', quota: 110000 },
  { name: 'Thursday', quota: 160000 },
  { name: 'Friday', quota: 220000 },
];

export const LEAD_POOL = ['gerald', 'karen', 'tyler', 'marjorie', 'siobhan', 'denise', 'chip'];
export const WIRED_BPM = 120;
export const DANGER_BPM = 165;
export const FATAL_BPM = 190;
export const BLACKOUT_BAC = 0.22;
const DAY_START = 9 * 60;
const DAY_END = 17 * 60;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export class Game {
  constructor() {
    this.player = {
      confidence: 50,
      energy: 80,
      bac: 0,
      hr: 72,
      cash: 0,
      totalBookings: 0,
      strikes: 0,
      upgrades: {},
      nosebleed: false,
    };
    this.stats = { beers: 0, lines: 0, coffees: 0, calls: 0, closes: 0, hangups: 0, gongs: 0, dollars: 0, biggest: 0, freestyles: 0 };
    this.dayIndex = -1;
    this.call = null;
    this.log = [];
  }

  get day() {
    return DAYS[this.dayIndex];
  }

  get clock() {
    const m = Math.floor(this.time);
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    return `${((h + 11) % 12) + 1}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  get wired() {
    return this.player.hr >= WIRED_BPM;
  }

  get dayOver() {
    return this.time >= DAY_END || this.leads.length === 0;
  }

  startDay() {
    this.dayIndex++;
    const p = this.player;
    this.time = DAY_START;
    this.bookings = 0;
    p.energy = 80;
    p.bac = 0;
    p.hr = 72;
    p.nosebleed = false;
    p.confidence = Math.max(p.confidence, 45 + (p.upgrades.rolex ? 12 : 0));
    this.items = Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => [k, v.perDay]));
    if (p.upgrades.leads2) this.items.leads += 1;
    this.ballCooldown = 0;
    this.justClosed = false;
    this.inboundDone = false;
    this.momDone = false;
    this.leads = shuffle(LEAD_POOL).slice(0, 6);
    if (this.dayIndex === 4) this.leads = [...this.leads.slice(0, 4), 'victoria'];
    return this.day;
  }

  advance(minutes) {
    this.time += minutes;
  }

  useLeads() {
    if (!this.items.leads || this.call) return null;
    this.items.leads--;
    const whale = pick(['denise', 'tyler']);
    this.leads.unshift(whale);
    return whale;
  }

  // ── calls ────────────────────────────────────────────────────────────────
  startCall(pid) {
    const def = PROSPECTS[pid];
    this.stats.calls++;
    this.justClosed = false;
    const p = this.player;
    if (p.upgrades.tape) p.confidence = clamp(p.confidence + 8, 0, 100);
    this.call = {
      pid,
      def,
      interest: def.interest,
      patience: def.patience,
      maxPatience: def.patience,
      objection: null,
      cleared: new Set(),
      used: new Set(),
      revealed: false,
      silence: 1,
      turn: 0,
      said: new Set(),
      lastTactic: null,
      actionsLeft: 1,
      itemUsed: false,
    };
    return this.call;
  }

  beginTurn() {
    const c = this.call;
    c.turn++;
    c.actionsLeft = this.wired ? 2 : 1;
    c.itemUsed = false;
  }

  voiceStyle() {
    const p = this.player;
    if (p.hr >= 140) return 'wired';
    if (p.bac >= 0.09) return 'drunk';
    if (this.wired) return 'wired';
    return 'sober';
  }

  closeOdds() {
    const c = this.call;
    if (!c) return 0;
    const { threshold } = c.def;
    const i = c.interest;
    let p = i >= threshold ? 0.8 + (i - threshold) / 60 : 0.6 * Math.pow(Math.max(0, i) / threshold, 2.2);
    p *= 0.8 + this.player.confidence / 250;
    if (c.objection !== null) p *= 0.5;
    if (c.def.boss && c.cleared.size < c.def.objections.length) p = Math.min(p, 0.03);
    return clamp(p, 0.02, 0.98);
  }

  multiplierFor(tactic) {
    return this.call.def.weak[tactic] ?? 1;
  }

  /** Resolve one player move. Returns an outcome for the Director. */
  playerMove(id, freestyle) {
    const c = this.call;
    const p = this.player;
    const move = MOVES.find((m) => m.id === id);
    const out = { move, id, style: this.voiceStyle(), notes: [], gain: 0, tier: 'neu', slurred: false };
    const energyCost = Math.max(0, move.energy - (p.upgrades.headset ? 3 : 0));
    const tired = p.energy <= 0;
    p.energy = clamp(p.energy - energyCost, 0, 100);
    c.actionsLeft--;
    this.stats.moves = (this.stats.moves || 0) + 1;

    // Pick which spoken line to use
    const variants = PLAYER_LINES[id];
    if (variants) {
      out.variant = Math.floor(Math.random() * variants.length);
      out.lineId = `player.${id}.${out.variant}.${out.style}`;
    }

    // Slurring: a drunk move can misfire.
    if (p.bac >= 0.09 && Math.random() < (p.bac - 0.07) * 4.5) {
      out.slurred = true;
      out.style = 'drunk';
      if (variants) out.lineId = `player.${id}.${out.variant}.drunk`;
      out.notes.push('SLURRED');
    }

    const rng = rnd(0.78, 1.22);
    const confMult = 0.6 + p.confidence / 160;

    if (id === 'silence') {
      c.silence = 2;
      c.patience -= 1;
      out.tier = 'silence';
      out.notes.push('NEXT MOVE ×2');
      return out;
    }

    if (id === 'close') {
      const odds = this.closeOdds();
      out.odds = odds;
      const roll = out.slurred ? odds * 0.5 : odds;
      out.close = Math.random() < roll ? 'yes' : 'no';
      if (out.close === 'no') {
        c.interest = clamp(c.interest - 12, 0, 100);
        c.patience -= 2;
        p.confidence = clamp(p.confidence - 8, 0, 100);
        out.tier = 'neg';
      } else {
        out.tier = 'pos';
      }
      return out;
    }

    let tactic = move.tactic;
    if (id === 'freestyle') {
      tactic = freestyle.tactic;
      out.freestyle = freestyle;
      this.stats.freestyles++;
    }
    out.tactic = tactic;

    let gain;
    if (id === 'discovery') {
      if (!c.revealed) {
        c.revealed = true;
        out.revealed = true;
        gain = move.power * rng * confMult;
        out.notes.push('WEAKNESSES REVEALED');
      } else {
        gain = 2;
        out.notes.push('YOU ALREADY ASKED THAT');
      }
    } else if (id === 'takeaway') {
      if (c.def.stubborn) {
        gain = move.power * rng * confMult;
        out.notes.push('THEY HATE BEING TOLD NO');
      } else if (c.interest >= 45 && Math.random() < 0.6) {
        gain = 16 * rng;
        out.notes.push('THE TAKEAWAY WORKED');
      } else {
        gain = -12;
        c.patience -= 1;
        out.notes.push('THEY TOOK THE TAKEAWAY');
      }
    } else {
      const mult = tactic ? this.multiplierFor(tactic) : 1;
      out.mult = mult;
      if (mult >= 1.5) out.eff = 'super';
      else if (mult <= 0.6) out.eff = 'weak';
      if (mult <= 0.5) {
        gain = -move.power * 0.45 * rng;
        out.notes.push('BACKFIRED');
      } else {
        let power = (freestyle?.power ?? move.power) * mult * confMult * rng;
        if (p.bac >= 0.02 && p.bac < 0.12 && ['RAPPORT', 'HUMOR', 'FLATTERY'].includes(tactic)) {
          power *= 1.25;
          out.notes.push('LIQUID CHARM');
        }
        if (this.wired) {
          if (tactic === 'URGENCY') {
            power *= 1.35;
            out.notes.push('WIRED URGENCY');
          } else if (tactic === 'RAPPORT') power *= 0.8;
        }
        if (p.nosebleed && ['RAPPORT', 'FLATTERY'].includes(tactic)) power *= 0.8;
        if (c.lastTactic === tactic) {
          power *= 0.6;
          out.notes.push('REPETITIVE');
        }
        if (Math.random() < 0.06 + p.confidence / 2000) {
          power *= 1.8;
          out.crit = true;
          out.notes.push('CRUSHED IT');
        }
        gain = power;
      }
    }

    // Objections: counter it or suffer.
    if (c.objection !== null) {
      const obj = c.def.objections[c.objection];
      if (tactic && obj.counter === tactic) {
        gain = Math.abs(gain) * 1.35 + 3;
        c.cleared.add(c.objection);
        out.countered = obj;
        c.objection = null;
        out.notes.push('OBJECTION HANDLED');
      } else if (gain > 0) {
        gain *= 0.55;
      }
    }

    if (tired) {
      gain *= 0.5;
      out.notes.push('EXHAUSTED');
    }
    if (out.slurred) gain = Math.min(gain, 3) - 4;
    gain *= c.silence;
    if (c.silence > 1) out.notes.push('SILENCE PAID OFF');
    c.silence = 1;
    c.lastTactic = tactic;

    gain = Math.round(gain);
    out.gain = gain;
    c.interest = clamp(c.interest + gain, 0, 100);
    out.tier = gain >= 13 ? 'pos' : gain >= 4 ? 'neu' : 'neg';
    if (out.tier === 'neg') c.patience -= 1;
    p.confidence = clamp(p.confidence + (out.tier === 'pos' ? 4 : out.tier === 'neg' ? -5 : 0), 0, 100);
    return out;
  }

  /** Prospect's turn after the player has used their actions. */
  prospectTurn() {
    const c = this.call;
    const p = this.player;
    this.advance(6);
    c.patience -= 1;
    if (c.def.decay) c.interest = clamp(c.interest - c.def.decay, 0, 100);
    // Physiology drifts every turn
    p.hr = clamp(p.hr - 3, 60, 250);
    p.bac = clamp(p.bac - 0.005, 0, 1);
    p.energy = clamp(p.energy + 2, 0, 100);
    if (this.ballCooldown > 0) this.ballCooldown--;

    if (c.patience <= 0) return { type: 'hangup' };
    const remaining = c.def.objections.map((_, i) => i).filter((i) => !c.used.has(i) && !c.cleared.has(i));
    const bossy = c.def.boss && remaining.length;
    if (c.objection === null && remaining.length && (bossy || (c.turn >= 1 && Math.random() < 0.5))) {
      const i = pick(remaining);
      c.objection = i;
      c.used.add(i);
      return { type: 'objection', index: i, obj: c.def.objections[i] };
    }
    return { type: 'none' };
  }

  endCall(result) {
    const c = this.call;
    const p = this.player;
    const out = { result, pid: c.pid, value: 0 };
    if (result === 'closed') {
      out.value = c.def.value;
      out.commission = Math.round(c.def.value * 0.1);
      this.bookings += out.value;
      p.totalBookings += out.value;
      p.cash += out.commission;
      p.confidence = clamp(p.confidence + 20, 0, 100);
      this.justClosed = !c.def.gatekeeper;
      if (!c.def.gatekeeper) this.stats.closes++;
      this.stats.dollars += out.value;
      this.stats.biggest = Math.max(this.stats.biggest, out.value);
    } else if (result === 'hangup') {
      p.confidence = clamp(p.confidence - 12, 0, 100);
      this.stats.hangups++;
    }
    this.advance(4);
    this.call = null;
    return out;
  }

  // ── items ────────────────────────────────────────────────────────────────
  canUse(id) {
    if (!this.items || this.items[id] <= 0) return false;
    if (this.call?.itemUsed) return false;
    if (id === 'ball' && this.ballCooldown > 0) return false;
    if (id === 'leads' && this.call) return false;
    if (id === 'gong' && !this.justClosed) return false;
    return true;
  }

  useItem(id) {
    if (!this.canUse(id)) return null;
    const p = this.player;
    this.items[id]--;
    if (this.call) this.call.itemUsed = true;
    const out = { id, notes: [] };
    switch (id) {
      case 'beer':
        p.confidence = clamp(p.confidence + 9, 0, 100);
        p.bac += 0.032;
        p.hr = clamp(p.hr - 4, 60, 250);
        this.stats.beers++;
        out.notes.push('+9 CONFIDENCE', '+BUZZ');
        break;
      case 'snow':
        p.energy = clamp(p.energy + 45, 0, 100);
        p.confidence = clamp(p.confidence + 15, 0, 100);
        p.hr += 40;
        this.stats.lines++;
        out.notes.push('+45 ENERGY', '+40 BPM');
        if (!p.nosebleed && Math.random() < 0.25) {
          p.nosebleed = true;
          out.nosebleed = true;
          out.notes.push('NOSEBLEED');
        }
        break;
      case 'coffee':
        p.energy = clamp(p.energy + (p.upgrades.espresso ? 40 : 20), 0, 100);
        p.hr += 10;
        this.stats.coffees++;
        out.notes.push(`+${p.upgrades.espresso ? 40 : 20} ENERGY`);
        break;
      case 'ball':
        p.hr = clamp(p.hr - 22, 60, 250);
        p.confidence = clamp(p.confidence + 3, 0, 100);
        this.ballCooldown = 3;
        out.notes.push('-22 BPM');
        break;
      case 'leads':
        this.items.leads++; // useLeads() decrements
        out.whale = this.useLeads();
        out.notes.push('WHALE INCOMING');
        break;
      case 'gong':
        p.confidence = clamp(p.confidence + 12, 0, 100);
        this.justClosed = false;
        this.stats.gongs++;
        out.notes.push('+12 CONFIDENCE');
        break;
    }
    if (p.hr >= FATAL_BPM) out.fatal = 'cardiac';
    else if (p.bac >= BLACKOUT_BAC) out.fatal = 'blackout';
    return out;
  }

  // ── end of day ───────────────────────────────────────────────────────────
  endDay() {
    const hit = this.bookings >= this.day.quota;
    if (!hit) this.player.strikes++;
    return { hit, bookings: this.bookings, quota: this.day.quota, strikes: this.player.strikes, fired: this.player.strikes >= 2 };
  }

  buy(id) {
    const item = SHOP.find((s) => s.id === id);
    if (!item || this.player.upgrades[id] || this.player.cash < item.price) return false;
    this.player.cash -= item.price;
    this.player.upgrades[id] = true;
    return true;
  }
}

// ── Freestyle: classify a typed line into a tactic ─────────────────────────
const LEXICON = {
  RAPPORT: /\b(weather|weekend|family|kids|dog|cat|how are you|how's it|golf|game|team|friend|buddy|pal|feel|understand|hear you|sorry|thanks|thank you|love)\b/gi,
  LOGIC: /\b(\d+%?|percent|roi|save|saving|cost|data|numbers?|efficien\w*|revenue|margin|budget|price|pricing|math|metric\w*|results?|proven|study)\b/gi,
  URGENCY: /\b(today|now|tonight|deadline|expires?|expiring|limited|last|only|hurry|quick|asap|immediately|5 ?pm|end of (day|quarter|month)|before)\b/gi,
  FLATTERY: /\b(smart|sharp|brilliant|genius|visionary|impressive|amazing|legend|leader|best|great taste|handsome|beautiful|gorgeous|respect)\b/gi,
  FOMO: /\b(competitor\w*|rival\w*|everyone|everybody|behind|miss out|left behind|signed|industry|others?|trend\w*|last one)\b/gi,
  HUMOR: /\b(lol|haha|joke|funny|walks into a bar|knock knock|pun|kidding|banana|clown|pizza|ha)\b|[😂🤣😅]/gi,
};

export function classifyFreestyle(text, pid) {
  const scores = {};
  for (const [t, re] of Object.entries(LEXICON)) scores[t] = (text.match(re) || []).length;
  if (/\?\s*$/.test(text)) scores.RAPPORT += 0.5;
  if ((text.match(/!/g) || []).length >= 2) scores.URGENCY += 0.5;
  const [top, score] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const matched = score > 0;
  const tactic = matched ? top : 'RAPPORT';
  let power = matched ? 14 + Math.min(8, score * 2) : 8;
  const words = text.trim().split(/\s+/).length;
  const notes = [];
  if (words > 45) {
    power *= 0.6;
    notes.push('RAMBLING');
  }
  if (words < 3) power *= 0.6;
  if (/synerg/i.test(text)) {
    if (pid === 'siobhan') {
      power = -30;
      notes.push('SHE SAID NOT TO SAY SYNERGY');
    } else notes.push('SYNERGY');
  }
  if (/\b(please|beg|desperate)\b/i.test(text)) {
    power *= 0.7;
    notes.push('DESPERATION DETECTED');
  }
  return { text, tactic, power, notes, scores };
}
