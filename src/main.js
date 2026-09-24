import * as THREE from 'three';
import { Office } from './scene/office.js';
import { createPost } from './scene/post.js';
import { updateTweens } from './scene/tween.js';
import { HUD } from './ui/hud.js';
import { Director } from './game/director.js';
import { audio } from './audio/engine.js';
import { voice } from './audio/voice.js';

const canvas = document.getElementById('gl');
const params = new URLSearchParams(location.search);
const LOW = params.has('low'); // ?low → no shadows/bloom/MSAA, for weak GPUs (and headless tests)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(LOW ? 0.75 : Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFShadowMap;

const office = new Office(renderer);
const post = createPost(renderer, office.scene, office.camera, { low: LOW });
const hud = new HUD();
const director = new Director(office, hud, post);
window.__game = director; // for the curious (and for tests)
window.__renderer = renderer;

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
  office.camera.aspect = innerWidth / innerHeight;
  office.camera.updateProjectionMatrix();
});

// ── pointer: head look + clicking desk objects ─────────────────────────────
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;
const label = document.createElement('div');
label.id = 'hoverlabel';
document.body.appendChild(label);
const LABELS = {
  phone: () => (hud.mode === 'call' ? '📵 Hang up (X)' : '📞 Pick up & dial (D)'),
  beer: () => '🍺 Crack a tallboy (Q)',
  snow: () => '❄️ Desk Snow™ (W)',
  coffee: () => '☕ Burnt coffee (E)',
  ball: () => '🔴 Stress ball (R)',
  leads: () => '📇 The Glengarry leads (L)',
  gong: () => '🥁 The gong (G)',
};
addEventListener('pointermove', (e) => {
  label.style.left = e.clientX + 16 + 'px';
  label.style.top = e.clientY + 12 + 'px';
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  office.look.tYaw = ndc.x * 0.32;
  office.look.tPitch = ndc.y * 0.2;
});
canvas.addEventListener('click', () => {
  if (!hovered) return;
  if (hovered === 'phone') hud.pick({ type: hud.mode === 'call' ? 'hangup' : 'dial' });
  else hud.pick({ type: 'item', id: hovered });
});
function pickHover() {
  ray.setFromCamera(ndc, office.camera);
  const hit = ray.intersectObjects(office.clickables, false)[0];
  const id = hit && hit.distance < 3.5 ? hit.object.userData.item : null;
  if (id !== hovered) {
    hovered = id;
    office.setHighlight(id);
    canvas.style.cursor = id ? 'pointer' : 'default';
    label.textContent = id ? LABELS[id]() : '';
    label.style.display = id && !document.getElementById('title') ? 'block' : 'none';
    if (id && hud.mode !== 'off') audio.play('hover');
  }
}

// ── loop ───────────────────────────────────────────────────────────────────
const timer = new THREE.Timer();
let t = 0;
function frame(now) {
  timer.update(now);
  const raw = Math.max(0, timer.getDelta());
  const dt = Math.min(0.05, raw);
  t += dt;
  updateTweens(Math.min(0.5, raw)); // choreography runs on wall-clock time, even on slow machines
  director.update(dt, t);
  pickHover();
  post.composer.render(dt);
  requestAnimationFrame(frame);
}
document.fonts.ready.then(() => director.refreshBoard());
director.refreshBoard();
requestAnimationFrame(frame);

// ── title screen ───────────────────────────────────────────────────────────
let mode = 'baked';
const packinfo = document.getElementById('packinfo');
voice.init().then((m) => {
  const n = Object.keys(m.lines || {}).length;
  packinfo.textContent = n ? `${m.engine} · ${n} lines` : 'not baked — see tools/voice';
  if (!n) setMode('browser');
});
function setMode(m) {
  mode = m;
  document.querySelectorAll('#voiceMode button').forEach((b) => b.classList.toggle('on', b.dataset.v === m));
}
document.querySelectorAll('#voiceMode button').forEach((b) => (b.onclick = () => setMode(b.dataset.v)));

async function start() {
  if (start.done) return;
  start.done = true;
  await audio.init();
  audio.play('ui');
  if (mode === 'browser') voice.manifest = { lines: {} };
  // Live Kokoro powers freestyle lines in every mode if it loads; in "live"
  // mode it voices everything.
  if (mode === 'live') {
    voice.manifest = { lines: {} };
    const st = document.getElementById('liveStatus');
    st.textContent = 'Downloading Kokoro-82M…';
    await voice.loadLive((p, f) => (st.textContent = `Downloading Kokoro-82M… ${Math.round(p * 100)}% (${f})`));
    if (voice.liveStatus !== 'ready') st.textContent = 'Live model failed to load — falling back to browser voices.';
  }
  const title = document.getElementById('title');
  title.classList.add('out');
  setTimeout(() => title.remove(), 1200);
  director.run();
}
document.getElementById('start').onclick = start;
addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('title')) start();
});
