#!/usr/bin/env python3
"""
Re-bake the voice pack with Dia (Nari Labs, Apache-2.0, 2025).

Why: Dia generates *performances*, including nonverbals. The script's
<laugh>, <sigh>, <cough>, <gasp> tags become (laughs), (sighs), ... and Dia
actually laughs. Best for prospects' reactions and for Chad.

For a consistent voice per character, Dia continues from an audio prompt plus
its transcript. We use tools/voice/refs/<speaker>.wav with
tools/voice/refs/<speaker>.txt if they exist (see design_voices.py).

    pip install git+https://github.com/nari-labs/dia.git soundfile
    node tools/export-script.mjs
    python tools/voice/bake_dia.py --only gerald.,marjorie.,chad.
"""
import argparse
import os
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import load_script, out_dir, write_manifest, finish_audio, retag, DIA_TAGS  # noqa: E402

SR = 44100


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default='nari-labs/Dia-1.6B-0626')
    ap.add_argument('--refs', default=os.path.join(HERE, 'refs'))
    ap.add_argument('--only')
    ap.add_argument('--seed', type=int, default=7)
    args = ap.parse_args()

    import torch
    from dia.model import Dia

    model = Dia.from_pretrained(args.model, compute_dtype='float16')
    dest = out_dir()
    for n, line in enumerate(load_script(args.only), 1):
        spk = line['speaker']
        text = retag(line['text'], DIA_TAGS)
        if line['style'] == 'drunk':
            text = text.replace('. ', '... ') + ' (burps)'
        script = f'[S1] {text}'
        ref_wav = os.path.join(args.refs, spk + '.wav')
        ref_txt = os.path.join(args.refs, spk + '.txt')
        torch.manual_seed(args.seed + hash(spk) % 1000)
        if os.path.exists(ref_wav) and os.path.exists(ref_txt):
            prompt_text = '[S1] ' + open(ref_txt).read().strip() + ' '
            out = model.generate(prompt_text + script, audio_prompt=ref_wav, use_torch_compile=False)
        else:
            out = model.generate(script, use_torch_compile=False)
        audio = finish_audio(np.asarray(out, dtype=np.float32), SR)
        sf.write(os.path.join(dest, line['id'] + '.mp3'), audio, SR, format='MP3')
        print(f'[{n}] {line["id"]}', flush=True)
    write_manifest(engine='dia-1.6b')


if __name__ == '__main__':
    main()
