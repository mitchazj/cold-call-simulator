#!/usr/bin/env python3
"""
Re-bake the voice pack with Chatterbox (Resemble AI, MIT, 2025).

Why: Chatterbox has an `exaggeration` knob (emotion intensity) and zero-shot
voice cloning. We drive exaggeration from the line's style: drunk and wired
lines get pushed hard, Chad is always at 11.

Reference voices: each speaker needs a short clip (5-15 s) in
tools/voice/refs/<speaker>.wav. Make them with design_voices.py (Qwen3-TTS
VoiceDesign, from the text prompts in the script), record your friends, or
let this script fall back to the speaker's longest Kokoro clip.

    pip install chatterbox-tts soundfile
    node tools/export-script.mjs
    python tools/voice/bake_chatterbox.py --device cuda          # everything
    python tools/voice/bake_chatterbox.py --only chad.,player.   # just some
"""
import argparse
import glob
import os
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import load_script, out_dir, write_manifest, finish_audio, stripped  # noqa: E402

# (exaggeration, cfg_weight). Lower cfg = faster, looser delivery.
STYLE = {'sober': (0.55, 0.5), 'drunk': (0.95, 0.25), 'wired': (0.85, 0.2)}
LOUD = {'chad': 0.3, 'brad': 0.2, 'tyler': 0.15, 'chip': 0.15}


def reference_for(speaker, refs_dir, voice_dir):
    p = os.path.join(refs_dir, speaker + '.wav')
    if os.path.exists(p):
        return p
    # fall back to the longest existing clip for that speaker
    prefix = 'player.' if speaker == 'player' else speaker + '.'
    clips = [c for c in glob.glob(os.path.join(voice_dir, prefix + '*')) if '.drunk' not in c and '.wired' not in c]
    if not clips:
        return None
    return max(clips, key=lambda c: sf.info(c).duration)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--device', default='cuda')
    ap.add_argument('--refs', default=os.path.join(HERE, 'refs'))
    ap.add_argument('--only')
    ap.add_argument('--turbo', action='store_true', help='use Chatterbox-Turbo if your install has it')
    args = ap.parse_args()

    if args.turbo:
        from chatterbox.tts_turbo import ChatterboxTurboTTS as Model
    else:
        from chatterbox.tts import ChatterboxTTS as Model
    model = Model.from_pretrained(device=args.device)

    dest = out_dir()
    lines = load_script(args.only)
    refs = {}
    for n, line in enumerate(lines, 1):
        spk = line['speaker']
        if spk not in refs:
            refs[spk] = reference_for(spk, args.refs, dest)
        ex, cfg = STYLE[line['style']]
        ex = min(1.2, ex + LOUD.get(spk, 0))
        text = stripped(line['text'])
        kwargs = dict(exaggeration=ex, cfg_weight=cfg)
        if refs[spk]:
            kwargs['audio_prompt_path'] = refs[spk]
        wav = model.generate(text, **kwargs)
        audio = finish_audio(wav.squeeze().cpu().numpy(), model.sr)
        sf.write(os.path.join(dest, line['id'] + '.mp3'), audio, model.sr, format='MP3')
        print(f'[{n}/{len(lines)}] {line["id"]} ex={ex:.2f}', flush=True)
    write_manifest(engine='chatterbox' + ('-turbo' if args.turbo else ''))


if __name__ == '__main__':
    main()
