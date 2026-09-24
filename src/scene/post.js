// Post-processing: bloom + a "body" shader that renders the player's physiology.
//   drunk  → wobble, double vision, warm haze
//   wired  → chromatic aberration, tunnel-vision pulse on each heartbeat, sharpness
//   flash  → white-out (the snort, the gong, the close)
//   red    → danger pulse at high heart rate
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const BodyShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uDrunk: { value: 0 },
    uWired: { value: 0 },
    uPulse: { value: 0 },
    uFlash: { value: 0 },
    uRed: { value: 0 },
    uGold: { value: 0 },
    uBlack: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uDrunk, uWired, uPulse, uFlash, uRed, uGold, uBlack;
    uniform vec2 uRes;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;

      // drunk wobble
      uv += uDrunk * 0.012 * vec2(sin(uv.y * 9.0 + uTime * 1.3), cos(uv.x * 7.0 + uTime * 1.1));
      // heartbeat zoom pulse
      uv = 0.5 + (uv - 0.5) * (1.0 - uPulse * 0.012 * uWired);

      // chromatic aberration grows with heart rate
      float ca = 0.0015 + uWired * 0.006 + uDrunk * 0.002;
      vec2 dir = c * ca;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir).b;

      // double vision
      vec2 off = vec2(sin(uTime * 0.7), cos(uTime * 0.5)) * 0.018 * uDrunk;
      vec3 ghost = texture2D(tDiffuse, uv + off).rgb;
      col = mix(col, ghost, 0.42 * clamp(uDrunk, 0.0, 1.0));

      // warm haze when drunk, cold contrast when wired
      col = mix(col, col * vec3(1.08, 0.98, 0.85) + 0.02, uDrunk * 0.6);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, 1.0 + uWired * 0.35);
      col = (col - 0.5) * (1.0 + uWired * 0.15) + 0.5;

      // vignette: tunnel vision when wired
      float v = smoothstep(0.85, 0.2 - uWired * 0.15, length(c) * (1.0 + uWired * 0.4 + uPulse * uWired * 0.25));
      col *= mix(1.0, v, 0.55 + uWired * 0.35);

      // danger: red pulse at the edges
      col = mix(col, vec3(0.6, 0.0, 0.02), uRed * uPulse * smoothstep(0.2, 0.7, length(c)) * 0.8);

      // gold glow for a close
      col += uGold * vec3(1.0, 0.75, 0.3) * smoothstep(0.7, 0.0, length(c)) * 0.35;

      // film grain
      float g = hash(vUv * uRes + fract(uTime * 13.7)) - 0.5;
      col += g * 0.045;

      col = mix(col, vec3(1.0), uFlash);
      col = mix(col, vec3(0.0), uBlack);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera, { low = false } = {}) {
  const size = renderer.getSize(new THREE.Vector2());
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: low ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.28, 0.5, 0.92);
  if (!low) composer.addPass(bloom);
  const body = new ShaderPass(BodyShader);
  body.uniforms.uRes.value.set(size.x, size.y);
  composer.addPass(body);
  composer.addPass(new OutputPass());
  return {
    composer,
    bloom,
    body: body.uniforms,
    setSize(w, h) {
      composer.setSize(w, h);
      body.uniforms.uRes.value.set(w, h);
    },
  };
}
