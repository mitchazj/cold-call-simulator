#!/usr/bin/env python3
"""
Design every character's voice from a text prompt, with Qwen3-TTS VoiceDesign
(Alibaba Qwen, Apache-2.0, 2026).

Each character in src/data/script.js has a `design` prompt, for example:
  gerald: "Male, 60s, Oklahoma accent, gravelly, gruff small-business owner..."
This script turns those prompts into a reference clip per character in
tools/voice/refs/<speaker>.wav (+ .txt transcript). The cloning bakers
(bake_chatterbox.py, bake_dia.py) then use those clips, so the whole cast
comes from prompts alone.

With --all it skips the cloning step and voices every line directly with
VoiceDesign (slower, but each line gets the full description).

    pip install qwen-tts soundfile
    node tools/export-script.mjs
    python tools/voice/design_voices.py            # refs only
    python tools/voice/design_voices.py --all      # the whole pack
"""
import argparse
import json
import os
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import load_script, out_dir, write_manifest, finish_audio, stripped  # noqa: E402

# What each character says in their reference clip: a representative line.
SAMPLE = "Look, I've heard every pitch in the book, so you've got about thirty seconds. Go ahead. Impress me."
STYLE_NOTE = {
    'drunk': ' Speaking drunk: slurred, slow, sloppy, overly friendly.',
    'wired': ' Speaking extremely fast and jittery, like they have had way too much stimulant.',
    'sober': '',
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default='Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign')
    ap.add_argument('--refs', default=os.path.join(HERE, 'refs'))
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--only')
    args = ap.parse_args()

    import torch
    from qwen_tts import Qwen3TTSModel

    model = Qwen3TTSModel.from_pretrained(args.model, device_map='cuda:0' if torch.cuda.is_available() else 'cpu', dtype=torch.bfloat16)
    cast = json.load(open(os.path.join(HERE, 'cast.json')))

    def design(text, instruct):
        wavs, sr = model.generate_voice_design(text=text, language='English', instruct=instruct)
        return np.asarray(wavs[0], dtype=np.float32), sr

    if not args.all:
        os.makedirs(args.refs, exist_ok=True)
        for spk, c in cast.items():
            audio, sr = design(SAMPLE, c['design'])
            sf.write(os.path.join(args.refs, spk + '.wav'), finish_audio(audio, sr), sr)
            open(os.path.join(args.refs, spk + '.txt'), 'w').write(SAMPLE)
            print('designed', spk, '→', c['design'])
        return

    dest = out_dir()
    for n, line in enumerate(load_script(args.only), 1):
        instruct = cast[line['speaker']]['design'] + STYLE_NOTE[line['style']]
        audio, sr = design(stripped(line['text']), instruct)
        sf.write(os.path.join(dest, line['id'] + '.mp3'), finish_audio(audio, sr), sr, format='MP3')
        print(f'[{n}] {line["id"]}', flush=True)
    write_manifest(engine='qwen3-tts-voicedesign')


if __name__ == '__main__':
    main()
