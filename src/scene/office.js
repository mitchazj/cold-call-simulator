// ─────────────────────────────────────────────────────────────────────────────
//  The office. A dusk-lit sales floor, built entirely from code.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import * as T from './textures.js';
import { makePerson, makeChair } from './person.js';
import { CRMScreen } from './crm.js';
import { tween, ease, wait } from './tween.js';

const DESK_Y = 0.76;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, roughness = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

function shadows(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

export class Office {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0b12');
    this.scene.fog = new THREE.Fog('#1a1622', 14, 34);
    this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.03, 80);
    this.clickables = [];
    this.coworkers = [];
    this.t = 0;
    this.crm = new CRMScreen();
    this.look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 };
    this.focus = null; // { pos, target, k }
    this.shake = 0;
    this.body = { bac: 0, hr: 72 };
    this.basePos = v3(0, 1.3, 0.92);
    this.baseTarget = v3(0, 0.95, -0.45);
    this.fovKick = 0;

    RectAreaLightUniformsLib.init();
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;

    this.buildRoom();
    this.buildDesk();
    this.buildProps();
    this.buildFloor();
    this.buildLights();
  }

  // ── room shell ────────────────────────────────────────────────────────────
  buildRoom() {
    const s = this.scene;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), std('#ffffff', 0.95, { map: T.carpetTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -5;
    floor.receiveShadow = true;
    s.add(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), std('#ffffff', 0.95, { map: T.ceilingTexture() }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 3.2, -5);
    s.add(ceil);

    const wallTex = T.wallTexture();
    const wallMat = std('#ffffff', 0.85, { map: wallTex });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.2), wallMat);
    front.position.set(0, 1.6, -12);
    front.receiveShadow = true;
    const back = front.clone();
    back.position.set(0, 1.6, 4);
    back.rotation.y = Math.PI;
    const right = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.2), wallMat);
    right.rotation.y = -Math.PI / 2;
    right.position.set(8, 1.6, -4);
    s.add(front, back, right);

    // left wall: floor-to-ceiling windows onto the skyline at dusk
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(40, 15), new THREE.MeshBasicMaterial({ map: T.skylineTexture(), fog: false }));
    sky.rotation.y = Math.PI / 2;
    sky.position.set(-22, 4, -4);
    s.add(sky);
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 3.2),
      new THREE.MeshStandardMaterial({ color: '#8fa6c0', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.14, envMapIntensity: 1.5, depthWrite: false }),
    );
    glass.rotation.y = Math.PI / 2;
    glass.position.set(-8, 1.6, -4);
    s.add(glass);
    const frameMat = std('#1c1c20', 0.4, { metalness: 0.6 });
    for (let z = -12; z <= 4; z += 1.6) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.2, 0.08), frameMat);
      m.position.set(-8, 1.6, z);
      s.add(m);
    }
    for (const y of [0.05, 0.9, 3.15]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 16), frameMat);
      m.position.set(-8, y, -4);
      s.add(m);
    }

    // fluorescent troffers
    this.tubes = [];
    const tubeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e8f2ff', emissiveIntensity: 1.6 });
    const housing = std('#cfcfcf', 0.5);
    for (let x = -6; x <= 6; x += 3) {
      for (let z = -11; z <= 3; z += 2.5) {
        const g = new THREE.Group();
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 1.22), housing);
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.16), tubeMat.clone());
        panel.rotation.x = Math.PI / 2;
        panel.position.y = -0.021;
        g.add(h, panel);
        g.position.set(x, 3.18, z);
        s.add(g);
        this.tubes.push(panel);
      }
    }
    // one dying tube, flickering, as is tradition
    this.flicker = this.tubes[7];

    // posters
    const addPoster = (tex, x, y, z, ry, w = 1.1) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 1.37), std('#fff', 0.6, { map: tex }));
      m.position.set(x, y, z);
      m.rotation.y = ry;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, w * 1.37 + 0.08, 0.03), std('#111', 0.3, { metalness: 0.5 }));
      frame.position.copy(m.position);
      frame.rotation.y = ry;
      frame.translateZ(-0.02);
      s.add(frame, m);
    };
    addPoster(T.posterTexture([['ALWAYS', 110], ['BE', 110], ['CLOSING', 104]], { sub: '— management' }), 4.6, 1.8, -11.97, 0);
    addPoster(T.posterTexture([['COFFEE', 100], ['IS FOR', 90], ['CLOSERS', 96]], { bg: '#1a0d06', fg: '#ffe0a3', accent: '#7a3b12', sub: 'Put. That coffee. Down.' }), -4.6, 1.8, -11.97, 0);
    addPoster(T.eaglePoster(), 7.97, 1.8, -3, -Math.PI / 2);
    addPoster(T.posterTexture([['FIRST', 100], ['PRIZE:', 90], ['CADILLAC', 84]], { bg: '#0b1a2e', fg: '#9fd3ff', accent: '#d4a017', sub: 'Third prize: you\'re fired.' }), 7.97, 1.8, -7, -Math.PI / 2);

    // whiteboard leaderboard
    this.boardCanvas = T.canvas(1024, 512);
    this.boardTex = new THREE.CanvasTexture(this.boardCanvas[0]);
    this.boardTex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), std('#fff', 0.25, { map: this.boardTex }));
    board.position.set(0, 1.75, -11.96);
    const bframe = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.7, 0.04), std('#aaa', 0.3, { metalness: 0.8 }));
    bframe.position.set(0, 1.75, -11.99);
    s.add(bframe, board);

    // clock
    const clock = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.28, 48), std('#fff', 0.4, { map: T.clockFaceTexture() }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 48), std('#222', 0.3, { metalness: 0.7 }));
    this.hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.01), std('#111'));
    this.minHand = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.22, 0.01), std('#111'));
    this.hourHand.geometry.translate(0, 0.07, 0.01);
    this.minHand.geometry.translate(0, 0.1, 0.015);
    clock.add(face, rim, this.hourHand, this.minHand);
    clock.position.set(0, 2.85, -11.95);
    s.add(clock);

    // plants, because HR said so
    const addPlant = (x, z) => {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 16), std('#6b3a24', 0.8));
      pot.position.y = 0.2;
      g.add(pot);
      const leafMat = std('#2f6b2a', 0.7, { side: THREE.DoubleSide });
      for (let i = 0; i < 28; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), leafMat);
        leaf.scale.set(1, 0.25, 0.5);
        const a = Math.random() * Math.PI * 2;
        const h = 0.5 + Math.random() * 1.1;
        leaf.position.set(Math.cos(a) * (0.1 + (1.6 - h) * 0.25), h, Math.sin(a) * (0.1 + (1.6 - h) * 0.25));
        leaf.rotation.set(Math.random(), a, Math.random() * 0.8);
        g.add(leaf);
      }
      g.position.set(x, 0, z);
      s.add(shadows(g));
    };
    addPlant(-7.3, -11.2);
    addPlant(7.3, -11.2);
    addPlant(-7.3, 2.5);

    // water cooler
    const cooler = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.34), std('#e8e8e8', 0.4));
    base.position.y = 0.5;
    const jug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.45, 20),
      new THREE.MeshStandardMaterial({ color: '#9fd0ff', roughness: 0.05, transparent: true, opacity: 0.55 }),
    );
    jug.position.y = 1.23;
    cooler.add(base, jug);
    cooler.position.set(7.3, 0, -9.5);
    s.add(shadows(cooler));
  }

  drawBoard(entries) {
    const [c, ctx] = this.boardCanvas;
    ctx.fillStyle = '#f4f6f4';
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = 'rgba(180,190,200,0.25)';
    ctx.fillRect(40, 60, 400, 30);
    ctx.font = '700 52px "Permanent Marker", "Marker Felt", "Comic Sans MS", cursive';
    ctx.fillStyle = '#c0392b';
    ctx.fillText('THE BOARD', 40, 70);
    ctx.fillStyle = '#1f3fbf';
    ctx.font = '600 28px "Permanent Marker", "Marker Felt", "Comic Sans MS", cursive';
    ctx.fillText('A.B.C. — Always Be Closing', 560, 64);
    const sorted = [...entries].sort((a, b) => b.value - a.value);
    sorted.forEach((e, i) => {
      const y = 140 + i * 58;
      ctx.fillStyle = e.you ? '#0a8a3a' : '#111';
      ctx.font = `600 ${e.you ? 44 : 40}px "Permanent Marker", "Marker Felt", "Comic Sans MS", cursive`;
      ctx.fillText(`${i + 1}. ${e.name}`, 60, y);
      ctx.fillText('$' + e.value.toLocaleString(), 560, y);
      if (i === 0) {
        ctx.fillStyle = '#d4a017';
        ctx.fillText('★ CADILLAC', 800, y);
      }
      if (i === sorted.length - 1) {
        ctx.fillStyle = '#c0392b';
        ctx.fillText('← FIRED?', 820, y);
      }
    });
    this.boardTex.needsUpdate = true;
  }

  // ── your desk ─────────────────────────────────────────────────────────────
  buildDesk() {
    const s = this.scene;
    const desk = new THREE.Group();
    const wood = std('#ffffff', 0.45, { map: T.woodTexture(), roughnessMap: T.roughnessFromNoise() });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 1.0), wood);
    top.position.set(0, DESK_Y - 0.025, -0.1);
    const side = std('#3b2211', 0.6);
    for (const x of [-0.95, 0.95]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, DESK_Y - 0.05, 0.9), side);
      leg.position.set(x, (DESK_Y - 0.05) / 2, -0.1);
      desk.add(leg);
    }
    const modesty = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.5, 0.03), side);
    modesty.position.set(0, 0.45, -0.55);
    desk.add(top, modesty);
    s.add(shadows(desk));

    // cubicle partitions
    const fabric = std('#4b5566', 0.95);
    const trim = std('#8a8f96', 0.4, { metalness: 0.5 });
    for (const [x, z, w, ry, ph] of [[-1.05, -0.2, 1.6, Math.PI / 2, 1.15], [1.05, -0.2, 1.6, Math.PI / 2, 1.15], [0, -0.65, 2.1, 0, 1.08]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, ph, 0.05), fabric);
      p.position.set(x, ph / 2, z);
      p.rotation.y = ry;
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 0.07), trim);
      t.position.set(x, ph + 0.01, z);
      t.rotation.y = ry;
      s.add(shadows(p), t);
    }
    // pinned stuff on the partition
    const pin = (tex, x, y, z, ry, w = 0.18, h = 0.18, rz = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std('#fff', 0.8, { map: tex }));
      m.position.set(x, y, z);
      m.rotation.set(0, ry, rz);
      s.add(m);
      return m;
    };
    pin(T.postitTexture("DON'T say synergy to the Irish lady"), -1.02, 1.05, -0.35, Math.PI / 2, 0.16, 0.16, 0.05);
    pin(T.postitTexture('Rich people LOVE flattery', '#ffb3d1'), -1.02, 1.05, -0.05, Math.PI / 2, 0.16, 0.16, -0.08);
    pin(T.postitTexture('Discovery FIRST, then attack', '#b3f0ff'), 1.02, 1.05, -0.3, -Math.PI / 2, 0.16, 0.16, 0.06);
    pin(T.postitTexture('Objections have COUNTERS', '#c9ffb3'), 1.02, 0.85, -0.1, -Math.PI / 2, 0.16, 0.16, -0.04);
    pin(T.paperTexture('Q3 SCRIPT (v14)'), 0.55, 1.0, -0.62, 0, 0.21, 0.27, 0.03);
    pin(T.paperTexture('COMMISSION PLAN'), -0.5, 1.0, -0.62, 0, 0.21, 0.27, -0.04);

    // chair (you are sitting in it)
    const chair = makeChair();
    chair.position.set(0, 0, 0.95);
    chair.rotation.y = Math.PI;
    s.add(chair);
  }

  // ── desk props (the good stuff) ───────────────────────────────────────────
  buildProps() {
    const s = this.scene;
    const y = DESK_Y;

    // CRT monitor
    const beige = std('#d8cfb8', 0.55);
    const mon = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.44), beige);
    box.position.set(0, 0.29, -0.06);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.04), beige);
    bezel.position.set(0, 0.29, 0.17);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ map: this.crm.texture, toneMapped: false }));
    screen.position.set(0, 0.3, 0.192);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 24), beige);
    stand.position.y = 0.05;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.1), beige);
    neck.position.y = 0.1;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.006), new THREE.MeshBasicMaterial({ color: '#39ff6a' }));
    led.position.set(0.2, 0.1, 0.192);
    mon.add(box, bezel, screen, stand, neck, led);
    mon.position.set(0, y, -0.3);
    s.add(shadows(mon));
    this.screenLight = new THREE.PointLight('#62ff8f', 0.12, 1.4, 2);
    this.screenLight.position.set(0, y + 0.3, -0.02);
    s.add(this.screenLight);
    this.monitor = mon;

    // keyboard + mouse
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.16), [beige, beige, std('#fff', 0.6, { map: T.keyboardTexture() }), beige, beige, beige]);
    kb.position.set(0, y + 0.013, 0.08);
    kb.rotation.x = 0.04;
    const mouse = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.04, 4, 12), beige);
    mouse.rotation.x = Math.PI / 2;
    mouse.scale.set(1, 1, 0.55);
    mouse.position.set(0.32, y + 0.016, 0.1);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.19), std('#15306b', 0.9));
    pad.position.set(0.32, y + 0.002, 0.1);
    s.add(shadows(kb), shadows(mouse), pad);

    this.buildPhone();
    this.buildBeer();
    this.buildMirror();

    // coffee mug
    const mug = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 32, 1, true), std('#fff', 0.25, { map: T.mugTexture(), side: THREE.DoubleSide }));
    cup.position.y = 0.05;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.038, 32), std('#f3f0e8', 0.3));
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.003;
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.04, 32), std('#2a160a', 0.1));
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 0.085;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 8, 16, Math.PI), std('#f3f0e8', 0.25));
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(0.042, 0.05, 0);
    mug.add(cup, bottom, coffee, handle);
    mug.position.set(-0.33, y, 0.12);
    mug.rotation.y = 2.4;
    s.add(shadows(mug));
    this.mug = mug;
    this.mugHome = { pos: mug.position.clone(), rot: mug.rotation.clone() };
    this.register(mug, 'coffee');

    // stress ball
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 32, 24), std('#d62828', 0.55));
    ball.position.set(0.62, y + 0.035, 0.18);
    s.add(shadows(ball));
    this.ball = ball;
    this.register(ball, 'ball');

    // Glengarry leads
    const leads = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.003, 0.28), std(i === 11 ? '#fff' : '#f2efe4', 0.9));
      sheet.position.set(Math.random() * 0.01, i * 0.0035, Math.random() * 0.01);
      sheet.rotation.y = (Math.random() - 0.5) * 0.06;
      leads.add(sheet);
    }
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), std('#fff', 0.8, { map: T.posterTexture([['THE', 70], ['GLENGARRY', 58], ['LEADS', 74]], { bg: '#f2efe4', fg: '#8c1c13', accent: '#8c1c13', sub: 'DO NOT TOUCH — B.' }) }));
    cover.rotation.x = -Math.PI / 2;
    cover.position.y = 12 * 0.0035 + 0.002;
    leads.add(cover);
    leads.position.set(-0.72, y, 0.12);
    leads.rotation.y = 0.25;
    s.add(shadows(leads));
    this.leads = leads;
    this.register(leads, 'leads');

    // banker's lamp
    const lamp = new THREE.Group();
    const brass = std('#b8913a', 0.3, { metalness: 0.9 });
    const lbase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 24), brass);
    const lpole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3), brass);
    lpole.position.y = 0.16;
    // banker's lamp: a green glass trough, lying sideways
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.3, 32, 1, true, 0, Math.PI),
      new THREE.MeshPhysicalMaterial({ color: '#0d5e2a', roughness: 0.12, clearcoat: 1, side: THREE.DoubleSide, emissive: '#0a3', emissiveIntensity: 0.25 }),
    );
    shade.rotation.set(0, 0, Math.PI / 2);
    shade.position.set(0, 0.33, 0.05);
    const bulb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.12, 4, 8), new THREE.MeshBasicMaterial({ color: '#fff3c4' }));
    bulb.rotation.z = Math.PI / 2;
    bulb.position.set(0, 0.315, 0.05);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06), brass);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(0, 0.31, 0.025);
    lamp.add(arm);
    lamp.add(lbase, lpole, shade, bulb);
    lamp.position.set(-0.78, y, -0.32);
    lamp.rotation.y = 0.5;
    s.add(shadows(lamp));
    const lampLight = new THREE.SpotLight('#ffcf8a', 0.9, 1.8, 0.95, 0.7, 2);
    lampLight.position.set(-0.76, y + 0.3, -0.26);
    lampLight.target.position.set(-0.3, y, 0.05);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(1024, 1024);
    lampLight.shadow.bias = -0.0005;
    lampLight.shadow.radius = 4;
    s.add(lampLight, lampLight.target);

    // nameplate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.02), [brass, brass, brass, brass, std('#fff', 0.45, { map: T.nameplateTexture(), metalness: 0.15 }), brass]);
    plate.position.set(0.46, y + 0.035, -0.4);
    plate.rotation.set(-0.3, -0.2, 0);
    s.add(shadows(plate));

    // pen cup
    const pens = new THREE.Group();
    const pc = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 20, 1, true), std('#222', 0.4, { metalness: 0.4, side: THREE.DoubleSide }));
    pc.position.y = 0.05;
    pens.add(pc);
    for (let i = 0; i < 5; i++) {
      const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.15), std(['#1a3fb0', '#111', '#c0392b', '#d4a017', '#111'][i], 0.4));
      pen.position.set((Math.random() - 0.5) * 0.03, 0.1, (Math.random() - 0.5) * 0.03);
      pen.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
      pens.add(pen);
    }
    pens.position.set(-0.3, y, -0.32);
    s.add(shadows(pens));

    // THE GONG
    const gong = new THREE.Group();
    const wood = std('#3a1d0c', 0.5);
    for (const x of [-0.45, 0.45]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 0.06), wood);
      post.position.set(x, 0.85, 0);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.5), wood);
      foot.position.set(x, 0.025, 0);
      gong.add(post, foot);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.07), wood);
    bar.position.y = 1.7;
    gong.add(bar);
    const disc = new THREE.Group();
    disc.position.y = 1.62;
    const plateG = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.015, 64), std('#c9962e', 0.28, { metalness: 1, emissive: '#ffae00', emissiveIntensity: 0 }));
    plateG.rotation.x = Math.PI / 2;
    plateG.position.y = -0.42;
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std('#d8a93a', 0.25, { metalness: 1 }));
    boss.rotation.x = Math.PI / 2;
    boss.position.set(0, -0.42, 0.008);
    disc.add(plateG, boss);
    gong.add(disc);
    gong.position.set(-1.75, 0, -0.7);
    gong.rotation.y = 0.9;
    s.add(shadows(gong));
    this.gong = { group: gong, disc, plate: plateG, swing: 0 };
    this.register(gong, 'gong');
  }

  buildPhone() {
    const s = this.scene;
    const y = DESK_Y;
    const dark = std('#1b1b1d', 0.35);
    const phone = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.22), dark);
    base.position.y = 0.03;
    const slope = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.02, 0.14), dark);
    slope.position.set(0, 0.065, 0.03);
    slope.rotation.x = 0.25;
    phone.add(base, slope);
    // keypad
    const keyMat = std('#e8e2d0', 0.4);
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 3; k++) {
        const key = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.008, 0.022), keyMat);
        key.position.set(-0.035 + k * 0.035, 0.078 - r * 0.007, -0.01 + r * 0.028);
        key.rotation.x = 0.25;
        phone.add(key);
      }
    // red line light
    this.phoneLight = new THREE.Mesh(new THREE.SphereGeometry(0.007), new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff2200', emissiveIntensity: 0 }));
    this.phoneLight.position.set(0.075, 0.07, 0.07);
    phone.add(this.phoneLight);
    phone.position.set(-0.55, y, -0.08);
    phone.rotation.y = 0.35;
    s.add(shadows(phone));
    this.phone = phone;
    this.register(phone, 'phone');

    // handset
    const hs = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.16, 6, 12), dark);
    grip.rotation.x = Math.PI / 2;
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.035, 20), dark);
    ear.position.set(0, -0.012, -0.1);
    const mouth = ear.clone();
    mouth.position.z = 0.1;
    hs.add(grip, ear, mouth);
    s.add(shadows(hs));
    this.handset = hs;
    this.register(hs, 'phone');
    // cradle pose (world)
    phone.updateMatrixWorld();
    this.handsetCradle = new THREE.Object3D();
    this.handsetCradle.position.set(0, 0.105, -0.02);
    phone.add(this.handsetCradle);
    // held pose, relative to the camera: at your left ear
    this.handsetHeld = new THREE.Object3D();
    this.handsetHeld.position.set(-0.11, -0.07, -0.04);
    this.handsetHeld.rotation.set(0.1, 1.35, -0.2);
    this.camera.add(this.handsetHeld);
    this.scene.add(this.camera);
    this.lift = 0; // 0 = on cradle, 1 = at ear
    this.ringShake = 0;

    // coiled cord
    this.cordMat = std('#141416', 0.4);
    this.cord = new THREE.Mesh(new THREE.BufferGeometry(), this.cordMat);
    this.cord.castShadow = true;
    s.add(this.cord);
    this.cordAnchor = new THREE.Object3D();
    this.cordAnchor.position.set(-0.1, 0.03, 0.02);
    phone.add(this.cordAnchor);
    this._lastCordKey = '';
  }

  updateHandset() {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    this.handsetCradle.getWorldPosition(a);
    this.handsetCradle.getWorldQuaternion(qa);
    this.handsetHeld.getWorldPosition(b);
    this.handsetHeld.getWorldQuaternion(qb);
    const k = this.lift;
    const arc = Math.sin(k * Math.PI) * 0.08;
    this.handset.position.lerpVectors(a, b, k);
    this.handset.position.y += arc;
    this.handset.quaternion.slerpQuaternions(qa, qb, k);
    if (k === 0 && this.ringShake > 0) {
      this.handset.position.y += Math.abs(Math.sin(this.t * 60)) * 0.006 * this.ringShake;
      this.handset.rotation.z += Math.sin(this.t * 55) * 0.05 * this.ringShake;
    }
    // Cord: a coiled helix swept along a sagging curve from base to handset end.
    const end = new THREE.Vector3(0, 0, 0.11).applyQuaternion(this.handset.quaternion).add(this.handset.position);
    const start = new THREE.Vector3();
    this.cordAnchor.getWorldPosition(start);
    const key = `${end.x.toFixed(3)},${end.y.toFixed(3)},${end.z.toFixed(3)}`;
    if (key === this._lastCordKey) return;
    this._lastCordKey = key;
    const dist = start.distanceTo(end);
    const sag = Math.max(0.02, 0.35 - dist * 0.4);
    const mid = start.clone().lerp(end, 0.5);
    mid.y = Math.max(DESK_Y + 0.01, Math.min(start.y, end.y) - sag);
    const spine = new THREE.QuadraticBezierCurve3(start, mid, end);
    const pts = [];
    const N = 420;
    const coils = 34 + dist * 30;
    const frames = spine.computeFrenetFrames(N, false);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = spine.getPointAt(u);
      const ang = u * coils * Math.PI * 2;
      const r = 0.012 * Math.min(1, u * 12, (1 - u) * 12);
      p.addScaledVector(frames.normals[i], Math.cos(ang) * r).addScaledVector(frames.binormals[i], Math.sin(ang) * r);
      pts.push(p);
    }
    this.cord.geometry.dispose();
    this.cord.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N * 2, 0.0032, 5, false);
  }

  buildBeer() {
    const s = this.scene;
    const y = DESK_Y;
    const label = T.beerLabelTexture();
    const alu = std('#d9d9d9', 0.25, { metalness: 1 });
    // Lathe profile for a 24oz tallboy
    const prof = [
      [0, 0], [0.028, 0], [0.032, 0.006], [0.033, 0.015], [0.033, 0.175], [0.03, 0.188], [0.026, 0.196], [0.026, 0.2], [0, 0.2],
    ].map(([x, yy]) => new THREE.Vector2(x, yy));
    const canGeo = new THREE.LatheGeometry(prof, 40);
    const labelGeo = new THREE.CylinderGeometry(0.0332, 0.0332, 0.15, 40, 1, true);
    const labelMat = new THREE.MeshPhysicalMaterial({ map: label, roughness: 0.3, metalness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    const makeCan = () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(canGeo, alu));
      const l = new THREE.Mesh(labelGeo, labelMat);
      l.position.y = 0.095;
      g.add(l);
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.002, 0.03), alu);
      tab.position.set(0, 0.201, 0.005);
      g.add(tab);
      // condensation: a clearcoat shell
      return shadows(g);
    };
    this.makeCan = makeCan;
    const pack = new THREE.Group();
    const cardboard = std('#6b4a2a', 0.9);
    const carrier = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.11, 0.16), cardboard);
    carrier.position.y = 0.055;
    carrier.material = [cardboard, cardboard, cardboard, cardboard, std('#fff', 0.8, { map: label }), std('#fff', 0.8, { map: label })];
    pack.add(carrier);
    this.cans = [];
    for (let i = 0; i < 6; i++) {
      const c = makeCan();
      c.position.set(-0.075 + (i % 3) * 0.075, 0.002, -0.04 + Math.floor(i / 3) * 0.08);
      c.rotation.y = Math.random() * 6;
      pack.add(c);
      this.cans.push(c);
    }
    pack.position.set(0.72, y, -0.2);
    pack.rotation.y = -0.4;
    s.add(shadows(pack));
    this.beerPack = pack;
    this.register(pack, 'beer');
    this.empties = [];
  }

  buildMirror() {
    const s = this.scene;
    const y = DESK_Y;
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.24), std('#b8913a', 0.3, { metalness: 0.9 }));
    frame.position.y = 0.006;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.22), new THREE.MeshPhysicalMaterial({ color: '#dfe7ee', metalness: 1, roughness: 0.02, envMapIntensity: 2.2 }));
    glass.position.y = 0.013;
    g.add(frame, glass);
    // the lines, arranged with the care of a professional
    const powder = new THREE.MeshStandardMaterial({ color: '#f8f8f8', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.08 });
    this.lines = [];
    for (let i = 0; i < 3; i++) {
      const line = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.12, 3, 6), powder);
      line.rotation.z = Math.PI / 2;
      line.scale.set(1, 1, 0.45);
      line.position.set(0, 0.017, -0.06 + i * 0.05);
      g.add(line);
      this.lines.push(line);
    }
    // rolled-up hundred
    const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 16, 1, true), std('#fff', 0.7, { map: T.billTexture(), side: THREE.DoubleSide }));
    bill.rotation.set(0, 0.6, Math.PI / 2);
    bill.position.set(0.02, 0.022, 0.085);
    g.add(bill);
    this.bill = bill;
    // razor blade (a credit card, AmEx Black obviously)
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.001, 0.054), std('#0a0a0a', 0.2, { metalness: 0.7 }));
    card.position.set(-0.05, 0.016, 0.07);
    card.rotation.y = 0.3;
    g.add(card);
    g.position.set(0.5, y, 0.14);
    g.rotation.y = -0.25;
    s.add(shadows(g, false, true));
    this.mirror = g;
    this.register(g, 'snow');
  }

  // ── coworkers & the boss ──────────────────────────────────────────────────
  buildFloor() {
    const s = this.scene;
    const deskMat = std('#5b3a22', 0.5);
    const mon = std('#d8cfb8', 0.55);
    const glow = new THREE.MeshBasicMaterial({ color: '#2a7d45' });
    const names = ['BRAD', 'DEB', 'MARCUS', 'PRIYA', 'GUS', 'LAUREN', 'TONY', 'KEIKO', 'RAY', 'STACY'];
    let n = 0;
    for (const z of [-2.8, -5.3, -7.8]) {
      for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) {
        if (Math.random() < 0.15 && n > 2) continue;
        const g = new THREE.Group();
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.9), deskMat);
        top.position.y = DESK_Y;
        g.add(top);
        for (const lx of [-0.85, 0.85]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, DESK_Y, 0.8), deskMat);
          leg.position.set(lx, DESK_Y / 2, 0);
          g.add(leg);
        }
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.38, 0.4), mon);
        m.position.set(0, DESK_Y + 0.25, -0.2);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.27), glow);
        scr.position.set(0, DESK_Y + 0.26, 0.001);
        scr.rotation.y = Math.PI;
        scr.position.z = -0.401;
        g.add(m);
        // partitions between rows
        const part = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.15, 0.04), std('#4b5566', 0.95));
        part.position.set(0, 0.575, -0.5);
        g.add(part);
        const chair = makeChair();
        chair.position.set(0, 0, 0.6);
        chair.rotation.y = Math.PI;
        g.add(chair);
        const name = names[n % names.length];
        const person = makePerson({ onPhone: Math.random() < 0.6, female: ['DEB', 'PRIYA', 'LAUREN', 'KEIKO', 'STACY'].includes(name) });
        person.root.position.set(0, 0, 0.45);
        g.add(person.root);
        person.name = name;
        this.coworkers.push(person);
        g.position.set(x, 0, z);
        s.add(shadows(g));
        n++;
      }
    }
    this.brad = this.coworkers.find((c) => c.name === 'BRAD');
    this.bradBoard = 0;

    // Chad: the boss prowls the floor
    const chad = makePerson({ boss: true, standing: true, shirt: '#ffffff', tie: '#b3122a', hair: '#2a1a0a', skin: '#e9b48f' });
    chad.root.scale.setScalar(1.08);
    chad.mode = 'idle';
    chad.root.position.set(1.2, 0, -10.5);
    s.add(chad.root);
    this.chad = chad;
    this.chadPath = null;
  }

  async chadWalk(to, faceCamera = true) {
    const c = this.chad;
    const from = c.root.position.clone();
    const target = v3(...to);
    const dist = from.distanceTo(target);
    c.mode = 'walk';
    c.root.lookAt(target.x, 0, target.z);
    c.root.rotateY(Math.PI);
    await tween(dist / 1.6, (k) => c.root.position.lerpVectors(from, target, k), ease.linear);
    if (faceCamera) {
      c.root.lookAt(this.camera.position.x, 0, this.camera.position.z);
      c.root.rotateY(Math.PI);
    }
    c.mode = 'talk';
  }

  // ── lights ────────────────────────────────────────────────────────────────
  buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#b8c8ff', '#3a2a1a', 0.22));
    // window dusk light
    const sun = new THREE.DirectionalLight('#ff9a66', 0.9);
    sun.position.set(-12, 5, -3);
    sun.target.position.set(0, 0, -3);
    sun.castShadow = false; // the floor is big; desk-level lights do the shadow work
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 8, bottom: -8, near: 1, far: 30 });
    sun.shadow.bias = -0.0004;
    s.add(sun, sun.target);
    // fluorescent area lights over the floor
    for (const [x, z] of [[0, -0.5], [0, -5], [-4, -7], [4, -3]]) {
      const ra = new THREE.RectAreaLight('#eaf2ff', 1.1, 1.2, 2.4);
      ra.position.set(x, 3.1, z);
      ra.lookAt(x, 0, z);
      s.add(ra);
    }
    // key light on your desk from above (with crisp shadows)
    const key = new THREE.SpotLight('#f4f7ff', 1.2, 6, 0.55, 0.9, 1.5);
    key.position.set(0.3, 3.1, 0.2);
    key.target.position.set(0, DESK_Y, -0.1);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0003;
    key.shadow.radius = 3;
    s.add(key, key.target);
    this.keyLight = key;
  }

  // ── interaction ───────────────────────────────────────────────────────────
  register(obj, id) {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.userData.item = id;
        this.clickables.push(o);
      }
    });
  }

  setHighlight(id) {
    if (this._hl === id) return;
    this._hl = id;
    for (const o of this.clickables) {
      const m = o.material;
      if (!m || Array.isArray(m) || !('emissive' in m)) continue;
      if (o.userData.baseEmissive === undefined) {
        o.userData.baseEmissive = m.emissive.clone();
        o.userData.baseEI = m.emissiveIntensity;
      }
      if (o.userData.item === id) {
        m.emissive.set('#ffb347');
        m.emissiveIntensity = 0.35;
      } else {
        m.emissive.copy(o.userData.baseEmissive);
        m.emissiveIntensity = o.userData.baseEI;
      }
    }
  }

  // ── animations for the Director ───────────────────────────────────────────
  async liftHandset(up = true) {
    const from = this.lift;
    await tween(up ? 0.7 : 0.45, (k) => (this.lift = from + ((up ? 1 : 0) - from) * k), up ? ease.inOut : ease.in);
  }

  async ring(secs = 1.8) {
    this.ringShake = 1;
    this.phoneLight.material.emissiveIntensity = 3;
    await wait(secs);
    this.ringShake = 0;
    this.phoneLight.material.emissiveIntensity = 0;
  }

  setLineLight(on) {
    this.phoneLight.material.emissiveIntensity = on ? 2.5 : 0;
  }

  async lookAt(target, pos, secs = 0.6) {
    const startT = this.currentTarget.clone();
    const startP = this.currentPos.clone();
    const endT = target ? v3(...target) : this.baseTarget.clone();
    const endP = pos ? v3(...pos) : this.basePos.clone();
    this.focus = { t: startT.clone(), p: startP.clone() };
    await tween(secs, (k) => {
      this.focus.t.lerpVectors(startT, endT, k);
      this.focus.p.lerpVectors(startP, endP, k);
    });
    if (!target && !pos) this.focus = null;
  }

  async drinkBeer(index) {
    const src = this.cans[index];
    if (!src) return;
    const wp = new THREE.Vector3();
    src.getWorldPosition(wp);
    src.visible = false;
    const can = this.makeCan();
    this.scene.add(can);
    can.position.copy(wp);
    const mouth = () => new THREE.Vector3(0.0, -0.13, -0.16).applyMatrix4(this.camera.matrixWorld);
    const from = wp.clone();
    await tween(0.6, (k) => {
      can.position.lerpVectors(from, mouth(), k);
      can.rotation.x = -k * 0.4;
    });
    const hold = 2.2;
    await tween(hold, (k) => {
      can.position.copy(mouth());
      can.quaternion.copy(this.camera.quaternion);
      can.rotateX(-0.9 - Math.sin(k * Math.PI) * 0.9);
      this.drinkTilt = Math.sin(k * Math.PI) * 0.18;
    });
    this.drinkTilt = 0;
    // Crush it and toss it on the pile
    const spot = v3(-0.15 - this.empties.length * 0.06 + Math.random() * 0.02, DESK_Y, -0.48 + Math.random() * 0.04);
    if (this.empties.length > 5) spot.set(-0.2 + Math.random() * 0.5, DESK_Y, -0.38 + Math.random() * 0.1);
    const p0 = can.position.clone();
    await tween(0.5, (k) => {
      can.position.lerpVectors(p0, spot, k);
      can.position.y += Math.sin(k * Math.PI) * 0.1;
      can.rotation.set(0, k * 3, (Math.random() - 0.5) * 0.3 * k);
      can.scale.set(1 + k * 0.15, 1 - k * 0.45, 1 + k * 0.15);
    }, ease.out);
    if (Math.random() < 0.4) can.rotation.x = Math.PI / 2; // on its side
    can.position.y = DESK_Y + (can.rotation.x ? 0.03 : 0);
    this.empties.push(can);
  }

  async doLine(index) {
    const line = this.lines[index];
    if (!line) return;
    const mp = new THREE.Vector3();
    line.getWorldPosition(mp);
    await this.lookAt([mp.x, mp.y, mp.z], [mp.x - 0.05, mp.y + 0.22, mp.z + 0.14], 0.7);
    await tween(0.9, (k) => {
      line.scale.y = 1 - k;
      line.position.x = -0.06 * k;
      this.shake = 0.004;
    }, ease.linear);
    line.visible = false;
    this.shake = 0;
    await this.lookAt(null, null, 0.18);
    this.fovKick = 14;
  }

  async sipCoffee() {
    const from = this.mug.position.clone();
    const mouth = () => new THREE.Vector3(0.02, -0.12, -0.17).applyMatrix4(this.camera.matrixWorld);
    await tween(0.5, (k) => this.mug.position.lerpVectors(from, mouth(), k));
    await tween(1.6, (k) => {
      this.mug.position.copy(mouth());
      this.mug.quaternion.copy(this.camera.quaternion);
      this.mug.rotateX(-0.6 - Math.sin(k * Math.PI) * 0.6);
      this.mug.rotateY(1.5);
    });
    const p0 = this.mug.position.clone();
    await tween(0.5, (k) => this.mug.position.lerpVectors(p0, this.mugHome.pos, k));
    this.mug.rotation.copy(this.mugHome.rot);
  }

  async squeeze() {
    for (let i = 0; i < 3; i++) {
      await tween(0.18, (k) => this.ball.scale.set(1 + k * 0.35, 1 - k * 0.5, 1 + k * 0.35));
      await tween(0.22, (k) => this.ball.scale.set(1.35 - k * 0.35, 0.5 + k * 0.5, 1.35 - k * 0.35), ease.back);
    }
  }

  async slapLeads() {
    const y0 = this.leads.position.y;
    await tween(0.2, (k) => (this.leads.position.y = y0 + k * 0.12), ease.out);
    await tween(0.12, (k) => (this.leads.position.y = y0 + 0.12 * (1 - k)), ease.in);
    this.shake = 0.01;
    await wait(0.15);
    this.shake = 0;
  }

  async ringGong() {
    const gp = new THREE.Vector3();
    this.gong.plate.getWorldPosition(gp);
    await this.lookAt([gp.x, gp.y, gp.z], [-0.35, 1.25, 0.45], 0.5);
    this.gong.swing = 1;
    this.gong.plate.material.emissiveIntensity = 1.5;
    this.shake = 0.02;
    await wait(0.3);
    this.shake = 0.006;
    await wait(1.2);
    this.shake = 0;
    await this.lookAt(null, null, 0.6);
  }

  cheer(bradToo = true) {
    for (const c of this.coworkers) if (c !== this.brad || bradToo) if (Math.random() < 0.75) c.cheer();
  }

  refillDesk() {
    for (const c of this.cans) c.visible = true;
    for (const l of this.lines) {
      l.visible = true;
      l.scale.y = 1;
      l.position.x = 0;
    }
    for (const e of this.empties) this.scene.remove(e);
    this.empties = [];
  }

  // ── per-frame ─────────────────────────────────────────────────────────────
  get currentTarget() {
    return this._curT || this.baseTarget.clone();
  }
  get currentPos() {
    return this._curP || this.basePos.clone();
  }

  update(dt, { bac = 0, hr = 72, pulse = 0 } = {}) {
    this.t += dt;
    const t = this.t;
    const cam = this.camera;

    // head look: mouse parallax
    const L = this.look;
    L.yaw += (L.tYaw - L.yaw) * Math.min(1, dt * 4);
    L.pitch += (L.tPitch - L.pitch) * Math.min(1, dt * 4);

    const baseT = this.focus ? this.focus.t : this.baseTarget;
    const baseP = this.focus ? this.focus.p : this.basePos;
    this._curT = baseT.clone();
    this._curP = baseP.clone();
    const pos = baseP.clone();
    const tgt = baseT.clone();
    if (!this.focus) {
      tgt.x += L.yaw * 2.2;
      tgt.y += L.pitch * 1.4;
    }
    // breathing
    pos.y += Math.sin(t * 1.4) * 0.004;
    // drunk sway
    const drunk = Math.min(1, bac / 0.16);
    pos.x += Math.sin(t * 0.63) * 0.03 * drunk;
    pos.y += Math.sin(t * 0.91) * 0.015 * drunk;
    tgt.x += Math.sin(t * 0.47) * 0.12 * drunk;
    // wired tremor
    const wired = Math.max(0, (hr - 95) / 100);
    const tremor = wired * 0.0025 + this.shake;
    pos.x += (Math.random() - 0.5) * tremor;
    pos.y += (Math.random() - 0.5) * tremor;
    cam.position.copy(pos);
    cam.lookAt(tgt);
    cam.rotateZ(Math.sin(t * 0.55) * 0.05 * drunk);
    if (this.drinkTilt) cam.rotateX(this.drinkTilt);

    this.fovKick *= Math.pow(0.02, dt);
    cam.fov = 58 + this.fovKick + pulse * wired * 1.2;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    this.updateHandset();

    // people
    for (const c of this.coworkers) c.update(t, dt);
    this.chad.update(t, dt);

    // gong swing
    const G = this.gong;
    if (G.swing > 0.001) {
      G.disc.rotation.x = Math.sin(t * 7) * 0.25 * G.swing;
      G.swing *= Math.pow(0.4, dt);
      G.plate.material.emissiveIntensity *= Math.pow(0.1, dt);
    }

    // flickering tube
    if (this.flicker) this.flicker.material.emissiveIntensity = Math.random() < 0.06 ? 0.15 : Math.random() < 0.5 ? 1.6 : 1.4;

    // clock hands follow the game clock
    if (this.gameMinutes !== undefined) {
      const m = this.gameMinutes;
      this.minHand.rotation.z = -((m % 60) / 60) * Math.PI * 2;
      this.hourHand.rotation.z = -(((m / 60) % 12) / 12) * Math.PI * 2;
    }

    this.screenLight.intensity = 0.3 + Math.random() * 0.03;
  }
}
