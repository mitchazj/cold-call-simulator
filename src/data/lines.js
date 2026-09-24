// Flattens the script into addressable voice lines: { id, speaker, text, style }.
// Shared by the game (to look up audio) and tools/export-script.mjs (to bake it).
import { CAST, PLAYER_LINES, PLAYER_DRUNK, PROSPECTS, OFFICE_LINES } from './script.js';

export const STYLES = {
  sober: { speed: 1.05 },
  drunk: { speed: 0.82 },
  wired: { speed: 1.42 },
};

// Removes performance tags for engines/subtitles that can't use them.
export function stripTags(text) {
  return text.replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim();
}

export function buildLines() {
  const lines = [];
  const add = (id, speaker, text, style = 'sober') => lines.push({ id, speaker, text, style });

  for (const [move, variants] of Object.entries(PLAYER_LINES)) {
    variants.forEach((text, i) => {
      add(`player.${move}.${i}.sober`, 'player', text, 'sober');
      add(`player.${move}.${i}.wired`, 'player', text, 'wired');
      add(`player.${move}.${i}.drunk`, 'player', PLAYER_DRUNK[move][i], 'drunk');
    });
  }

  for (const [pid, p] of Object.entries(PROSPECTS)) {
    for (const [key, variants] of Object.entries(p.lines)) {
      variants.forEach((text, i) => add(`${pid}.${key}.${i}`, p.speaker, text));
    }
    p.objections.forEach((o, i) => add(`${pid}.obj.${i}`, p.speaker, o.line));
  }

  for (const [speaker, groups] of Object.entries(OFFICE_LINES)) {
    for (const [key, variants] of Object.entries(groups)) {
      variants.forEach((text, i) => add(`${speaker}.${key}.${i}`, speaker, text));
    }
  }

  for (const l of lines) {
    l.voice = CAST[l.speaker].kokoro;
    l.speed = STYLES[l.style].speed;
  }
  return lines;
}

let _index;
export function lineById(id) {
  if (!_index) _index = new Map(buildLines().map((l) => [l.id, l]));
  return _index.get(id);
}
