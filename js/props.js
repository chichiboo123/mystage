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
  const ink = '#2b2b2b';
  ctx.fillStyle = ink;
  // 눈 — 표정별로 모양 다르게
  const eyesClosed = () => { ctx.fillRect(1, 4, 2, 1); ctx.fillRect(5, 4, 2, 1); };
  const eyesOpen = () => { ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1); };
  const eyesBig = () => { ctx.fillRect(1, 2, 2, 2); ctx.fillRect(5, 2, 2, 2); };
  if (face === 'wink') { ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 4, 2, 1); }
  else if (face === 'closed' || face === 'sleep') eyesClosed();
  else if (face === 'surprise') eyesBig();
  else if (face === 'sad') { ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1); }
  else if (face === 'angry') { ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1); ctx.fillRect(1, 2, 1, 1); ctx.fillRect(6, 2, 1, 1); }
  else eyesOpen();
  // 입 — 표정별
  if (face === 'smile' || face === 'laugh') { ctx.fillRect(2, 5, 1, 1); ctx.fillRect(3, 6, 2, 1); ctx.fillRect(5, 5, 1, 1); }
  else if (face === 'open' || face === 'sing') { ctx.fillStyle = '#7a3030'; ctx.fillRect(3, 5, 2, 2); ctx.fillStyle = ink; }
  else if (face === 'surprise') { ctx.fillStyle = '#7a3030'; ctx.fillRect(3, 5, 2, 2); ctx.fillStyle = ink; }
  else if (face === 'sad') { ctx.fillRect(3, 6, 2, 1); ctx.fillRect(2, 5, 1, 1); ctx.fillRect(5, 5, 1, 1); }
  else if (face === 'angry') { ctx.fillRect(2, 6, 4, 1); }
  else if (face === 'nervous') { ctx.fillRect(2, 6, 3, 1); }
  else ctx.fillRect(3, 5, 2, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SHIRTS = ['#d94040', '#4a7fd4', '#48a860', '#e78a2e', '#8e5bc9', '#e883b0', '#ecc94b', '#3ba7a0'];

// 색을 곱해서 살짝 어둡게 (의상 음영·소매 구분용)
function darken(hex, f = 0.82) {
  const c = new THREE.Color(hex); c.multiplyScalar(f); return `#${c.getHexString()}`;
}

// ---------- 공통 사람 몸체 (골격 그룹으로 구성해 자세·애니메이션 지원) ----------
// 반환 그룹의 userData.rig = { core, neck, shoulderL, shoulderR, hipL, hipR }
// 각 부위는 관절(피벗) 그룹이며, 자식 메시는 로컬 좌표계에서 관절 아래로 매달린다.
function person(cfg = {}) {
  const {
    shirt = '#d94040', pants = '#31435e', hair = '#4a3626', skin = '#e8b88f',
    hairStyle = 'short', face = 'basic',
    outfit = 'tshirt', hat = 'none', hatColor = '#ffd54a', glasses = 'none', item = 'none',
  } = cfg;

  const root = new THREE.Group();
  const sleeve = outfit === 'dress' ? shirt : darken(shirt, 0.9);

  // ----- 다리(엉덩이 관절) -----
  const legMesh = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, 0.6, 0);
    hip.add(box(0.2, 0.6, 0.24, pants, 0, -0.3, 0));
    hip.add(box(0.22, 0.1, 0.3, darken(pants, 0.6), 0, -0.6, 0.03)); // 신발
    hip.userData.part = side < 0 ? 'legL' : 'legR';
    return hip;
  };
  const hipL = legMesh(-1), hipR = legMesh(1);
  root.add(hipL, hipR);

  // ----- 상체(엉덩이 기준 관절) : 몸통 + 팔 + 머리 -----
  const core = new THREE.Group();
  core.position.set(0, 0.6, 0);
  core.userData.part = 'core';
  root.add(core);

  // 몸통 (의상별)
  core.add(box(0.5, 0.62, 0.28, shirt, 0, 0.31, 0)); // 기본 몸통 (world y 0.91)
  buildOutfit(core, outfit, shirt, pants, hatColor);

  // 팔(어깨 관절)
  const armMesh = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.34, 0.6, 0); // world y 1.2
    sh.add(box(0.16, 0.5, 0.24, sleeve, 0, -0.23, 0)); // 소매
    sh.add(box(0.15, 0.12, 0.22, skin, 0, -0.53, 0));  // 손
    sh.userData.part = side < 0 ? 'armL' : 'armR';
    return sh;
  };
  const shoulderL = armMesh(-1), shoulderR = armMesh(1);
  core.add(shoulderL, shoulderR);

  // 머리(목 관절)
  const neck = new THREE.Group();
  neck.position.set(0, 0.63, 0); // world y 1.23
  neck.userData.part = 'head';
  core.add(neck);

  const headMats = Array(6).fill(mat(skin));
  headMats[4] = new THREE.MeshStandardMaterial({ map: makeFace(skin, face), roughness: 0.85 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), headMats);
  head.position.y = 0.21; // world y 1.44
  neck.add(head);

  // 머리카락
  if (hairStyle === 'short') neck.add(box(0.46, 0.12, 0.46, hair, 0, 0.45, 0));
  else if (hairStyle === 'long') { neck.add(box(0.46, 0.12, 0.46, hair, 0, 0.45, 0)); neck.add(box(0.46, 0.5, 0.14, hair, 0, 0.12, -0.2)); }
  else if (hairStyle === 'ponytail') { neck.add(box(0.46, 0.12, 0.46, hair, 0, 0.45, 0)); neck.add(box(0.16, 0.4, 0.16, hair, 0, 0.2, -0.26)); }
  else if (hairStyle === 'bun') { neck.add(box(0.46, 0.12, 0.46, hair, 0, 0.45, 0)); neck.add(sph(0.13, hair, 0, 0.5, -0.22)); }
  // 'none'(민머리)은 머리카락 없음

  // 모자·액세서리 (머리 관절에 부착)
  buildHat(neck, hat, hatColor, hair);
  buildGlasses(neck, glasses);

  // 소지품·악기 (상체에 부착 — 손 근처)
  buildHeldItem(core, item);

  root.userData.rig = { core, neck, shoulderL, shoulderR, hipL, hipR };
  root.userData.isPerson = true;
  return root;
}

