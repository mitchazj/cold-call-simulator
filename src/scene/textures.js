// Procedural canvas textures. No image assets: everything is painted here.
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

function noise(ctx, w, h, amount, alpha = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
    d[i + 3] = d[i + 3] * alpha;
  }
  ctx.putImageData(img, 0, 0);
}

export function woodTexture() {
  const [c, ctx] = canvas(1024, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#5a321a');
  g.addColorStop(1, '#4a2812');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 260; i++) {
    const y = rand(0, 512);
    ctx.strokeStyle = `rgba(${rand(20, 60)},${rand(8, 25)},0,${rand(0.08, 0.35)})`;
    ctx.lineWidth = rand(0.5, 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.004 + i) * rand(2, 9) + Math.sin(x * 0.03) * 1.5);
    ctx.stroke();
  }
  // knots
  for (let k = 0; k < 4; k++) {
    const x = rand(100, 900), y = rand(50, 450);
    for (let r = 30; r > 2; r -= 3) {
      ctx.strokeStyle = `rgba(30,12,0,${0.15})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 2.6, r * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  noise(ctx, 1024, 512, 18);
  // coffee ring stains, obviously
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = 'rgba(40,20,5,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(rand(100, 900), rand(80, 430), rand(26, 34), 0, Math.PI * 2);
    ctx.stroke();
  }
  return tex(c);
}

export function roughnessFromNoise(size = 256, base = 160, amount = 60) {
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, size, size);
  noise(ctx, size, size, amount);
  return tex(c, { srgb: false, repeat: [1, 1] });
}

export function carpetTexture() {
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = '#2e3440';
  ctx.fillRect(0, 0, 512, 512);
  noise(ctx, 512, 512, 55);
  // 90s office carpet squiggles
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = ['rgba(120,40,70,.35)', 'rgba(40,110,120,.35)', 'rgba(150,130,60,.25)'][i % 3];
    ctx.lineWidth = 2;
    ctx.beginPath();
    let x = rand(0, 512), y = rand(0, 512);
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(x + rand(-20, 20), y + rand(-20, 20), (x += rand(-18, 18)), (y += rand(-18, 18)));
    ctx.stroke();
  }
  return tex(c, { repeat: [14, 14] });
}

export function ceilingTexture() {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#d8d6cf';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(90,85,75,${rand(0.1, 0.4)})`;
    ctx.fillRect(rand(0, 256), rand(0, 256), rand(1, 3), rand(1, 2));
  }
  ctx.strokeStyle = '#a9a7a0';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, 256, 256);
  // a water stain, naturally
  const g = ctx.createRadialGradient(170, 90, 5, 170, 90, 50);
  g.addColorStop(0, 'rgba(160,120,60,0.25)');
  g.addColorStop(0.8, 'rgba(160,120,60,0.18)');
  g.addColorStop(1, 'rgba(160,120,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return tex(c, { repeat: [16, 16] });
}

export function wallTexture() {
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = '#8e8676';
  ctx.fillRect(0, 0, 512, 512);
  noise(ctx, 512, 512, 14);
  // wood wainscot lower third
  const g = ctx.createLinearGradient(0, 360, 0, 512);
  g.addColorStop(0, '#3b2414');
  g.addColorStop(1, '#2a180c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 380, 512, 132);
  ctx.fillStyle = '#1f1208';
  ctx.fillRect(0, 372, 512, 10);
  return tex(c, { repeat: [6, 1] });
}

export function posterTexture(lines, { bg = '#111', fg = '#f5d76e', accent = '#c0392b', sub } = {}) {
  const [c, ctx] = canvas(512, 700);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 700);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 10;
  ctx.strokeRect(24, 24, 464, 652);
  ctx.fillStyle = accent;
  ctx.fillRect(24, 250, 464, 8);
  ctx.textAlign = 'center';
  ctx.fillStyle = fg;
  let y = 150;
  for (const [text, size] of lines) {
    ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    ctx.fillText(text, 256, y);
    y += size * 1.15;
  }
  if (sub) {
    ctx.font = 'italic 26px Georgia, serif';
    ctx.fillStyle = '#ddd';
    ctx.fillText(sub, 256, 640);
  }
  noise(ctx, 512, 700, 20);
  return tex(c);
}

