// 소품 & 배우 — 주제별로 분류된 블록 스타일 3D 소품 라이브러리
// 모든 모델은 외부 에셋 없이 코드로 생성해 오프라인에서도 동작한다.
import * as THREE from 'three';

// ---------- 기본 도형 헬퍼 ----------
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
}
function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); return m;
}
function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 14, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, opts));
  m.position.set(x, y, z); return m;
}
function cone(r, h, color, x = 0, y = 0, z = 0, seg = 14, opts) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color, opts));
  m.position.set(x, y, z); return m;
}
function sph(r, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), mat(color, opts));
  m.position.set(x, y, z); return m;
}
function torus(r, tube, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 20), mat(color, opts));
  m.position.set(x, y, z); return m;
}
function group(...meshes) { const g = new THREE.Group(); g.add(...meshes); return g; }

// 사람 얼굴 텍스처 (앞면에만) — 표정 선택 가능
function makeFace(skin = '#e8b88f', face = 'basic') {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 8;
  const ctx = c.getContext('2d');
  ctx.fillStyle = skin; ctx.fillRect(0, 0, 8, 8);
  ctx.fillStyle = '#2b2b2b';
  if (face === 'wink') { ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1); ctx.fillRect(5, 2, 2, 1); ctx.fillStyle = skin; ctx.fillRect(5, 3, 2, 1); ctx.fillStyle = '#2b2b2b'; }
  else { ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1); }
  if (face === 'smile') { ctx.fillRect(2, 5, 1, 1); ctx.fillRect(3, 6, 2, 1); ctx.fillRect(5, 5, 1, 1); }
  else if (face === 'open') { ctx.fillStyle = '#7a3030'; ctx.fillRect(3, 5, 2, 2); ctx.fillStyle = '#2b2b2b'; }
  else ctx.fillRect(3, 5, 2, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 배우 꾸미기 선택지 (마인크래프트식 커스터마이징)
export const ACTOR_OPTIONS = {
  skin: ['#f5d3b3', '#e8b88f', '#c68d5e', '#8d5a3b'],
  hair: ['#2b2118', '#4a3626', '#8a5a30', '#caa64a', '#d94040', '#4a7fd4'],
  hairStyle: [
    { id: 'short', name: '짧은 머리' }, { id: 'long', name: '긴 머리' },
    { id: 'cap', name: '모자' }, { id: 'none', name: '민머리' },
  ],
  shirt: ['#d94040', '#4a7fd4', '#48a860', '#e78a2e', '#8e5bc9', '#e883b0', '#ecc94b', '#3ba7a0'],
  pants: ['#31435e', '#1e1e28', '#6b4a2b', '#c03a4a', '#48a860', '#e8e8ee'],
  face: [
    { id: 'basic', name: '기본', emoji: '🙂' }, { id: 'smile', name: '미소', emoji: '😊' },
    { id: 'open', name: '노래', emoji: '😮' }, { id: 'wink', name: '윙크', emoji: '😉' },
  ],
};
export function randomActorCfg() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  return {
    skin: pick(ACTOR_OPTIONS.skin), hair: pick(ACTOR_OPTIONS.hair),
    hairStyle: pick(ACTOR_OPTIONS.hairStyle).id, shirt: pick(ACTOR_OPTIONS.shirt),
    pants: pick(ACTOR_OPTIONS.pants), face: pick(ACTOR_OPTIONS.face).id,
  };
}

