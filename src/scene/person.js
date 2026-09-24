// Stylised office humans built from primitives, with simple procedural motion.
import * as THREE from 'three';

const SKIN = ['#f1c9a5', '#e0ac85', '#c68863', '#8d5a3b', '#5c3a24', '#f5d5bc'];
const HAIR = ['#1b120c', '#3b2616', '#6b4423', '#b88a4a', '#2a2a2a', '#8a8a8a'];
const SHIRTS = ['#f2f2f2', '#cfe3f7', '#f7e7cf', '#e3cfe8', '#d6ecd2', '#ffffff'];
const TIES = ['#8c1c13', '#1a2f6b', '#d4a017', '#2d572c', '#6a1b4d', '#111'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function mat(color, rough = 0.7, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
}

export function makeChair() {
  const g = new THREE.Group();
  const black = mat('#1a1a1c', 0.6);
  const chrome = mat('#aaa', 0.25, { metalness: 0.9 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.46), black);
  seat.position.y = 0.47;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.07), black);
  back.position.set(0, 0.84, 0.22);
  back.rotation.x = -0.12;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.38), chrome);
  post.position.y = 0.25;
  g.add(seat, back, post);
  for (let i = 0; i < 5; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.04), chrome);
    const a = (i / 5) * Math.PI * 2;
    leg.position.set(Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15);
    leg.rotation.y = -a;
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), black);
    wheel.position.set(Math.cos(a) * 0.29, 0.025, Math.sin(a) * 0.29);
    g.add(leg, wheel);
  }
  g.traverse((o) => o.isMesh && ((o.castShadow = true), (o.receiveShadow = true)));
  return g;
}

/**
 * @param {{boss?:boolean, standing?:boolean, onPhone?:boolean, shirt?:string, tie?:string, female?:boolean}} o
 */