// 의상 세부 (core 로컬 좌표계: world y = local y + 0.6)
function buildOutfit(core, outfit, shirt, pants, accent) {
  const acc = darken(shirt, 0.7);
  if (outfit === 'shirt') {
    core.add(box(0.52, 0.1, 0.3, '#f4f4f8', 0, 0.58, 0.01)); // 옷깃
    core.add(box(0.06, 0.62, 0.02, acc, 0, 0.31, 0.15));      // 단추선
  } else if (outfit === 'jacket') {
    core.add(box(0.54, 0.64, 0.3, darken(shirt, 0.85), 0, 0.31, 0)); // 겉옷
    core.add(box(0.12, 0.6, 0.02, '#f4f4f8', -0.14, 0.31, 0.16));
    core.add(box(0.12, 0.6, 0.02, '#f4f4f8', 0.14, 0.31, 0.16));
  } else if (outfit === 'hoodie') {
    core.add(box(0.5, 0.2, 0.34, darken(shirt, 0.8), 0, 0.6, -0.02)); // 후드
    core.add(box(0.3, 0.16, 0.02, acc, 0, 0.16, 0.16));               // 주머니
    core.add(box(0.05, 0.2, 0.05, '#f4f4f8', 0, 0.5, 0.14));          // 끈
  } else if (outfit === 'dress' || outfit === 'royal') {
    const skirt = cone(0.5, 0.7, shirt, 0, -0.05, 0, 16); core.add(skirt); // 치마 (허리에서 아래로)
    if (outfit === 'royal') {
      const cape = box(0.55, 0.75, 0.06, accent, 0, 0.28, -0.16); core.add(cape); // 망토
      core.add(box(0.52, 0.12, 0.3, '#f7f0d8', 0, 0.58, 0.01));
    }
  } else if (outfit === 'uniform') {
    core.add(box(0.52, 0.12, 0.3, '#f4f4f8', 0, 0.56, 0.01));  // 흰 옷깃
    core.add(box(0.1, 0.34, 0.02, acc, 0, 0.4, 0.15));         // 넥타이
  } else if (outfit === 'stage') {
    core.add(box(0.52, 0.64, 0.3, shirt, 0, 0.31, 0, { emissive: shirt, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.35 }));
    core.add(box(0.54, 0.08, 0.32, accent, 0, 0.02, 0, { emissive: accent, emissiveIntensity: 0.4 })); // 반짝 띠
  } else if (outfit === 'sporty') {
    core.add(box(0.08, 0.6, 0.02, '#f4f4f8', -0.2, 0.31, 0.15)); // 옆줄
    core.add(box(0.08, 0.6, 0.02, '#f4f4f8', 0.2, 0.31, 0.15));
  }
  // 'tshirt'는 기본 몸통만
}