export function eaglePoster() {
  const [c, ctx] = canvas(512, 700);
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, 0, 512, 700);
  const g = ctx.createLinearGradient(0, 40, 0, 500);
  g.addColorStop(0, '#f39c5a');
  g.addColorStop(0.6, '#c0392b');
  g.addColorStop(1, '#2c1a2e');
  ctx.fillStyle = g;
  ctx.fillRect(40, 40, 432, 460);
  // mountains
  ctx.fillStyle = '#1c1020';
  ctx.beginPath();
  ctx.moveTo(40, 500);
  for (let x = 40; x <= 472; x += 24) ctx.lineTo(x, 420 - Math.abs(Math.sin(x * 0.02)) * 90 - rand(0, 30));
  ctx.lineTo(472, 500);
  ctx.fill();
  // eagle silhouette
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(256, 220);
  ctx.quadraticCurveTo(170, 150, 80, 190);
  ctx.quadraticCurveTo(170, 185, 230, 250);
  ctx.lineTo(256, 290);
  ctx.lineTo(282, 250);
  ctx.quadraticCurveTo(342, 185, 432, 190);
  ctx.quadraticCurveTo(342, 150, 256, 220);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '700 58px Georgia, serif';
  ctx.fillText('AMBITION', 256, 575);
  ctx.font = 'italic 21px Georgia, serif';
  ctx.fillStyle = '#bbb';
  ctx.fillText('The eagle does not cold call.', 256, 618);
  ctx.fillText('The eagle is cold called upon.', 256, 646);
  return tex(c);
}