// 공통 사람 몸체 (셔츠/바지/머리/피부/표정 지정)
function person({ shirt = '#d94040', pants = '#31435e', hair = '#4a3626', skin = '#e8b88f', hairStyle = 'short', face = 'basic' } = {}) {
  const g = new THREE.Group();
  g.add(box(0.2, 0.6, 0.24, pants, -0.13, 0.3, 0));
  g.add(box(0.2, 0.6, 0.24, pants, 0.13, 0.3, 0));
  g.add(box(0.5, 0.62, 0.28, shirt, 0, 0.91, 0));
  g.add(box(0.16, 0.58, 0.24, shirt, -0.34, 0.93, 0));
  g.add(box(0.16, 0.58, 0.24, shirt, 0.34, 0.93, 0));
  const headMats = Array(6).fill(mat(skin));
  headMats[4] = new THREE.MeshStandardMaterial({ map: makeFace(skin, face), roughness: 0.85 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), headMats);
  head.position.y = 1.44; g.add(head);
  if (hairStyle === 'short') g.add(box(0.46, 0.12, 0.46, hair, 0, 1.68, 0));
  else if (hairStyle === 'long') { g.add(box(0.46, 0.12, 0.46, hair, 0, 1.68, 0)); g.add(box(0.46, 0.5, 0.14, hair, 0, 1.35, -0.2)); }
  else if (hairStyle === 'cap') { g.add(box(0.46, 0.16, 0.46, hair, 0, 1.7, 0)); g.add(box(0.46, 0.08, 0.2, hair, 0, 1.66, 0.32)); }
  return g;
}

const SHIRTS = ['#d94040', '#4a7fd4', '#48a860', '#e78a2e', '#8e5bc9', '#e883b0', '#ecc94b', '#3ba7a0'];

