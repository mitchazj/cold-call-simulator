#!/usr/bin/env node
// Headless balance check: plays thousands of weeks with a few bot policies
// and reports close rates and how often each day's quota is hit.
//   node tools/sim.mjs [weeks]
import { Game, DAYS, MOVES } from '../src/game/rules.js';

const TACTIC_MOVE = { RAPPORT: 'rapport', LOGIC: 'logic', URGENCY: 'urgency', FLATTERY: 'flattery', FOMO: 'fomo', HUMOR: 'humor' };
const MOVE_IDS = MOVES.filter((m) => m.tactic).map((m) => m.id);

const policies = {
  // mashes random tactics, closes when interest looks high
  random(g) {
    const c = g.call;
    if (c.interest >= c.def.threshold) return 'close';
    return MOVE_IDS[Math.floor(Math.random() * MOVE_IDS.length)];
  },
  // discovery, then best weakness, counters objections, closes at >55% odds
  smart(g) {
    const c = g.call;
    if (!c.revealed) return 'discovery';
    if (g.closeOdds() > 0.55) return 'close';
    if (c.objection !== null) return TACTIC_MOVE[c.def.objections[c.objection].counter];
    const best = Object.entries(c.def.weak).sort((a, b) => b[1] - a[1]).map(([t]) => TACTIC_MOVE[t]);
    return best.find((m) => m !== TACTIC_MOVE[c.lastTactic]) || best[0];
  },
};

function items(g, style) {
  const p = g.player;
  if (style === 'sober') return;
  if (p.confidence < 55 && p.bac < 0.07) g.useItem('beer');
  else if (p.energy < 30 && p.hr < 125) g.useItem('snow');
  else if (p.energy < 30) g.useItem('coffee');
  else if (p.hr > 150) g.useItem('ball');
}

function playWeek(policy, style) {
  const g = new Game();
  const res = { hits: [], closes: 0, calls: 0, fired: false, victoria: false, dead: 0 };
  for (let d = 0; d < DAYS.length; d++) {
    g.startDay();
    while (!g.dayOver) {
      if (g.items.leads && Math.random() < 0.5) g.useLeads();
      let pid = g.leads.shift();
      while (pid) {
        g.startCall(pid);
        res.calls++;
        let outcome = null;
        while (!outcome) {
          g.beginTurn();
          items(g, style);
          if (g.player.hr >= 190) {
            res.dead++;
            g.time = 17 * 60;
            outcome = 'hangup';
            break;
          }
          while (g.call.actionsLeft > 0 && !outcome) {
            const out = g.playerMove(policies[policy](g));
            if (out.close === 'yes') outcome = 'closed';
            else if (g.call.patience <= 0) outcome = 'hangup';
          }
          if (!outcome && g.prospectTurn().type === 'hangup') outcome = 'hangup';
        }
        const def = g.call.def;
        g.endCall(outcome);
        if (outcome === 'closed' && !def.gatekeeper) res.closes++;
        if (outcome === 'closed' && def.boss) res.victoria = true;
        pid = outcome === 'closed' && def.next ? def.next : null;
      }
    }
    const e = g.endDay();
    res.hits.push(e.hit);
    if (e.fired) {
      res.fired = true;
      break;
    }
  }
  return res;
}

const N = +(process.argv[2] || 2000);
for (const policy of Object.keys(policies)) {
  for (const style of ['sober', 'party']) {
    const hits = DAYS.map(() => 0);
    let closes = 0, calls = 0, fired = 0, victoria = 0, dead = 0;
    for (let i = 0; i < N; i++) {
      const r = playWeek(policy, style);
      r.hits.forEach((h, d) => (hits[d] += h));
      closes += r.closes;
      calls += r.calls;
      fired += r.fired;
      victoria += r.victoria;
      dead += r.dead;
    }
    console.log(
      `${policy.padEnd(6)} ${style.padEnd(5)} close rate ${((closes / calls) * 100).toFixed(0).padStart(3)}%  ` +
        `quota hit ${DAYS.map((d, i) => d.name.slice(0, 3) + ' ' + ((hits[i] / N) * 100).toFixed(0).padStart(3) + '%').join('  ')}  ` +
        `fired ${((fired / N) * 100).toFixed(0)}%  victoria ${((victoria / N) * 100).toFixed(0)}%  ambulance/wk ${(dead / N).toFixed(2)}`,
    );
  }
}
