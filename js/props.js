// 소품 & 배우 — 상자/원기둥을 조합한 심플 3D 소품들
import * as THREE from 'three';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
}
function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z);
  return m;
}
function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 12, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, opts));
  m.position.set(x, y, z);
  return m;
}
function sph(r, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(color));
  m.position.set(x, y, z);
  return m;
}

const ACTOR_SHIRTS = ['#d94040', '#4a7fd4', '#48a860', '#e78a2e', '#8e5bc9', '#e883b0', '#ecc94b'];

function makeFace() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 8;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8b88f'; ctx.fillRect(0, 0, 8, 8);
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1);   // 눈
  ctx.fillRect(3, 5, 2, 1);                              // 입
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const builders = {
  actor(variant = 0) {
    const g = new THREE.Group();
    const shirt = ACTOR_SHIRTS[variant % ACTOR_SHIRTS.length];
    const skin = '#e8b88f', pants = '#31435e';
    g.add(box(0.2, 0.6, 0.24, pants, -0.13, 0.3, 0));
    g.add(box(0.2, 0.6, 0.24, pants, 0.13, 0.3, 0));
    g.add(box(0.5, 0.62, 0.28, shirt, 0, 0.91, 0));
    g.add(box(0.16, 0.58, 0.24, shirt, -0.34, 0.93, 0));
    g.add(box(0.16, 0.58, 0.24, shirt, 0.34, 0.93, 0));
    // 머리 — 앞면에만 얼굴 텍스처
    const headMats = Array(6).fill(mat(skin));
    headMats[4] = new THREE.MeshStandardMaterial({ map: makeFace(), roughness: 0.85 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), headMats);
    head.position.y = 1.44;
    g.add(head);
    g.add(box(0.46, 0.1, 0.46, '#4a3626', 0, 1.68, 0)); // 머리카락
    return g;
  },

  chair() {
    const g = new THREE.Group();
    const c = '#7a4a26';
    g.add(box(0.55, 0.07, 0.55, c, 0, 0.45, 0));
    g.add(box(0.55, 0.6, 0.07, c, 0, 0.78, -0.24));
    for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]])
      g.add(box(0.07, 0.45, 0.07, '#5d3820', x, 0.225, z));
    return g;
  },

  table() {
    const g = new THREE.Group();
    g.add(box(1.4, 0.09, 0.85, '#8a5a30', 0, 0.72, 0));
    for (const [x, z] of [[-0.6, -0.33], [0.6, -0.33], [-0.6, 0.33], [0.6, 0.33]])
      g.add(box(0.09, 0.72, 0.09, '#6b4423', x, 0.36, z));
    return g;
  },

  piano() {
    const g = new THREE.Group();
    g.add(box(1.5, 0.42, 0.95, '#1a1a1f', 0, 0.85, 0, { roughness: 0.3 }));
    g.add(box(1.3, 0.06, 0.28, '#f2f2f2', 0, 0.7, 0.52));
    const lid = box(1.45, 0.05, 0.9, '#111116', 0, 1.35, -0.18, { roughness: 0.25 });
    lid.rotation.x = -0.5;
    g.add(lid);
    for (const [x, z] of [[-0.6, -0.35], [0.6, -0.35], [0, 0.4]])
      g.add(cyl(0.06, 0.06, 0.66, '#1a1a1f', x, 0.33, z));
    return g;
  },

  speaker() {
    const g = new THREE.Group();
    g.add(box(0.7, 1.15, 0.6, '#202126', 0, 0.575, 0));
    const c1 = cyl(0.22, 0.22, 0.05, '#0c0c0f', 0, 0.82, 0.31);
    c1.rotation.x = Math.PI / 2;
    const c2 = cyl(0.13, 0.13, 0.05, '#0c0c0f', 0, 0.35, 0.31);
    c2.rotation.x = Math.PI / 2;
    g.add(c1, c2);
    return g;
  },

  mic() {
    const g = new THREE.Group();
    g.add(cyl(0.24, 0.28, 0.06, '#2b2d33', 0, 0.03, 0));
    g.add(cyl(0.025, 0.025, 1.35, '#3a3d45', 0, 0.7, 0));
    const micHead = cyl(0.06, 0.045, 0.22, '#22242a', 0, 1.42, 0.06);
    micHead.rotation.x = 0.7;
    g.add(micHead);
    g.add(sph(0.07, '#8f939e', 0, 1.5, 0.13));
    return g;
  },

  plant() {
    const g = new THREE.Group();
    g.add(cyl(0.22, 0.16, 0.32, '#a35b35', 0, 0.16, 0));
    g.add(sph(0.28, '#3e7d3a', 0, 0.55, 0));
    g.add(sph(0.2, '#4c974a', -0.16, 0.75, 0.05));
    g.add(sph(0.18, '#356e33', 0.15, 0.72, -0.06));
    return g;
  },

  drum() {
    const g = new THREE.Group();
    g.add(cyl(0.35, 0.35, 0.45, '#c03a4a', 0, 0.55, 0, 16));
    g.add(cyl(0.36, 0.36, 0.04, '#eeeeee', 0, 0.79, 0, 16));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = cyl(0.025, 0.025, 0.5, '#8f939e', Math.cos(a) * 0.25, 0.2, Math.sin(a) * 0.25);
      leg.rotation.z = Math.cos(a) * 0.3;
      leg.rotation.x = -Math.sin(a) * 0.3;
      g.add(leg);
    }
    return g;
  },

  tree() {
    const g = new THREE.Group();
    g.add(cyl(0.14, 0.18, 1.1, '#6b4a2b', 0, 0.55, 0, 8));
    g.add(sph(0.65, '#3e7d3a', 0, 1.5, 0));
    g.add(sph(0.45, '#4c974a', 0.35, 1.9, 0.1));
    g.add(sph(0.4, '#356e33', -0.35, 1.85, -0.1));
    return g;
  },
};

export const PROP_TYPES = [
  { id: 'actor',   emoji: '🧍', name: '배우',        desc: '무대의 주인공! 놓을 때마다 옷 색이 달라져요' },
  { id: 'chair',   emoji: '🪑', name: '의자',        desc: '앉을 수 있는 나무 의자' },
  { id: 'table',   emoji: '🟫', name: '테이블',      desc: '장면에 어울리는 나무 탁자' },
  { id: 'piano',   emoji: '🎹', name: '그랜드 피아노', desc: '음악 공연의 필수품' },
  { id: 'speaker', emoji: '🔊', name: '스피커',      desc: '소리를 크게! 무대 양옆에 놓아요' },
  { id: 'mic',     emoji: '🎤', name: '마이크 스탠드', desc: '노래하고 말하는 자리' },
  { id: 'drum',    emoji: '🥁', name: '드럼',        desc: '둥둥! 리듬 악기' },
  { id: 'plant',   emoji: '🪴', name: '화분',        desc: '무대를 꾸미는 초록 식물' },
  { id: 'tree',    emoji: '🌳', name: '나무',        desc: '숲 장면을 만들 때 좋아요' },
];

export function buildProp(typeId, variant = 0) {
  const g = builders[typeId](variant);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