// ---------- 소품 빌더 ----------
const builders = {
  // === 인물 ===
  actor: (v = 0, cfg = null) => cfg ? person(cfg) : person({ shirt: SHIRTS[v % SHIRTS.length], hairStyle: v % 2 ? 'long' : 'short' }),
  child: () => {
    const g = person({ shirt: '#ffcf4d', pants: '#5b7', hairStyle: 'short' });
    g.scale.set(0.78, 0.78, 0.78); return g;
  },
  singer: () => {
    const g = person({ shirt: '#c026d3', pants: '#1e1e28', hairStyle: 'long' });
    const m = cyl(0.05, 0.05, 0.4, '#222', 0.34, 1.15, 0.28); m.rotation.z = -0.5;
    g.add(m, sph(0.06, '#888', 0.5, 1.28, 0.35)); return g;
  },
  dancer: () => {
    const g = person({ shirt: '#ff4f8b', pants: '#ff4f8b', hairStyle: 'long' });
    g.children[5] && (g.children[5].rotation.z = 0.9); // 팔 들기
    g.add(cone(0.4, 0.35, '#ff88b0', 0, 0.55, 0, 14)); // 치마
    return g;
  },
  king: () => {
    const g = person({ shirt: '#7c1fa0', pants: '#4a1266', hair: '#caa64a', hairStyle: 'short' });
    const crown = cyl(0.26, 0.26, 0.18, '#ffd54a', 0, 1.76, 0, 8);
    g.add(crown);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(cone(0.05, 0.12, '#ffd54a', Math.cos(a) * 0.22, 1.9, Math.sin(a) * 0.22, 6)); }
    g.add(box(0.55, 0.7, 0.34, '#8e2fb8', 0, 0.85, -0.02)); // 망토
    return g;
  },
  narrator: () => {
    const g = person({ shirt: '#2c3e63', pants: '#1a2540', hairStyle: 'short' });
    g.add(box(0.3, 0.4, 0.05, '#f2ead8', 0.28, 0.85, 0.16)); // 대본
    return g;
  },
  ghost: () => {
    const g = new THREE.Group();
    g.add(sph(0.4, '#eef0ff', 0, 1.2, 0, { transparent: true, opacity: 0.7, emissive: '#8890c0', emissiveIntensity: 0.3 }));
    g.add(cone(0.4, 1.0, '#eef0ff', 0, 0.6, 0, 12, { transparent: true, opacity: 0.55 }));
    g.add(sph(0.05, '#333', -0.13, 1.25, 0.34), sph(0.05, '#333', 0.13, 1.25, 0.34));
    return g;
  },

  // === 가구 ===
  chair: () => {
    const g = group(box(0.55, 0.07, 0.55, '#7a4a26', 0, 0.45, 0), box(0.55, 0.6, 0.07, '#7a4a26', 0, 0.78, -0.24));
    for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) g.add(box(0.07, 0.45, 0.07, '#5d3820', x, 0.225, z));
    return g;
  },
  stool: () => {
    const g = group(cyl(0.26, 0.26, 0.08, '#8a5a30', 0, 0.5, 0));
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const l = cyl(0.04, 0.04, 0.5, '#6b4423', Math.cos(a) * 0.18, 0.25, Math.sin(a) * 0.18); g.add(l); }
    return g;
  },
  table: () => {
    const g = group(box(1.4, 0.09, 0.85, '#8a5a30', 0, 0.72, 0));
    for (const [x, z] of [[-0.6, -0.33], [0.6, -0.33], [-0.6, 0.33], [0.6, 0.33]]) g.add(box(0.09, 0.72, 0.09, '#6b4423', x, 0.36, z));
    return g;
  },
  sofa: () => {
    const g = group(box(1.6, 0.4, 0.8, '#c0563e', 0, 0.4, 0), box(1.6, 0.5, 0.2, '#a8452f', 0, 0.75, -0.3),
      box(0.2, 0.5, 0.8, '#a8452f', -0.7, 0.65, 0), box(0.2, 0.5, 0.8, '#a8452f', 0.7, 0.65, 0));
    return g;
  },
  bench: () => {
    const g = group(box(1.6, 0.09, 0.45, '#9a6a3a', 0, 0.5, 0), box(1.6, 0.4, 0.08, '#8a5a30', 0, 0.72, -0.18));
    for (const x of [-0.7, 0.7]) g.add(box(0.09, 0.5, 0.4, '#6b4423', x, 0.25, 0));
    return g;
  },
  bed: () => {
    const g = group(box(1.4, 0.3, 2.0, '#6b4423', 0, 0.28, 0), box(1.4, 0.18, 2.0, '#e8e0ee', 0, 0.5, 0),
      box(0.9, 0.16, 0.4, '#fff', 0, 0.62, -0.7), box(1.4, 0.7, 0.15, '#5d3820', 0, 0.5, -1.02));
    return g;
  },
  throne: () => {
    const g = group(box(0.8, 0.1, 0.7, '#caa64a', 0, 0.6, 0), box(0.8, 1.4, 0.12, '#b8942e', 0, 1.0, -0.3),
      box(0.14, 0.6, 0.7, '#caa64a', -0.4, 0.85, 0), box(0.14, 0.6, 0.7, '#caa64a', 0.4, 0.85, 0), box(0.6, 0.5, 0.05, '#c0261a', 0, 1.0, -0.24));
    return g;
  },
  bookshelf: () => {
    const g = group(box(1.0, 1.8, 0.4, '#6b4423', 0, 0.9, 0));
    const cols = ['#c0563e', '#4a7fd4', '#48a860', '#ecc94b', '#8e5bc9'];
    for (let s = 0; s < 3; s++) for (let i = 0; i < 5; i++) g.add(box(0.12, 0.4, 0.3, cols[(i + s) % 5], -0.4 + i * 0.18, 0.45 + s * 0.55, 0.02));
    return g;
  },
  lamp: () => {
    const g = group(cyl(0.22, 0.28, 0.06, '#3a3d45', 0, 0.03, 0), cyl(0.03, 0.03, 1.5, '#5a5d65', 0, 0.78, 0));
    g.add(cone(0.3, 0.4, '#ffe9a8', 0, 1.6, 0, 14, { emissive: '#ffcf6a', emissiveIntensity: 0.5 }));
    return g;
  },

  // === 악기 ===
  piano: () => {
    const g = new THREE.Group();
    g.add(box(1.5, 0.42, 0.95, '#1a1a1f', 0, 0.85, 0, { roughness: 0.3 }), box(1.3, 0.06, 0.28, '#f2f2f2', 0, 0.7, 0.52));
    const lid = box(1.45, 0.05, 0.9, '#111116', 0, 1.35, -0.18, { roughness: 0.25 }); lid.rotation.x = -0.5; g.add(lid);
    for (const [x, z] of [[-0.6, -0.35], [0.6, -0.35], [0, 0.4]]) g.add(cyl(0.06, 0.06, 0.66, '#1a1a1f', x, 0.33, z));
    return g;
  },
  drum: () => {
    const g = group(cyl(0.35, 0.35, 0.45, '#c03a4a', 0, 0.55, 0, 16), cyl(0.36, 0.36, 0.04, '#eee', 0, 0.79, 0, 16));
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const leg = cyl(0.025, 0.025, 0.5, '#8f939e', Math.cos(a) * 0.25, 0.2, Math.sin(a) * 0.25); leg.rotation.z = Math.cos(a) * 0.3; leg.rotation.x = -Math.sin(a) * 0.3; g.add(leg); }
    return g;
  },
  guitar: () => {
    const g = new THREE.Group();
    g.add(sph(0.34, '#c9822e', 0, 0.7, 0, { flatShading: false }));
    g.children[0].scale.set(1, 1.25, 0.32);
    g.add(cyl(0.02, 0.02, 0.04, '#111', 0, 0.7, 0.12), box(0.1, 1.0, 0.06, '#7a4a26', 0, 1.5, 0), box(0.16, 0.24, 0.07, '#5d3820', 0, 2.05, 0));
    return g;
  },
  mic: () => {
    const g = group(cyl(0.24, 0.28, 0.06, '#2b2d33', 0, 0.03, 0), cyl(0.025, 0.025, 1.35, '#3a3d45', 0, 0.7, 0));
    const h = cyl(0.06, 0.045, 0.22, '#22242a', 0, 1.42, 0.06); h.rotation.x = 0.7; g.add(h, sph(0.07, '#8f939e', 0, 1.5, 0.13));
    return g;
  },
  speaker: () => {
    const g = group(box(0.7, 1.15, 0.6, '#202126', 0, 0.575, 0));
    const c1 = cyl(0.22, 0.22, 0.05, '#0c0c0f', 0, 0.82, 0.31); c1.rotation.x = Math.PI / 2;
    const c2 = cyl(0.13, 0.13, 0.05, '#0c0c0f', 0, 0.35, 0.31); c2.rotation.x = Math.PI / 2;
    g.add(c1, c2); return g;
  },
  keyboard: () => {
    const g = group(box(1.2, 0.1, 0.35, '#18181d', 0, 0.72, 0), box(1.1, 0.04, 0.28, '#f4f4f4', 0, 0.79, 0.02));
    for (const x of [-0.5, 0.5]) g.add(cyl(0.03, 0.03, 0.7, '#333', x, 0.35, 0));
    return g;
  },
  violin_stand: () => {
    const g = group(box(0.4, 0.03, 0.3, '#111', 0, 1.1, 0), cyl(0.02, 0.02, 1.1, '#333', 0, 0.55, 0), cyl(0.18, 0.2, 0.03, '#111', 0, 0.02, 0));
    g.children[0].rotation.x = -0.4; return g;
  },
  amp: () => {
    const g = group(box(0.8, 0.6, 0.4, '#1a1a1e', 0, 0.3, 0), box(0.7, 0.5, 0.02, '#2a2a30', 0, 0.3, 0.21));
    g.add(box(0.7, 0.08, 0.05, '#c9a23a', 0, 0.55, 0.21)); return g;
  },

  // === 자연 ===
  tree: () => {
    const g = group(cyl(0.14, 0.18, 1.1, '#6b4a2b', 0, 0.55, 0, 8), sph(0.65, '#3e7d3a', 0, 1.5, 0), sph(0.45, '#4c974a', 0.35, 1.9, 0.1), sph(0.4, '#356e33', -0.35, 1.85, -0.1));
    return g;
  },
  pine: () => {
    const g = group(cyl(0.12, 0.15, 0.6, '#6b4a2b', 0, 0.3, 0, 8), cone(0.7, 0.9, '#2f6b3a', 0, 0.9, 0, 10), cone(0.55, 0.8, '#357a40', 0, 1.35, 0, 10), cone(0.4, 0.7, '#3d8a48', 0, 1.8, 0, 10));
    return g;
  },
  plant: () => group(cyl(0.22, 0.16, 0.32, '#a35b35', 0, 0.16, 0), sph(0.28, '#3e7d3a', 0, 0.55, 0), sph(0.2, '#4c974a', -0.16, 0.75, 0.05), sph(0.18, '#356e33', 0.15, 0.72, -0.06)),
  flower: () => {
    const g = group(cyl(0.03, 0.03, 0.5, '#3e7d3a', 0, 0.25, 0));
    g.add(sph(0.1, '#ffd54a', 0, 0.55, 0));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(sph(0.08, '#ff6fae', Math.cos(a) * 0.14, 0.55, Math.sin(a) * 0.14)); }
    return g;
  },
  bush: () => group(sph(0.4, '#3e7d3a', -0.2, 0.35, 0), sph(0.4, '#4c974a', 0.2, 0.35, 0.1), sph(0.35, '#356e33', 0, 0.4, -0.2)),
  rock: () => { const r = sph(0.5, '#8f9099', 0, 0.35, 0, { flatShading: true, roughness: 1 }); r.scale.set(1, 0.7, 0.85); return group(r); },
  pumpkin: () => { const p = sph(0.4, '#e08028', 0, 0.35, 0, { flatShading: true }); p.scale.set(1, 0.8, 1); return group(p, cyl(0.05, 0.06, 0.18, '#5a7a2a', 0, 0.7, 0)); },
  cloud: () => group(sph(0.4, '#fff', -0.3, 0, 0, { transparent: true, opacity: 0.92 }), sph(0.5, '#fff', 0.1, 0.05, 0, { transparent: true, opacity: 0.92 }), sph(0.35, '#f0f0f8', 0.5, 0, 0.1, { transparent: true, opacity: 0.92 })),

  // === 무대 장치 ===
  podium: () => group(box(0.7, 1.1, 0.5, '#7a4a26', 0, 0.55, 0), box(0.85, 0.12, 0.6, '#8a5a30', 0, 1.15, 0.06), box(0.5, 0.35, 0.03, '#caa64a', 0, 0.85, 0.26)),
  stairs: () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) g.add(box(1.2, 0.3, 0.35, '#8a5a30', 0, 0.15 + i * 0.3, 0.5 - i * 0.35)); return g; },
  column: () => group(cyl(0.32, 0.36, 0.2, '#e0ddd4', 0, 0.1, 0, 16), cyl(0.26, 0.26, 2.2, '#eae7de', 0, 1.25, 0, 16), cyl(0.34, 0.3, 0.2, '#e0ddd4', 0, 2.45, 0, 16)),
  arch: () => group(box(0.4, 2.2, 0.4, '#b8942e', -1.1, 1.1, 0), box(0.4, 2.2, 0.4, '#b8942e', 1.1, 1.1, 0), box(2.6, 0.4, 0.4, '#caa64a', 0, 2.4, 0)),
  ladder: () => { const g = group(box(0.08, 2.2, 0.08, '#8a5a30', -0.3, 1.1, 0), box(0.08, 2.2, 0.08, '#8a5a30', 0.3, 1.1, 0)); for (let i = 0; i < 6; i++) g.add(box(0.68, 0.06, 0.06, '#9a6a3a', 0, 0.3 + i * 0.36, 0)); return g; },
  platform: () => group(box(1.6, 0.5, 1.6, '#5d3820', 0, 0.25, 0), box(1.6, 0.08, 1.6, '#8a5a30', 0, 0.54, 0)),
  rope: () => { const g = group(cyl(0.06, 0.08, 0.8, '#caa64a', -0.6, 0.4, 0, 10), cyl(0.06, 0.08, 0.8, '#caa64a', 0.6, 0.4, 0, 10)); const r = torus(0.02, 0.02, '#c0261a', 0, 0.7, 0); r.scale.set(30, 6, 1); r.rotation.z = Math.PI / 2; g.add(box(1.2, 0.04, 0.04, '#c0261a', 0, 0.7, 0)); return g; },
  curtain_stand: () => group(cyl(0.05, 0.05, 2.2, '#caa64a', -0.9, 1.1, 0, 8), cyl(0.05, 0.05, 2.2, '#caa64a', 0.9, 1.1, 0, 8), box(1.9, 0.08, 0.08, '#caa64a', 0, 2.2, 0), box(1.7, 1.9, 0.06, '#8f1f2d', 0, 1.2, 0, { side: THREE.DoubleSide })),

  // === 물건 ===
  crate: () => { const g = box(0.7, 0.7, 0.7, '#9a6a3a', 0, 0.35, 0); const f = new THREE.Group(); f.add(g); for (const s of [0.36, -0.36]) { f.add(box(0.72, 0.1, 0.05, '#6b4423', 0, 0.5, s), box(0.72, 0.1, 0.05, '#6b4423', 0, 0.2, s)); } return f; },
  chest: () => { const g = group(box(0.8, 0.5, 0.5, '#8a5a30', 0, 0.25, 0)); const lid = box(0.82, 0.3, 0.52, '#6b4423', 0, 0.6, -0.02); lid.rotation.x = -0.3; g.add(lid, box(0.1, 0.15, 0.05, '#ffd54a', 0, 0.4, 0.26)); return g; },
  lantern: () => group(cyl(0.03, 0.03, 0.2, '#333', 0, 1.0, 0), box(0.22, 0.3, 0.22, '#caa64a', 0, 0.75, 0, { emissive: '#ffcf4a', emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }), box(0.26, 0.06, 0.26, '#5d3820', 0, 0.92, 0), box(0.26, 0.06, 0.26, '#5d3820', 0, 0.58, 0)),
  candle: () => group(cyl(0.14, 0.16, 0.08, '#caa64a', 0, 0.04, 0), cyl(0.07, 0.08, 0.35, '#f0e8d8', 0, 0.25, 0), cone(0.05, 0.14, '#ffb02e', 0, 0.5, 0, 8, { emissive: '#ff9500', emissiveIntensity: 0.9 })),
  sign: () => group(cyl(0.05, 0.05, 1.2, '#6b4423', 0, 0.6, 0, 8), box(0.9, 0.5, 0.08, '#9a6a3a', 0, 1.15, 0), box(0.8, 0.4, 0.02, '#f2ead8', 0, 1.15, 0.05)),
  flag: () => { const g = group(cyl(0.04, 0.04, 2.2, '#8a5a30', 0, 1.1, 0, 8)); const f = box(0.9, 0.55, 0.03, '#c0261a', 0.47, 1.9, 0, { side: THREE.DoubleSide }); g.add(f); return g; },
  gift: () => group(box(0.6, 0.6, 0.6, '#d94077', 0, 0.3, 0), box(0.64, 0.64, 0.12, '#ffd54a', 0, 0.3, 0), box(0.12, 0.64, 0.64, '#ffd54a', 0, 0.3, 0), sph(0.12, '#ffd54a', 0, 0.64, 0)),
  clock: () => group(cyl(0.05, 0.05, 1.4, '#5d3820', 0, 0.7, 0, 8), cyl(0.35, 0.35, 0.12, '#6b4423', 0, 1.5, 0, 16), cyl(0.28, 0.28, 0.02, '#f2ead8', 0, 1.5, 0.07, 16), box(0.02, 0.18, 0.02, '#222', 0, 1.56, 0.09)),
  easel: () => { const g = group(box(0.9, 1.1, 0.04, '#f2ead8', 0, 1.0, 0)); for (const [x, rz] of [[-0.35, 0.2], [0.35, -0.2]]) { const l = cyl(0.03, 0.03, 1.6, '#8a5a30', x, 0.8, 0.1); l.rotation.z = rz; g.add(l); } g.add(box(0.6, 0.4, 0.02, '#8ac6e0', 0, 1.05, 0.03)); return g; },
  torch: () => group(cyl(0.05, 0.06, 0.9, '#5d3820', 0, 0.45, 0, 8), sph(0.12, '#ff7b1a', 0, 0.95, 0, { emissive: '#ff5a00', emissiveIntensity: 1 }), cone(0.1, 0.25, '#ffd54a', 0, 1.12, 0, 8, { emissive: '#ff9500', emissiveIntensity: 0.9 })),
};