export function skylineTexture() {
  const W = 2048, H = 768;
  const [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d1026');
  g.addColorStop(0.45, '#3a2553');
  g.addColorStop(0.75, '#d4695a');
  g.addColorStop(1, '#f6b36b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // stars
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand(0.2, 0.8)})`;
    ctx.fillRect(rand(0, W), rand(0, H * 0.35), 1.5, 1.5);
  }
  // three layers of buildings
  const layers = [
    { col: '#241a33', min: 200, max: 420, win: 0.08 },
    { col: '#161225', min: 280, max: 560, win: 0.2 },
    { col: '#0b0a14', min: 330, max: 700, win: 0.35 },
  ];
  for (const L of layers) {
    let x = -20;
    while (x < W) {
      const w = rand(50, 150);
      const h = rand(L.min, L.max);
      const top = H - h;
      ctx.fillStyle = L.col;
      ctx.fillRect(x, top, w, h);
      if (Math.random() < 0.25) {
        ctx.fillRect(x + w * 0.4, top - rand(20, 80), w * 0.2, 80); // spire
        ctx.fillStyle = '#ff3b3b';
        ctx.fillRect(x + w * 0.5 - 2, top - 84, 4, 4);
      }
      for (let wy = top + 10; wy < H - 10; wy += 14) {
        for (let wx = x + 6; wx < x + w - 8; wx += 11) {
          if (Math.random() < L.win) {
            ctx.fillStyle = Math.random() < 0.8 ? `rgba(255,${rand(200, 235)},${rand(130, 180)},${rand(0.6, 1)})` : 'rgba(170,210,255,0.8)';
            ctx.fillRect(wx, wy, 6, 8);
          }
        }
      }
      x += w + rand(-10, 20);
    }
  }
  return tex(c);
}

export function beerLabelTexture() {
  const [c, ctx] = canvas(512, 256);
  const g = ctx.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, '#8a0f14');
  g.addColorStop(0.5, '#d4202a');
  g.addColorStop(1, '#8a0f14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#f7d774';
  ctx.fillRect(0, 36, 512, 8);
  ctx.fillRect(0, 212, 512, 8);
  ctx.textAlign = 'center';
  ctx.font = '900 64px Impact, sans-serif';
  ctx.fillStyle = '#fff4d6';
  ctx.fillText("BULL'S HEAD", 256, 130);
  ctx.font = '700 30px Georgia, serif';
  ctx.fillStyle = '#f7d774';
  ctx.fillText('— CLOSER LAGER —', 256, 180);
  ctx.font = '600 16px sans-serif';
  ctx.fillText('24 FL OZ · 8.2% ALC/VOL · NOT A BREAKFAST', 256, 238);
  return tex(c);
}

export function billTexture() {
  const [c, ctx] = canvas(512, 220);
  ctx.fillStyle = '#c9d6b8';
  ctx.fillRect(0, 0, 512, 220);
  ctx.strokeStyle = '#3d5a3a';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 200);
  ctx.fillStyle = '#3d5a3a';
  ctx.font = '900 70px Georgia, serif';
  ctx.fillText('100', 30, 90);
  ctx.fillText('100', 370, 190);
  ctx.beginPath();
  ctx.ellipse(256, 110, 60, 75, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#8fa482';
  ctx.fill();
  noise(ctx, 512, 220, 25);
  return tex(c);
}

export function mugTexture() {
  const [c, ctx] = canvas(512, 256);
  ctx.fillStyle = '#f3f0e8';
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#1b1b1b';
  ctx.textAlign = 'center';
  ctx.font = '900 38px "Arial Black", sans-serif';
  ctx.fillText("WORLD'S", 128, 100);
  ctx.fillText('OKAYEST', 128, 145);
  ctx.fillText('CLOSER', 128, 190);
  return tex(c);
}

export function nameplateTexture() {
  const [c, ctx] = canvas(512, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#d9b35b');
  g.addColorStop(0.5, '#fff0b8');
  g.addColorStop(1, '#a67c2d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#2a1d06';
  ctx.textAlign = 'center';
  ctx.font = '700 44px Georgia, serif';
  ctx.fillText('JORDAN', 256, 62);
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('Senior Account Executive (Probation)', 256, 102);
  return tex(c);
}

export function postitTexture(text, color = '#fff27a') {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(0, 0, 256, 40);
  ctx.fillStyle = '#1b2a8a';
  ctx.font = '600 30px "Comic Sans MS", "Marker Felt", cursive';
  const words = text.split(' ');
  let line = '', y = 80;
  for (const w of words) {
    if (ctx.measureText(line + w).width > 220) {
      ctx.fillText(line, 16, y);
      line = '';
      y += 36;
    }
    line += w + ' ';
  }
  ctx.fillText(line, 16, y);
  return tex(c);
}

export function clockFaceTexture() {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#f7f5ee';
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 26px Helvetica, Arial';
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(String(i), 128 + Math.cos(a) * 98, 128 + Math.sin(a) * 98);
  }
  ctx.font = '600 11px Helvetica';
  ctx.fillText('TIME IS MONEY', 128, 170);
  return tex(c);
}

export function keyboardTexture() {
  const [c, ctx] = canvas(512, 180);
  ctx.fillStyle = '#a9a292';
  ctx.fillRect(0, 0, 512, 180);
  for (let r = 0; r < 5; r++) {
    for (let k = 0; k < 15; k++) {
      ctx.fillStyle = r === 0 || k === 0 || k === 14 ? '#8f887a' : '#c9c2b1';
      if (r === 4 && k > 4 && k < 11) continue;
      ctx.fillRect(12 + k * 33, 12 + r * 33, 29, 29);
      ctx.strokeStyle = '#b3ab98';
      ctx.strokeRect(12 + k * 33, 12 + r * 33, 29, 29);
    }
  }
  ctx.fillStyle = '#c9c2b1';
  ctx.fillRect(12 + 5 * 33, 12 + 4 * 33, 6 * 33 - 4, 29);
  return tex(c);
}

export function paperTexture(title) {
  const [c, ctx] = canvas(256, 330);
  ctx.fillStyle = '#f5f2e8';
  ctx.fillRect(0, 0, 256, 330);
  ctx.fillStyle = '#222';
  ctx.font = '700 18px Courier New, monospace';
  ctx.fillText(title, 14, 30);
  ctx.font = '12px Courier New, monospace';
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = 'rgba(30,30,30,0.7)';
    ctx.fillRect(14, 50 + i * 15, rand(120, 228), 3);
  }
  ctx.strokeStyle = '#b22';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(170, 120, 60, 22, -0.1, 0, Math.PI * 2);
  ctx.stroke();
  return tex(c);
}
