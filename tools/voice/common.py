"""Shared helpers for the voice bakers."""
import json
import os
import re

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SCRIPT = os.path.join(HERE, 'script.jsonl')
OUT = os.path.join(ROOT, 'public', 'audio', 'voice')

# Tag vocabularies for the expressive engines.
DIA_TAGS = {'laugh': '(laughs)', 'sigh': '(sighs)', 'gasp': '(gasps)', 'cough': '(coughs)',
            'sniff': '(sniffs)', 'groan': '(groans)', 'hiccup': '(coughs)', 'whisper': ''}
ORPHEUS_TAGS = {'laugh': '<laugh>', 'sigh': '<sigh>', 'gasp': '<gasp>', 'cough': '<cough>',
                'sniff': '<sniffle>', 'groan': '<groan>', 'hiccup': '<cough>', 'whisper': ''}
MAYA_TAGS = {'laugh': '<laugh>', 'sigh': '<sigh>', 'gasp': '<gasp>', 'cough': '<cough>',
             'sniff': '<sniff>', 'groan': '<groan>', 'hiccup': '<cough>', 'whisper': '<whisper>'}


def load_script(only=None):
    if not os.path.exists(SCRIPT):
        raise SystemExit('Run `node tools/export-script.mjs` first.')
    with open(SCRIPT) as f:
        lines = [json.loads(l) for l in f if l.strip()]
    if only:
        prefixes = tuple(p.strip() for p in only.split(','))
        lines = [l for l in lines if l['id'].startswith(prefixes)]
    return lines


def retag(text, vocab):
    return re.sub(r'<(\w+)>', lambda m: vocab.get(m.group(1), ''), text).strip()


def out_dir():
    os.makedirs(OUT, exist_ok=True)
    return OUT


def finish_audio(audio, sr, pad=0.08):
    """Trim silence, normalise to -1 dBFS peak, add a short tail."""
    audio = np.asarray(audio, dtype=np.float32).flatten()
    thresh = 0.01 * (np.max(np.abs(audio)) + 1e-9)
    idx = np.where(np.abs(audio) > thresh)[0]
    if len(idx):
        audio = audio[max(0, idx[0] - int(0.02 * sr)): idx[-1] + int(0.05 * sr)]
    audio = audio / (np.max(np.abs(audio)) + 1e-9) * 0.89
    return np.concatenate([audio, np.zeros(int(pad * sr), dtype=np.float32)])


def write_manifest(engine):
    """Index every baked clip so the game knows what exists."""
    import soundfile as sf
    files = {}
    for name in sorted(os.listdir(OUT)):
        if not name.endswith(('.mp3', '.wav', '.ogg')):
            continue
        lid = name.rsplit('.', 1)[0]
        try:
            info = sf.info(os.path.join(OUT, name))
            dur = round(info.frames / info.samplerate, 2)
        except Exception:
            dur = None
        files[lid] = {'file': name, 'dur': dur}
    manifest = {'engine': engine, 'count': len(files), 'lines': files}
    with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=0)
    print(f'manifest: {len(files)} clips ({engine})')


def stripped(text):
    """Drop performance tags entirely (for engines that don't do nonverbals)."""
    return re.sub(r'\s{2,}', ' ', re.sub(r'<[^>]+>', '', text)).strip()
