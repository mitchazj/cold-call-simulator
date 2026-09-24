#!/usr/bin/env node
// Exports every voice line and SFX prompt to JSONL so the Python bakers
// (tools/voice/*.py, tools/sfx/*.py) can render them with neural models.
//
//   node tools/export-script.mjs            -> tools/voice/script.jsonl, tools/sfx/prompts.jsonl
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLines, stripTags } from '../src/data/lines.js';
import { CAST, SFX_PROMPTS } from '../src/data/script.js';

const here = dirname(fileURLToPath(import.meta.url));

const lines = buildLines().map((l) => ({
  ...l,
  clean: stripTags(l.text),
  design: CAST[l.speaker].design,
}));
writeFileSync(join(here, 'voice/script.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');

const sfx = Object.entries(SFX_PROMPTS).map(([id, s]) => ({ id, ...s }));
writeFileSync(join(here, 'sfx/prompts.jsonl'), sfx.map((s) => JSON.stringify(s)).join('\n') + '\n');

writeFileSync(
  join(here, 'voice/cast.json'),
  JSON.stringify(CAST, null, 2) + '\n',
);

console.log(`exported ${lines.length} voice lines, ${sfx.length} sfx prompts`);