export function makePerson(o = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = mat(o.skin || pick(SKIN), 0.55);
  const shirt = mat(o.shirt || pick(SHIRTS), 0.8);
  const pants = mat(o.pants || pick(['#1c1f2b', '#2b2b2b', '#3a3226', '#20293a']), 0.8);
  const hair = mat(o.hair || pick(HAIR), 0.9);
  const tie = mat(o.tie || pick(TIES), 0.5);
  const shoes = mat('#111', 0.35);

  const hipY = o.standing ? 0.95 : 0.52;

  // legs
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.38, 4, 8);
  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(legGeo, pants);
    const shin = new THREE.Mesh(legGeo, pants);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), shoes);
    if (o.standing) {
      thigh.position.set(side * 0.1, hipY - 0.24, 0);
      shin.position.set(side * 0.1, hipY - 0.68, 0);
      shoe.position.set(side * 0.1, 0.04, -0.04);
    } else {
      thigh.rotation.x = Math.PI / 2;
      thigh.position.set(side * 0.1, hipY, -0.22);
      shin.position.set(side * 0.1, hipY - 0.26, -0.44);
      shoe.position.set(side * 0.1, 0.04, -0.5);
    }
    body.add(thigh, shin, shoe);
  }

  // torso
  const torso = new THREE.Group();
  torso.position.y = hipY;
  body.add(torso);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(o.boss ? 0.21 : 0.18, 0.36, 6, 12), shirt);
  chest.scale.set(1.15, 1, 0.72);
  chest.position.y = 0.3;
  torso.add(chest);
  const tieMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.02), tie);
  tieMesh.position.set(0, 0.34, -0.14);
  tieMesh.rotation.x = 0.08;
  torso.add(tieMesh);
  if (o.boss) {
    const susp = mat('#b3122a', 0.5);
    for (const side of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.5, 0.02), susp);
      s.position.set(side * 0.12, 0.3, -0.135);
      const s2 = s.clone();
      s2.position.z = 0.135;
      torso.add(s, s2);
    }
  }

  // head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.1), skin);
  neck.position.y = 0.62;
  torso.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.78;
  torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), skin);
  skull.scale.set(0.92, 1.08, 1);
  head.add(skull);
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 12, 0, Math.PI * 2, 0, o.female ? Math.PI * 0.62 : Math.PI * 0.45), hair);
  hairMesh.scale.set(0.95, 1.08, 1.02);
  hairMesh.rotation.x = 0.25;
  hairMesh.position.z = 0.012;
  head.add(hairMesh);
  if (o.female) {
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 4, 8), hair);
    back.position.set(0, -0.08, 0.06);
    head.add(back);
  }
  const eyeM = mat('#111', 0.3);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), eyeM);
    eye.position.set(side * 0.04, 0.02, -0.105);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(side * 0.108, 0, 0);
    head.add(eye, ear);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 8), skin);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, -0.005, -0.12);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.008, 0.01), mat('#6b2a2a', 0.6));
  mouth.position.set(0, -0.05, -0.108);
  head.add(mouth);

  // arms: shoulder pivots
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.24, 0.5, 0);
    torso.add(shoulder);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.24, 4, 8), shirt);
    upper.position.y = -0.16;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    shoulder.add(elbow);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 4, 8), shirt);
    fore.position.y = -0.14;
    elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin);
    hand.position.y = -0.3;
    elbow.add(hand);
    arms.push({ shoulder, elbow, hand, side });
  }

  // phone in right hand for callers
  let phone = null;
  if (o.onPhone) {
    phone = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), mat('#2a2a2a', 0.4));
    phone.position.set(0, -0.3, -0.02);
    arms[1].elbow.add(phone);
  }

  root.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  const person = {
    root,
    body,
    torso,
    head,
    mouth,
    arms,
    phase: Math.random() * 100,
    mode: o.onPhone ? 'phone' : 'idle', // phone | idle | cheer | walk | talk
    cheerT: 0,
    standing: !!o.standing,
    update(t, dt) {
      const p = this.phase + t;
      const [L, R] = this.arms;
      this.torso.rotation.set(0, 0, 0);
      this.body.position.y = 0;
      if (this.mode === 'cheer') {
        this.cheerT += dt;
        this.body.position.y = Math.min(0.35, this.cheerT * 1.5) * (this.standing ? 0 : 1);
        R.shoulder.rotation.set(Math.PI * 0.95 + Math.sin(p * 14) * 0.2, 0, 0);
        R.elbow.rotation.x = 0.3 + Math.sin(p * 14) * 0.3;
        L.shoulder.rotation.set(Math.PI * 0.8 + Math.cos(p * 12) * 0.2, 0, 0);
        L.elbow.rotation.x = 0.2;
        this.head.rotation.x = -0.3;
        if (this.cheerT > 3.5) {
          this.mode = this.prevMode || 'idle';
          this.cheerT = 0;
        }
        return;
      }
      if (this.mode === 'walk') {
        const s = Math.sin(p * 7);
        L.shoulder.rotation.set(s * 0.5, 0, 0);
        R.shoulder.rotation.set(-s * 0.5, 0, 0);
        L.elbow.rotation.x = R.elbow.rotation.x = 0.25;
        this.body.position.y = Math.abs(Math.cos(p * 7)) * 0.03;
        this.head.rotation.set(0, 0, 0);
        return;
      }
      if (this.mode === 'phone') {
        R.shoulder.rotation.set(0.55, 0, -0.25);
        R.elbow.rotation.x = 2.55;
        L.shoulder.rotation.set(0.5 + Math.sin(p * 2.2) * 0.35, 0, -0.25 + Math.sin(p * 1.3) * 0.2);
        L.elbow.rotation.x = 1 + Math.sin(p * 3.1) * 0.4;
        this.head.rotation.set(Math.sin(p * 1.7) * 0.12, Math.sin(p * 0.6) * 0.3, 0.15);
        this.torso.rotation.y = Math.sin(p * 0.4) * 0.25;
        this.torso.rotation.x = 0.1 + Math.sin(p * 0.9) * 0.05;
        this.mouth.scale.y = 1 + Math.abs(Math.sin(p * 11)) * 3;
        return;
      }
      if (this.mode === 'talk') {
        R.shoulder.rotation.set(0.7 + Math.sin(p * 3) * 0.3, 0, 0.1);
        R.elbow.rotation.x = 1.1 + Math.sin(p * 4) * 0.3;
        L.shoulder.rotation.set(0.15, 0, -0.1);
        L.elbow.rotation.x = 0.3;
        this.head.rotation.set(Math.sin(p * 2.5) * 0.08, 0, 0);
        this.mouth.scale.y = 1 + Math.abs(Math.sin(p * 13)) * 4;
        return;
      }
      // idle: typing
      L.shoulder.rotation.set(0.45, 0, 0.15);
      R.shoulder.rotation.set(0.45, 0, -0.15);
      L.elbow.rotation.x = 0.95 + Math.sin(p * 20) * 0.05;
      R.elbow.rotation.x = 0.95 + Math.cos(p * 23) * 0.05;
      this.head.rotation.set(0.15 + Math.sin(p * 0.5) * 0.05, Math.sin(p * 0.3) * 0.2, 0);
    },
    cheer() {
      if (this.mode !== 'cheer') this.prevMode = this.mode;
      this.mode = 'cheer';
      this.cheerT = 0;
    },
  };
  return person;
}