// 모자·머리 액세서리
function buildHat(neck, hat, color, hair) {
  if (hat === 'cap') { // 야구모자
    neck.add(box(0.46, 0.16, 0.46, color, 0, 0.5, 0));
    neck.add(box(0.44, 0.06, 0.28, color, 0, 0.46, 0.32)); // 챙
  } else if (hat === 'crown') { // 왕관
    neck.add(cyl(0.26, 0.26, 0.16, color, 0, 0.56, 0, 8));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; neck.add(cone(0.05, 0.12, color, Math.cos(a) * 0.22, 0.68, Math.sin(a) * 0.22, 6)); }
  } else if (hat === 'fedora') { // 중절모·챙모자
    neck.add(cyl(0.45, 0.45, 0.04, darken(color, 0.85), 0, 0.46, 0, 16)); // 넓은 챙
    neck.add(cyl(0.24, 0.26, 0.24, color, 0, 0.6, 0, 16));
    neck.add(cyl(0.245, 0.265, 0.06, darken(color, 0.6), 0, 0.52, 0, 16)); // 띠
  } else if (hat === 'headband') { // 머리띠
    neck.add(torus(0.24, 0.04, color, 0, 0.44, 0));
    neck.children[neck.children.length - 1].rotation.x = Math.PI / 2;
  } else if (hat === 'ribbon') { // 리본
    neck.add(box(0.1, 0.1, 0.1, color, -0.1, 0.5, -0.02));
    neck.add(box(0.1, 0.1, 0.1, color, 0.1, 0.5, -0.02));
    neck.add(box(0.06, 0.06, 0.06, darken(color, 0.7), 0, 0.5, -0.02));
  } else if (hat === 'beanie') { // 비니
    neck.add(box(0.48, 0.2, 0.48, color, 0, 0.46, 0));
  }
}

// 안경·선글라스
function buildGlasses(neck, glasses) {
  if (glasses === 'none') return;
  const col = glasses === 'sunglasses' ? '#181820' : '#333844';
  const opts = glasses === 'sunglasses' ? { roughness: 0.3, metalness: 0.4 } : {};
  neck.add(box(0.15, 0.1, 0.03, col, -0.1, 0.21, 0.22, opts));
  neck.add(box(0.15, 0.1, 0.03, col, 0.1, 0.21, 0.22, opts));
  neck.add(box(0.06, 0.02, 0.02, col, 0, 0.21, 0.22, opts)); // 다리
}

// 손에 드는 악기·소지품 (core 로컬 좌표계)
function buildHeldItem(core, item) {
  if (item === 'guitar') {
    const g = new THREE.Group();
    const body = sph(0.22, '#c9822e', 0, 0, 0); body.scale.set(1, 1.25, 0.35); g.add(body);
    g.add(box(0.07, 0.7, 0.05, '#7a4a26', 0, 0.5, 0), box(0.12, 0.16, 0.06, '#5d3820', 0, 0.9, 0));
    g.position.set(0.05, 0.28, 0.24); g.rotation.set(0.1, 0, -0.5);
    core.add(g);
  } else if (item === 'violin') {
    const g = new THREE.Group();
    const body = sph(0.13, '#8a3d1a', 0, 0, 0); body.scale.set(1, 1.5, 0.4); g.add(body);
    g.add(box(0.05, 0.42, 0.04, '#3a2412', 0, 0.28, 0));
    g.position.set(-0.05, 0.62, 0.2); g.rotation.set(0, 0.3, 1.4);
    core.add(g);
    const bow = box(0.02, 0.5, 0.02, '#e8d8b0', 0.34, 0.5, 0.16); bow.rotation.z = 0.5; core.add(bow);
  } else if (item === 'keytar') {
    const g = group(box(0.7, 0.08, 0.2, '#18181d', 0, 0, 0), box(0.6, 0.03, 0.14, '#f4f4f4', 0, 0.05, 0.02));
    g.position.set(0.1, 0.2, 0.26); g.rotation.set(0.15, 0, -0.25);
    core.add(g);
  } else if (item === 'mic') {
    const m = cyl(0.05, 0.05, 0.3, '#222', 0.34, 0.55, 0.28); m.rotation.z = -0.5;
    core.add(m, sph(0.06, '#888', 0.5, 0.68, 0.35));
  } else if (item === 'book') {
    core.add(box(0.3, 0.4, 0.05, '#f2ead8', 0.28, 0.25, 0.18));
  }
}

