#!/usr/bin/env python3
"""
Generate the game's sound effects from text prompts.

Engines:
  • stable-audio-open-small  (Stability AI + Arm, 2025) — 341M params, fast
    enough for a laptop CPU, up to ~11 s. Default.
  • tangoflux                (declare-lab, 2025) — flow-matching TTA, 44.1 kHz,
    very good at foley. Needs a GPU to be pleasant.

Prompts live in src/data/script.js (SFX_PROMPTS). Every effect also has a
procedural WebAudio fallback in src/audio/engine.js, so baking is optional:
baked files simply override the synthesized ones.

    node tools/export-script.mjs
    pip install stable-audio-tools einops soundfile        # or: pip install tangoflux
    python tools/sfx/bake_sfx.py                           # all effects
    python tools/sfx/bake_sfx.py --engine tangoflux --only gong,cheer
    python tools/sfx/bake_sfx.py --variants 4              # pick your favourite take
"""
import argparse
import json
import os

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'public', 'audio', 'sfx')
PROMPTS = os.path.join(HERE, 'prompts.jsonl')


def trim_and_fade(audio, sr, secs):
    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim > 1:
        audio = audio.mean(axis=0) if audio.shape[0] < audio.shape[-1] else audio.mean(axis=1)
    audio = audio[: int(secs * sr)]
    peak = np.max(np.abs(audio)) + 1e-9
    audio = audio / peak * 0.9
    fade = min(len(audio) // 4, int(0.05 * sr))
    if fade:
        audio[-fade:] *= np.linspace(1, 0, fade)
    return audio


class StableAudioSmall:
    def __init__(self, device):
        import torch
        from stable_audio_tools import get_pretrained_model

        self.torch = torch
        self.device = device
        self.model, cfg = get_pretrained_model('stabilityai/stable-audio-open-small')
        self.model = self.model.to(device)
        self.sr = cfg['sample_rate']
        self.size = cfg['sample_size']

    def __call__(self, prompt, secs):
        from einops import rearrange
        from stable_audio_tools.inference.generation import generate_diffusion_cond

        cond = [{'prompt': prompt, 'seconds_total': min(11, secs)}]
        out = generate_diffusion_cond(self.model, steps=8, conditioning=cond, sample_size=self.size, sampler_type='pingpong', device=self.device)
        out = rearrange(out, 'b d n -> d (b n)').to(self.torch.float32).cpu().numpy()
        return out, self.sr


class TangoFlux:
    def __init__(self, device):
        from tangoflux import TangoFluxInference

        self.model = TangoFluxInference(name='declare-lab/TangoFlux', device=device)
        self.sr = 44100

    def __call__(self, prompt, secs):
        audio = self.model.generate(prompt, steps=50, duration=min(30, max(1, secs)))
        return audio.cpu().numpy(), self.sr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--engine', default='stable-audio-open-small', choices=['stable-audio-open-small', 'tangoflux'])
    ap.add_argument('--device', default='cuda')
    ap.add_argument('--only')
    ap.add_argument('--variants', type=int, default=1)
    args = ap.parse_args()

    if not os.path.exists(PROMPTS):
        raise SystemExit('Run `node tools/export-script.mjs` first.')
    items = [json.loads(l) for l in open(PROMPTS) if l.strip()]
    if args.only:
        keep = set(args.only.split(','))
        items = [i for i in items if i['id'] in keep]

    gen = StableAudioSmall(args.device) if args.engine == 'stable-audio-open-small' else TangoFlux(args.device)
    os.makedirs(OUT, exist_ok=True)
    manifest_path = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {'sfx': {}}
    for it in items:
        for v in range(args.variants):
            audio, sr = gen(it['prompt'], it['secs'])
            audio = trim_and_fade(audio, sr, it['secs'])
            name = it['id'] + (f'.v{v}' if args.variants > 1 else '') + '.mp3'
            sf.write(os.path.join(OUT, name), audio, sr, format='MP3')
            print('baked', name, '←', it['prompt'])
        if args.variants == 1:
            manifest['sfx'][it['id']] = {'file': it['id'] + '.mp3', 'engine': args.engine, 'prompt': it['prompt']}
    manifest['engine'] = args.engine
    json.dump(manifest, open(manifest_path, 'w'), indent=1)
    print(f'manifest: {len(manifest["sfx"])} effects. With --variants, rename your favourite take to <id>.mp3 and re-run with --variants 1.')


if __name__ == '__main__':
    main()
