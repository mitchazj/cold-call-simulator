#!/usr/bin/env python3
"""
Bake the shipped voice pack with Kokoro-82M (Apache-2.0, hexgrad, 2025).

Kokoro is tiny (82M params), runs faster than real time on a laptop CPU via
ONNX, and has ~50 stock voices, which makes it the default engine for the
voice pack that ships in public/audio/voice. For more expressive takes
(laughs, sighs, real slurring) re-bake with one of the other bakers in this
folder; they all write the same manifest format.

    pip install kokoro-onnx soundfile
    # model files (GitHub mirror of the HF weights):
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
    node tools/export-script.mjs
    python tools/voice/bake_kokoro.py --model kokoro-v1.0.int8.onnx --voices voices-v1.0.bin
"""
import argparse
import json
import os
import sys
import time

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import load_script, out_dir, write_manifest, finish_audio  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default='kokoro-v1.0.int8.onnx')
    ap.add_argument('--voices', default='voices-v1.0.bin')
    ap.add_argument('--only', help='comma-separated id prefixes to (re)bake')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--shard', default='0/1', help='i/n: bake every n-th line starting at i (run several in parallel)')
    args = ap.parse_args()

    from kokoro_onnx import Kokoro

    kokoro = Kokoro(args.model, args.voices)
    lines = load_script(args.only)
    si, sn = (int(x) for x in args.shard.split('/'))
    lines = lines[si::sn]
    dest = out_dir()
    t0 = time.time()
    for n, line in enumerate(lines, 1):
        path = os.path.join(dest, line['id'] + '.mp3')
        if os.path.exists(path) and not args.force:
            continue
        audio, sr = kokoro.create(line['clean'], voice=line['voice'], speed=line['speed'], lang='en-us' if line['voice'][0] == 'a' else 'en-gb')
        audio = finish_audio(np.asarray(audio, dtype=np.float32), sr)
        sf.write(path, audio, sr, format='MP3', bitrate_mode='VARIABLE', compression_level=0.75)
        print(f'[{n}/{len(lines)}] {line["id"]} ({len(audio) / sr:.1f}s)  {time.time() - t0:.0f}s elapsed', flush=True)
    write_manifest(engine='kokoro-82m-v1.0')


if __name__ == '__main__':
    main()