// ---------- 소품 빌더 ----------
const builders = {
  // === 인물 (모두 cfg로 꾸밀 수 있다) ===
  actor: (v = 0, cfg = null) => person(cfg || { shirt: SHIRTS[v % SHIRTS.length], hairStyle: v % 2 ? 'long' : 'short' }),
  child: (v = 0, cfg = null) => {
    const g = person(cfg || { shirt: '#ffcf4d', pants: '#55bb77', hairStyle: 'short' });
    g.scale.set(0.78, 0.78, 0.78); return g;
  },
  singer: (v = 0, cfg = null) => person(cfg || { shirt: '#c026d3', pants: '#1e1e28', hairStyle: 'long', outfit: 'stage', item: 'mic' }),
  dancer: (v = 0, cfg = null) => person(cfg || { shirt: '#ff4f8b', pants: '#ff4f8b', hairStyle: 'ponytail', outfit: 'dress' }),
  king: (v = 0, cfg = null) => person(cfg || { shirt: '#7c1fa0', pants: '#4a1266', hair: '#caa64a', hairStyle: 'short', outfit: 'royal', hat: 'crown', hatColor: '#ffd54a' }),
  narrator: (v = 0, cfg = null) => person(cfg || { shirt: '#2c3e63', pants: '#1a2540', hairStyle: 'short', outfit: 'jacket', item: 'book' }),
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
  // 책장 — 앞이 열린 선반 구조 (책이 실제로 보이도록 수정)
  bookshelf: () => {
    const g = new THREE.Group();
    const frame = '#6b4423';
    g.add(box(1.0, 0.08, 0.4, frame, 0, 0.04, 0));   // 바닥
    g.add(box(1.0, 0.08, 0.4, frame, 0, 1.76, 0));   // 천장
    g.add(box(0.08, 1.8, 0.4, frame, -0.46, 0.9, 0)); // 왼쪽
    g.add(box(0.08, 1.8, 0.4, frame, 0.46, 0.9, 0));  // 오른쪽
    g.add(box(1.0, 0.06, 0.4, frame, 0, 0.9, 0));     // 중간 선반
    g.add(box(0.92, 1.8, 0.06, '#5d3820', 0, 0.9, -0.17)); // 뒷판
    const cols = ['#c0563e', '#4a7fd4', '#48a860', '#ecc94b', '#8e5bc9'];
    for (const shelfY of [0.5, 1.3]) for (let i = 0; i < 5; i++) g.add(box(0.13, 0.36, 0.28, cols[i % 5], -0.36 + i * 0.18, shelfY, 0.03));
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
    const body = sph(0.34, '#c9822e', 0, 0.7, 0); body.scale.set(1, 1.25, 0.32); g.add(body);
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
  rope: () => group(cyl(0.06, 0.08, 0.8, '#caa64a', -0.6, 0.4, 0, 10), cyl(0.06, 0.08, 0.8, '#caa64a', 0.6, 0.4, 0, 10), box(1.2, 0.05, 0.05, '#c0261a', 0, 0.72, 0)),
  curtain_stand: () => group(cyl(0.05, 0.05, 2.2, '#caa64a', -0.9, 1.1, 0, 8), cyl(0.05, 0.05, 2.2, '#caa64a', 0.9, 1.1, 0, 8), box(1.9, 0.08, 0.08, '#caa64a', 0, 2.2, 0), box(1.7, 1.9, 0.06, '#8f1f2d', 0, 1.2, 0, { side: THREE.DoubleSide })),

  // === 물건 ===
  crate: () => { const g = box(0.7, 0.7, 0.7, '#9a6a3a', 0, 0.35, 0); const f = new THREE.Group(); f.add(g); for (const s of [0.36, -0.36]) { f.add(box(0.72, 0.1, 0.05, '#6b4423', 0, 0.5, s), box(0.72, 0.1, 0.05, '#6b4423', 0, 0.2, s)); } return f; },
  chest: () => { const g = group(box(0.8, 0.5, 0.5, '#8a5a30', 0, 0.25, 0)); const lid = box(0.82, 0.3, 0.52, '#6b4423', 0, 0.6, -0.02); lid.rotation.x = -0.3; g.add(lid, box(0.1, 0.15, 0.05, '#ffd54a', 0, 0.4, 0.26)); return g; },
  lantern: () => group(cyl(0.03, 0.03, 0.2, '#333', 0, 1.0, 0), box(0.22, 0.3, 0.22, '#caa64a', 0, 0.75, 0, { emissive: '#ffcf4a', emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }), box(0.26, 0.06, 0.26, '#5d3820', 0, 0.92, 0), box(0.26, 0.06, 0.26, '#5d3820', 0, 0.58, 0)),
  candle: () => group(cyl(0.14, 0.16, 0.08, '#caa64a', 0, 0.04, 0), cyl(0.07, 0.08, 0.35, '#f0e8d8', 0, 0.25, 0), cone(0.05, 0.14, '#ffb02e', 0, 0.5, 0, 8, { emissive: '#ff9500', emissiveIntensity: 0.9 })),
  sign: () => group(cyl(0.05, 0.05, 1.2, '#6b4423', 0, 0.6, 0, 8), box(0.9, 0.5, 0.08, '#9a6a3a', 0, 1.15, 0), box(0.8, 0.4, 0.02, '#f2ead8', 0, 1.15, 0.05)),
  flag: () => { const g = group(cyl(0.04, 0.04, 2.2, '#8a5a30', 0, 1.1, 0, 8)); const f = box(0.9, 0.55, 0.03, '#c0261a', 0.47, 1.9, 0, { side: THREE.DoubleSide }); g.add(f); return g; },
  gift: () => group(box(0.6, 0.6, 0.6, '#d94077', 0, 0.3, 0), box(0.64, 0.64, 0.12, '#ffd54a', 0, 0.3, 0), box(0.12, 0.64, 0.64, '#ffd54a', 0, 0.3, 0), sph(0.12, '#ffd54a', 0, 0.64, 0)),
  // 괘종시계 — 시계 판이 정면(+Z)을 바라보도록 수정
  clock: () => {
    const g = new THREE.Group();
    g.add(box(0.44, 1.5, 0.34, '#5d3820', 0, 0.75, 0));   // 몸통
    g.add(box(0.5, 0.16, 0.4, '#6b4423', 0, 1.5, 0));     // 머리 장식
    const face = cyl(0.28, 0.28, 0.04, '#f2ead8', 0, 1.15, 0.18, 20); face.rotation.x = Math.PI / 2; g.add(face); // 정면을 보는 시계판
    const ring = cyl(0.32, 0.32, 0.05, '#caa64a', 0, 1.15, 0.16, 20); ring.rotation.x = Math.PI / 2; g.add(ring); // 테두리
    g.add(box(0.02, 0.18, 0.02, '#222', 0, 1.2, 0.21));   // 분침
    g.add(box(0.02, 0.12, 0.02, '#222', 0.06, 1.13, 0.21)); // 시침
    g.add(sph(0.05, '#c9a23a', 0, 0.55, 0.19, { emissive: '#c9a23a', emissiveIntensity: 0.2 })); // 추
    return g;
  },
  easel: () => { const g = group(box(0.9, 1.1, 0.04, '#f2ead8', 0, 1.0, 0)); for (const [x, rz] of [[-0.35, 0.2], [0.35, -0.2]]) { const l = cyl(0.03, 0.03, 1.6, '#8a5a30', x, 0.8, 0.1); l.rotation.z = rz; g.add(l); } g.add(box(0.6, 0.4, 0.02, '#8ac6e0', 0, 1.05, 0.03)); return g; },
  torch: () => group(cyl(0.05, 0.06, 0.9, '#5d3820', 0, 0.45, 0, 8), sph(0.12, '#ff7b1a', 0, 0.95, 0, { emissive: '#ff5a00', emissiveIntensity: 1 }), cone(0.1, 0.25, '#ffd54a', 0, 1.12, 0, 8, { emissive: '#ff9500', emissiveIntensity: 0.9 })),
};

// 안전 처리 소품 (mushroom/barrel/ball)
builders.mushroom = () => group(cyl(0.12, 0.14, 0.4, '#f0e8d8', 0, 0.2, 0), sph(0.3, '#d94040', 0, 0.44, 0, { flatShading: true }));
builders.barrel = () => group(cyl(0.32, 0.28, 0.8, '#8a5a30', 0, 0.4, 0, 14), cyl(0.34, 0.34, 0.06, '#5d3820', 0, 0.6, 0, 14), cyl(0.34, 0.34, 0.06, '#5d3820', 0, 0.2, 0, 14));
builders.ball = (v = 0) => group(sph(0.3, SHIRTS[v % SHIRTS.length], 0, 0.3, 0));

// 인물(골격이 있는) 소품인지 판별
const PEOPLE_TYPES = new Set(['actor', 'child', 'singer', 'dancer', 'king', 'narrator']);
export function isPerson(typeId) { return PEOPLE_TYPES.has(typeId); }

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