// 잘못된 헬퍼 호출 방지용 정리 (mushroom/barrel/ball 안전 처리)
builders.mushroom = () => group(cyl(0.12, 0.14, 0.4, '#f0e8d8', 0, 0.2, 0), sph(0.3, '#d94040', 0, 0.44, 0, { flatShading: true }));
builders.barrel = () => group(cyl(0.32, 0.28, 0.8, '#8a5a30', 0, 0.4, 0, 14), cyl(0.34, 0.34, 0.06, '#5d3820', 0, 0.6, 0, 14), cyl(0.34, 0.34, 0.06, '#5d3820', 0, 0.2, 0, 14));
builders.ball = (v = 0) => group(sph(0.3, SHIRTS[v % SHIRTS.length], 0, 0.3, 0));
builders.rope = () => group(cyl(0.06, 0.08, 0.8, '#caa64a', -0.6, 0.4, 0, 10), cyl(0.06, 0.08, 0.8, '#caa64a', 0.6, 0.4, 0, 10), box(1.2, 0.05, 0.05, '#c0261a', 0, 0.72, 0));

// ---------- 카테고리 정의 ----------
export const PROP_CATEGORIES = [
  { id: 'people', name: '인물', emoji: '🧑', items: [
    { id: 'actor', emoji: '🧍', name: '배우', desc: '무대의 주인공! 아래에서 직접 꾸밀 수 있어요' },
    { id: 'child', emoji: '🧒', name: '어린이', desc: '작은 배역' },
    { id: 'singer', emoji: '🎤', name: '가수', desc: '마이크를 든 가수' },
    { id: 'dancer', emoji: '💃', name: '무용수', desc: '춤추는 배우' },
    { id: 'king', emoji: '👑', name: '왕/여왕', desc: '왕관과 망토를 입은 인물' },
    { id: 'narrator', emoji: '📖', name: '해설자', desc: '대본을 든 내레이터' },
    { id: 'ghost', emoji: '👻', name: '유령', desc: '으스스한 장면에!' },
  ]},
  { id: 'furniture', name: '가구', emoji: '🪑', items: [
    { id: 'chair', emoji: '🪑', name: '의자', desc: '앉을 수 있는 나무 의자' },
    { id: 'stool', emoji: '🪑', name: '등받이 없는 의자', desc: '동그란 스툴' },
    { id: 'table', emoji: '🟫', name: '테이블', desc: '나무 탁자' },
    { id: 'sofa', emoji: '🛋️', name: '소파', desc: '푹신한 소파' },
    { id: 'bench', emoji: '🪑', name: '벤치', desc: '긴 나무 벤치' },
    { id: 'bed', emoji: '🛏️', name: '침대', desc: '잠자는 장면에' },
    { id: 'throne', emoji: '👑', name: '왕좌', desc: '금빛 왕의 의자' },
    { id: 'bookshelf', emoji: '📚', name: '책장', desc: '책이 꽂힌 책장' },
    { id: 'lamp', emoji: '🛋️', name: '플로어 램프', desc: '아늑한 조명 소품' },
  ]},
  { id: 'music', name: '악기', emoji: '🎸', items: [
    { id: 'piano', emoji: '🎹', name: '그랜드 피아노', desc: '음악 공연의 필수품' },
    { id: 'drum', emoji: '🥁', name: '드럼', desc: '둥둥! 리듬 악기' },
    { id: 'guitar', emoji: '🎸', name: '기타', desc: '어쿠스틱 기타' },
    { id: 'keyboard', emoji: '🎹', name: '키보드', desc: '스탠드형 전자 키보드' },
    { id: 'violin_stand', emoji: '🎻', name: '악보 스탠드', desc: '악보를 올리는 보면대' },
    { id: 'mic', emoji: '🎤', name: '마이크 스탠드', desc: '노래하고 말하는 자리' },
    { id: 'speaker', emoji: '🔊', name: '스피커', desc: '소리를 크게!' },
    { id: 'amp', emoji: '📻', name: '앰프', desc: '기타 앰프' },
  ]},
  { id: 'nature', name: '자연', emoji: '🌳', items: [
    { id: 'tree', emoji: '🌳', name: '나무', desc: '둥근 잎의 나무' },
    { id: 'pine', emoji: '🌲', name: '소나무', desc: '뾰족한 침엽수' },
    { id: 'plant', emoji: '🪴', name: '화분', desc: '초록 식물' },
    { id: 'flower', emoji: '🌸', name: '꽃', desc: '분홍 꽃 한 송이' },
    { id: 'bush', emoji: '🌿', name: '덤불', desc: '낮은 수풀' },
    { id: 'rock', emoji: '🪨', name: '바위', desc: '회색 바위' },
    { id: 'mushroom', emoji: '🍄', name: '버섯', desc: '동화 속 버섯' },
    { id: 'pumpkin', emoji: '🎃', name: '호박', desc: '가을·핼러윈 장면에' },
    { id: 'cloud', emoji: '☁️', name: '구름', desc: '하늘 장면 소품 (공중에 놓아요)' },
  ]},
  { id: 'stage', name: '무대장치', emoji: '🎬', items: [
    { id: 'podium', emoji: '🎙️', name: '연단', desc: '발표·연설대' },
    { id: 'stairs', emoji: '🪜', name: '계단', desc: '오르내리는 계단' },
    { id: 'column', emoji: '🏛️', name: '기둥', desc: '그리스식 흰 기둥' },
    { id: 'arch', emoji: '🌉', name: '아치문', desc: '금빛 아치 입구' },
    { id: 'ladder', emoji: '🪜', name: '사다리', desc: '높은 곳으로!' },
    { id: 'platform', emoji: '🟫', name: '단상 상자', desc: '높이를 주는 플랫폼' },
    { id: 'rope', emoji: '🚧', name: '차단 기둥', desc: '관객 동선을 막는 로프' },
    { id: 'curtain_stand', emoji: '🪟', name: '이동식 커튼', desc: '작은 커튼 스탠드' },
  ]},
  { id: 'object', name: '물건', emoji: '📦', items: [
    { id: 'crate', emoji: '📦', name: '나무 상자', desc: '쌓아 올릴 수 있는 상자' },
    { id: 'barrel', emoji: '🛢️', name: '나무통', desc: '해적선·시장 장면에' },
    { id: 'chest', emoji: '💰', name: '보물상자', desc: '반짝이는 보물!' },
    { id: 'lantern', emoji: '🏮', name: '랜턴', desc: '매달린 등불' },
    { id: 'candle', emoji: '🕯️', name: '촛불', desc: '아늑한 촛불' },
    { id: 'torch', emoji: '🔥', name: '횃불', desc: '벽에 거는 불빛' },
    { id: 'sign', emoji: '🪧', name: '표지판', desc: '장소를 알리는 팻말' },
    { id: 'ball', emoji: '⚽', name: '공', desc: '놀이 장면 소품' },
    { id: 'flag', emoji: '🚩', name: '깃발', desc: '축제·전투 장면에' },
    { id: 'gift', emoji: '🎁', name: '선물상자', desc: '생일·크리스마스 장면에' },
    { id: 'clock', emoji: '🕰️', name: '괘종시계', desc: '시간을 알리는 시계' },
    { id: 'easel', emoji: '🎨', name: '이젤', desc: '그림 그리는 화판' },
  ]},
];

// id -> 카테고리 조회용
export const PROP_INFO = {};
for (const cat of PROP_CATEGORIES) for (const it of cat.items) PROP_INFO[it.id] = { ...it, cat: cat.id };

export function buildProp(typeId, variant = 0, cfg = null) {
  const b = builders[typeId] || builders.crate;
  const g = b(variant, cfg) || new THREE.Group();
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
