// ============================================================
// My Stage 🎭 — 어린이·청소년을 위한 3D 무대 디자인 앱
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBlockTypes } from './blocks.js';
import { PROP_TYPES, buildProp } from './props.js';
import { EDU_TABS } from './education.js';

// ---------------- 상수 ----------------
const WORLD = { minX: -30, maxX: 30, minY: 0, maxY: 16, minZ: -26, maxZ: 30 };
const SAVE_KEY = 'mystage-save-v1';
const MAX_LIGHTS = 12;
const MAX_SHADOW_LIGHTS = 4;

const GEL_COLORS = ['#fff2cc', '#ffffff', '#ff5a4e', '#ff9d3b', '#ffe14d', '#5ad06a', '#4aa3ff', '#b06aff'];

const LIGHT_TYPES = {
  spot:   { emoji: '🔦', name: '스포트라이트', desc: '무대 위에서 한 곳을 콕! 집어 비춰요',
            color: '#fff2cc', intensity: 5, angle: 22 },
  follow: { emoji: '🎯', name: '팔로우 스팟', desc: '객석 뒤에서 주인공을 따라가며 비춰요',
            color: '#ffffff', intensity: 6, angle: 14 },
  wash:   { emoji: '🌊', name: '워시 조명', desc: '무대를 넓고 부드럽게 적시듯 비춰요',
            color: '#cfe0ff', intensity: 3.5, angle: 50 },
  floor:  { emoji: '🕯️', name: '플로어 라이트', desc: '바닥에서 위로! 신비한 그림자를 만들어요',
            color: '#4aa3ff', intensity: 4, angle: 35 },
  moving: { emoji: '🌀', name: '무빙 라이트', desc: '빙글빙글 돌며 색이 변하는 콘서트 조명',
            color: '#ff5ad0', intensity: 4.5, angle: 18 },
};

// ---------------- 상태 ----------------
const state = {
  mode: 'view',
  blockType: 'wood',
  blockShape: 'cube',
  lightType: 'spot',
  propType: 'actor',
  propRot: 0,
  propVariant: 0,
  preset: null,
  perform: false,
  zones: false,
  seats: true,
  house: 0.7,
  selectedLight: null,
  retargeting: false,
  dirty: false,
};

const blocks = new Map();   // "x,y,z" -> { type, shape, mesh }
const lights = [];          // { id, type, color, intensity, angle, on, pos, target, group, spot, cone, lens }
const props = [];           // { id, type, rot, variant, pos, group }
const undoStack = [];
let lightSeq = 1, propSeq = 1;

// ---------------- 렌더러 & 씬 ----------------
const canvas = document.getElementById('stage3d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 2, 0.1, 300);
camera.position.set(0, 12, 26);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 3;
controls.maxDistance = 90;
controls.target.set(0, 2, -6);

// ---------------- 하우스 조명 ----------------
const ambient = new THREE.AmbientLight(0xffffff, 0.35);
const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x33291f, 0.55);
const sun = new THREE.DirectionalLight(0xfff1d8, 1.5);
sun.position.set(14, 24, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -32; sun.shadow.camera.right = 32;
sun.shadow.camera.top = 32; sun.shadow.camera.bottom = -32;
sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0004;
scene.add(ambient, hemi, sun, sun.target);

const HOUSE_BASE = { ambient: 0.35, hemi: 0.55, sun: 1.5 };
let envLightCfg = { bg: 0x17181d, hemiSky: 0xbfd4ff, sunColor: 0xfff1d8 };

function applyHouseLights() {
  const h = state.house;
  const perf = state.perform ? 0.1 : 1;
  ambient.intensity = HOUSE_BASE.ambient * h * perf + 0.03;
  hemi.intensity = HOUSE_BASE.hemi * h * perf + 0.02;
  sun.intensity = HOUSE_BASE.sun * h * perf;
  const bg = new THREE.Color(envLightCfg.bg);
  if (state.perform) bg.multiplyScalar(0.16);
  scene.background = bg;
}

// ---------------- 그룹 ----------------
const envGroup = new THREE.Group();      // 프리셋 배경 (벽, 커튼, 아치…)
const blockGroup = new THREE.Group();    // 사용자 블록
const propGroup = new THREE.Group();     // 소품
const lightGroup = new THREE.Group();    // 조명 기구
const seatGroup = new THREE.Group();     // 객석
scene.add(envGroup, blockGroup, propGroup, lightGroup, seatGroup);

// 바닥 레이캐스트용 투명 평면
const groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
);
groundPlane.rotation.x = -Math.PI / 2;
groundPlane.userData.kind = 'ground';
scene.add(groundPlane);

// ---------------- 블록 시스템 ----------------
const { types: BLOCKS, order: BLOCK_ORDER } = createBlockTypes();
const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
const slabGeo = new THREE.BoxGeometry(1, 0.5, 1);
slabGeo.translate(0, -0.25, 0);

const keyOf = (x, y, z) => `${x},${y},${z}`;

function inBounds(x, y, z) {
  return x >= WORLD.minX && x < WORLD.maxX && y >= WORLD.minY && y < WORLD.maxY && z >= WORLD.minZ && z < WORLD.maxZ;
}

function addBlock(x, y, z, type, shape = 'cube', record = false) {
  if (!inBounds(x, y, z) || blocks.has(keyOf(x, y, z)) || !BLOCKS[type]) return false;
  const mesh = new THREE.Mesh(shape === 'slab' ? slabGeo : cubeGeo, BLOCKS[type].mat);
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { kind: 'block', x, y, z };
  blockGroup.add(mesh);
  blocks.set(keyOf(x, y, z), { type, shape, mesh });
  if (record) pushUndo({ undo: () => removeBlock(x, y, z, false) });
  return true;
}

function removeBlock(x, y, z, record = false) {
  const k = keyOf(x, y, z);
  const b = blocks.get(k);
  if (!b) return false;
  blockGroup.remove(b.mesh);
  blocks.delete(k);
  if (record) pushUndo({ undo: () => addBlock(x, y, z, b.type, b.shape, false) });
  return true;
}

function clearWorld() {
  for (const b of blocks.values()) blockGroup.remove(b.mesh);
  blocks.clear();
  for (const l of [...lights]) deleteLight(l, false);
  for (const p of [...props]) deleteProp(p, false);
  envGroup.clear();
  seatGroup.clear();
  undoStack.length = 0;
  hideLightPanel();
}

// ---------------- 배경(환경) 도우미 ----------------
const envMat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...opts });

function envBox(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), envMat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  envGroup.add(m);
  return m;
}

// 물결치는 커튼 — 사인 곡선으로 주름을 만든다
function makeCurtain(width, height, color) {
  const geo = new THREE.PlaneGeometry(width, height, Math.max(8, Math.round(width * 6)), 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, Math.sin(pos.getX(i) * 2.6) * 0.22);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeRoom(size, height, color) {
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(size, height, size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.96, side: THREE.BackSide })
  );
  room.position.y = height / 2 - 0.05;
  room.receiveShadow = true;
  envGroup.add(room);
}

function makeFloor(color, texture = null) {
  const params = { color, roughness: 0.95 };
  if (texture) { params.map = texture; params.color = 0xffffff; }
  const f = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial(params));
  f.rotation.x = -Math.PI / 2;
  f.position.y = -0.01;
  f.receiveShadow = true;
  envGroup.add(f);
}

function makeBatten(x1, x2, y, z) {
  const len = Math.abs(x2 - x1);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8), envMat('#111318', { metalness: 0.5 }));
  bar.rotation.z = Math.PI / 2;
  bar.position.set((x1 + x2) / 2, y, z);
  envGroup.add(bar);
}

// 객석 의자 (인스턴스 메시)
function buildSeats(list) {
  seatGroup.clear();
  if (!list.length) return;
  const seatG = new THREE.BoxGeometry(0.75, 0.14, 0.7);
  seatG.translate(0, 0.42, 0);
  const backG = new THREE.BoxGeometry(0.75, 0.62, 0.12);
  backG.translate(0, 0.75, 0.3);
  const legG = new THREE.BoxGeometry(0.6, 0.36, 0.55);
  legG.translate(0, 0.18, 0);
  const merged = mergeGeometries([seatG, backG, legG]);
  const inst = new THREE.InstancedMesh(merged, envMat('#7e2432', { roughness: 0.8 }), list.length);
  const dummy = new THREE.Object3D();
  list.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.rot, 0);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  seatGroup.add(inst);
}

// ---------------- 무대 프리셋 ----------------
function platform(x0, x1, z0, z1, topType = 'wood', baseType = 'darkwood', h = 2) {
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++)
      for (let y = 0; y < h; y++)
        addBlock(x, y, z, y === h - 1 ? topType : baseType);
}

const PRESETS = {
  proscenium: {
    name: '프로시니엄 무대', emoji: '🎭',
    desc: '액자 틀 너머로 보는 가장 익숙한 극장',
    stageBounds: { x0: -10, x1: 11, z0: -14, z1: -1, y: 2 },
    stageCenter: new THREE.Vector3(0.5, 2, -7),
    env: { bg: 0x141519, hemiSky: 0xbfd4ff },
    build(envOnly) {
      makeRoom(72, 20, '#1b1c22');
      makeFloor('#2a2b31');
      // 사이클로라마
      const cyc = new THREE.Mesh(new THREE.PlaneGeometry(23, 9.5), envMat('#d8e8f8', { roughness: 1 }));
      cyc.position.set(0.5, 6.7, -15.4);
      cyc.receiveShadow = true;
      envGroup.add(cyc);
      // 프로시니엄 아치
      envBox(2.2, 10, 1.4, '#54202b', -11.6, 7, -1.5);
      envBox(2.2, 10, 1.4, '#54202b', 12.6, 7, -1.5);
      envBox(26.5, 2.6, 1.4, '#54202b', 0.5, 10.9, -1.5);
      envBox(26.5, 0.25, 1.5, '#c9a23a', 0.5, 9.65, -1.5); // 금색 장식
      // 메인 커튼 (양옆으로 걷힌 모습) + 밸런스
      const cl = makeCurtain(4.2, 7.4, '#8f1f2d'); cl.position.set(-8.4, 5.9, -2.1); envGroup.add(cl);
      const cr = makeCurtain(4.2, 7.4, '#8f1f2d'); cr.position.set(9.4, 5.9, -2.1); envGroup.add(cr);
      const val = makeCurtain(22, 1.7, '#7c1a27'); val.position.set(0.5, 8.9, -2.1); envGroup.add(val);
      // 옆막(레그)
      for (const z of [-5.5, -9.5, -13]) {
        const l1 = makeCurtain(2.6, 7.2, '#20222a'); l1.position.set(-9.6, 5.8, z); l1.rotation.y = Math.PI / 2.4; envGroup.add(l1);
        const l2 = makeCurtain(2.6, 7.2, '#20222a'); l2.position.set(10.6, 5.8, z); l2.rotation.y = -Math.PI / 2.4; envGroup.add(l2);
      }
      // 배튼 + 객석 앞 트러스
      for (const z of [-4, -8, -12]) makeBatten(-11, 12, 10.3, z);
      makeBatten(-12, 13, 11.5, 7);
      if (envOnly) return;
      platform(-10, 10, -14, -2, 'wood', 'darkwood');
      // 에이프런 계단
      for (const x of [-2, -1, 1, 2, 0]) { addBlock(x, 0, -1, 'darkwood'); addBlock(x, 1, -1, 'wood', 'slab'); }
    },
    seats() {
      const list = [];
      for (let row = 0; row < 8; row++)
        for (let x = -9; x <= 9; x += 1.5) {
          if (Math.abs(x) < 1) continue; // 가운데 통로
          list.push({ x: x + 0.5, y: 0, z: 3.5 + row * 1.8, rot: Math.PI });
        }
      return list;
    },
  },

  thrust: {
    name: '돌출 무대', emoji: '📐',
    desc: '객석 속으로 쑥! 관객이 3면을 둘러싸요',
    stageBounds: { x0: -6, x1: 7, z0: -14, z1: 7, y: 2 },
    stageCenter: new THREE.Vector3(0.5, 2, -2),
    env: { bg: 0x15161b, hemiSky: 0xbfd4ff },
    build(envOnly) {
      makeRoom(66, 18, '#1b1c22');
      makeFloor('#2a2b31');
      const cyc = new THREE.Mesh(new THREE.PlaneGeometry(18, 8.5), envMat('#d8e8f8'));
      cyc.position.set(0.5, 6.2, -15.4);
      cyc.receiveShadow = true;
      envGroup.add(cyc);
      const cl = makeCurtain(3.6, 6.8, '#24437c'); cl.position.set(-6.8, 5.4, -14.6); envGroup.add(cl);
      const cr = makeCurtain(3.6, 6.8, '#24437c'); cr.position.set(7.8, 5.4, -14.6); envGroup.add(cr);
      for (const z of [-10, -4, 2]) makeBatten(-10, 11, 9.5, z);
      makeBatten(-10, 11, 9.5, 6);
      if (envOnly) return;
      platform(-9, 9, -14, -7, 'wood', 'darkwood');   // 본 무대
      platform(-5, 6, -7, 6, 'wood', 'darkwood');     // 돌출부
    },
    seats() {
      const list = [];
      for (let row = 0; row < 4; row++) {
        const off = 7.5 + row * 1.8;
        for (let z = -6; z <= 6; z += 1.6) { // 좌우
          list.push({ x: -off + 0.5, y: 0, z, rot: Math.PI / 2 });
          list.push({ x: off + 0.5, y: 0, z, rot: -Math.PI / 2 });
        }
        for (let x = -6; x <= 6; x += 1.6) { // 정면
          if (Math.abs(x) < 0.8) continue;
          list.push({ x: x + 0.5, y: 0, z: 8.5 + row * 1.8, rot: Math.PI });
        }
      }
      return list;
    },
  },

  arena: {
    name: '원형 무대', emoji: '⭕',
    desc: '360도 관객이 둘러싸는 무대',
    stageBounds: { x0: -7, x1: 8, z0: -11, z1: 4, y: 1 },
    stageCenter: new THREE.Vector3(0.5, 1, -3.5),
    env: { bg: 0x141419, hemiSky: 0xcfd8ff },
    build(envOnly) {
      makeRoom(64, 17, '#191a20');
      makeFloor('#26272d');
      // 십자 배튼 + 원형 트러스 느낌
      makeBatten(-10, 11, 10, -3.5);
      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 21, 8), envMat('#111318', { metalness: 0.5 }));
      b2.rotation.x = Math.PI / 2;
      b2.position.set(0.5, 10, -3.5);
      envGroup.add(b2);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 0.09, 8, 40), envMat('#111318', { metalness: 0.5 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0.5, 9.2, -3.5);
      envGroup.add(ring);
      if (envOnly) return;
      // 원형 플랫폼 (반지름 7)
      for (let x = -8; x <= 9; x++)
        for (let z = -12; z <= 5; z++) {
          const dx = x + 0.5 - 0.5, dz = z + 0.5 - (-3.5);
          if (Math.hypot(dx, dz) <= 7.2) addBlock(x, 0, z, 'wood');
        }
    },
    seats() {
      const list = [];
      const cx = 0.5, cz = -3.5;
      for (let ring = 0; ring < 3; ring++) {
        const r = 10 + ring * 1.9;
        const n = Math.round(r * 3.4);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          list.push({ x: cx + Math.cos(a) * r, y: 0, z: cz + Math.sin(a) * r, rot: -a - Math.PI / 2 });
        }
      }
      return list;
    },
  },

  blackbox: {
    name: '블랙박스', emoji: '⬛',
    desc: '텅 빈 검은 방 — 상상력이 곧 무대!',
    stageBounds: { x0: -8, x1: 9, z0: -10, z1: 3, y: 0 },
    stageCenter: new THREE.Vector3(0.5, 0, -3.5),
    env: { bg: 0x0d0d10, hemiSky: 0x9aa4c0 },
    build(envOnly) {
      makeRoom(44, 13, '#101014');
      makeFloor('#1a1a1e');
      // 천장 조명 그리드
      for (const z of [-10, -5, 0, 5]) makeBatten(-12, 13, 8.6, z);
      for (const x of [-9, -3, 3, 9]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 20, 8), envMat('#111318', { metalness: 0.5 }));
        b.rotation.x = Math.PI / 2;
        b.position.set(x + 0.5, 8.6, -2.5);
        envGroup.add(b);
      }
      if (envOnly) return;
      addPropRaw('chair', -3.5, 0, 4.5, Math.PI, 1);
      addPropRaw('chair', -1.5, 0, 4.8, Math.PI, 2);
      addPropRaw('chair', 0.8, 0, 4.6, Math.PI, 3);
      addPropRaw('chair', 2.8, 0, 4.9, Math.PI, 4);
    },
    seats: () => [],
  },

  outdoor: {
    name: '야외 무대', emoji: '🌳',
    desc: '하늘이 천장! 축제와 공연의 야외무대',
    stageBounds: { x0: -8, x1: 9, z0: -12, z1: -1, y: 2 },
    stageCenter: new THREE.Vector3(0.5, 2, -6.5),
    env: { bg: 0x87b8e8, hemiSky: 0xbfe0ff },
    build(envOnly) {
      // 잔디 바닥
      const grassTex = BLOCKS.grass.mat.map.clone();
      grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
      grassTex.repeat.set(60, 60);
      grassTex.needsUpdate = true;
      makeFloor('#4f9e3f', grassTex);
      // 무대 지붕 구조물
      for (const [x, z] of [[-9, -13], [10, -13], [-9, 0], [10, 0]])
        envBox(0.5, 8.5, 0.5, '#6b4a2b', x + 0.5, 4.25, z + 0.5);
      const roof = envBox(22, 0.5, 16, '#8a5a30', 0.5, 8.8, -6);
      roof.rotation.x = 0.06;
      const back = makeCurtain(19, 6.4, '#f2ead8');
      back.position.set(0.5, 5.1, -12.6);
      envGroup.add(back);
      makeBatten(-8, 9, 8.2, -3);
      makeBatten(-8, 9, 8.2, -9);
      // 둘레 나무
      for (const [x, z] of [[-18, -8], [-15, 8], [17, -10], [19, 6], [-20, 16], [21, 18], [12, 20], [-11, 22]])
        addPropRaw('tree', x, 0, z, Math.random() * 6.28, 0);
      if (envOnly) return;
      platform(-8, 9, -12, -1, 'wood', 'darkwood');
      for (const x of [-1, 0, 1, 2]) { addBlock(x, 0, 0, 'darkwood'); addBlock(x, 1, 0, 'wood', 'slab'); }
    },
    seats() {
      const list = [];
      for (let row = 0; row < 6; row++)
        for (let x = -8; x <= 8; x += 1.7) {
          if (Math.abs(x) < 0.9) continue;
          list.push({ x: x + 0.5, y: 0, z: 3 + row * 2, rot: Math.PI });
        }
      return list;
    },
  },
};

function applyPreset(id, envOnly = false) {
  clearWorld();
  const p = PRESETS[id];
  state.preset = id;
  envLightCfg = { ...envLightCfg, ...p.env };
  hemi.color.set(p.env.hemiSky);
  p.build(envOnly);
  buildSeats(p.seats());
  seatGroup.visible = state.seats;
  buildZoneOverlay();
  applyHouseLights();
  document.getElementById('stageSelect').value = id;
  state.dirty = false;
}

// ---------------- 무대 구역 오버레이 ----------------
let zoneMesh = null;
function buildZoneOverlay() {
  if (zoneMesh) { scene.remove(zoneMesh); zoneMesh = null; }
  const b = PRESETS[state.preset]?.stageBounds;
  if (!b) return;
  const w = b.x1 - b.x0, d = b.z1 - b.z0;
  const c = document.createElement('canvas');
  const S = 64;
  c.width = w * S; c.height = d * S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(20,22,30,0.35)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(255,213,74,0.9)';
  ctx.lineWidth = 4;
  const cw = c.width / 3, ch = c.height / 3;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(cw * i, 0); ctx.lineTo(cw * i, c.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ch * i); ctx.lineTo(c.width, ch * i); ctx.stroke();
  }
  ctx.strokeRect(2, 2, c.width - 4, c.height - 4);
  // 캔버스 위쪽 = 업스테이지(-Z), 캔버스 오른쪽 = 상수(+X)
  const rows = [['업 하수', '업 센터', '업 상수'], ['중앙 하수', '★ 무대 중앙', '중앙 상수'], ['다운 하수', '다운 센터', '다운 상수']];
  ctx.fillStyle = '#ffe89a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${S * 0.42}px sans-serif`;
  for (let r = 0; r < 3; r++)
    for (let col = 0; col < 3; col++)
      ctx.fillText(rows[r][col], cw * col + cw / 2, ch * r + ch / 2);
  ctx.font = `bold ${S * 0.34}px sans-serif`;
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText('▲ 업스테이지 (무대 뒤쪽)', c.width / 2, S * 0.35);
  ctx.fillText('▼ 다운스테이지 (객석 쪽)', c.width / 2, c.height - S * 0.35);
  ctx.save();
  ctx.translate(S * 0.35, c.height / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('하수 (객석에서 왼쪽)', 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(c.width - S * 0.35, c.height / 2); ctx.rotate(Math.PI / 2);
  ctx.fillText('상수 (객석에서 오른쪽)', 0, 0);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  zoneMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  zoneMesh.rotation.x = -Math.PI / 2;
  zoneMesh.position.set((b.x0 + b.x1) / 2, b.y + 0.03, (b.z0 + b.z1) / 2);
  zoneMesh.visible = state.zones;
  zoneMesh.renderOrder = 5;
  scene.add(zoneMesh);
}

// ---------------- 조명 기구 ----------------
const fixtureBodyGeo = new THREE.CylinderGeometry(0.16, 0.24, 0.55, 10);
fixtureBodyGeo.rotateX(Math.PI / 2); // +Z가 렌즈 방향

function shadowLightCount() {
  return lights.filter(l => l.spot.castShadow).length;
}

function createLight(data, record = true) {
  if (lights.length >= MAX_LIGHTS) { toast(`조명은 ${MAX_LIGHTS}개까지 달 수 있어요!`); return null; }
  const def = LIGHT_TYPES[data.type];
  const L = {
    id: data.id ?? lightSeq++,
    type: data.type,
    color: data.color ?? def.color,
    intensity: data.intensity ?? def.intensity,
    angle: data.angle ?? def.angle,
    on: data.on ?? true,
    pos: new THREE.Vector3().fromArray(data.pos),
    target: new THREE.Vector3().fromArray(data.target),
    phase: Math.random() * Math.PI * 2,
  };
  lightSeq = Math.max(lightSeq, L.id + 1);

  const group = new THREE.Group();
  group.position.copy(L.pos);
  // 본체
  const body = new THREE.Mesh(fixtureBodyGeo, new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.5, metalness: 0.4 }));
  body.castShadow = true;
  // 렌즈 (빛 색으로 빛남)
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 10),
    new THREE.MeshBasicMaterial({ color: L.color })
  );
  lens.position.z = 0.29;
  body.add(lens);
  // 걸이(클램프)
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.07), new THREE.MeshStandardMaterial({ color: 0x111318, metalness: 0.5 }));
  clamp.position.y = 0.4;
  group.add(body, clamp);
  group.traverse(o => { o.userData = { kind: 'fixture', lightId: L.id }; });

  // 실제 광원 — decay 0: 거리 감쇠 없이 무대 조명처럼 또렷한 빛 풀을 만든다
  const spot = new THREE.SpotLight(L.color, L.intensity, 60, THREE.MathUtils.degToRad(L.angle), 0.35, 0);
  spot.position.set(0, 0, 0);
  if (shadowLightCount() < MAX_SHADOW_LIGHTS) {
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.002;
  }
  group.add(spot);
  const targetObj = new THREE.Object3D();
  scene.add(targetObj);
  targetObj.position.copy(L.target);
  spot.target = targetObj;

  // 빛줄기 콘
  const cone = new THREE.Mesh(
    makeConeGeo(L),
    new THREE.MeshBasicMaterial({
      color: L.color, transparent: true, opacity: 0.07,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  cone.userData = { kind: 'beam' };
  cone.raycast = () => {}; // 빛줄기는 클릭 무시
  group.add(cone);

  Object.assign(L, { group, body, lens, spot, cone, targetObj });
  lightGroup.add(group);
  lights.push(L);
  orientLight(L);
  updateLightVisual(L);
  if (record) pushUndo({ undo: () => deleteLight(L, false) });
  return L;
}

function makeConeGeo(L) {
  const len = Math.max(1, L.pos.distanceTo(L.target));
  const r = Math.tan(THREE.MathUtils.degToRad(L.angle)) * len;
  const geo = new THREE.ConeGeometry(r, len, 20, 1, true);
  geo.translate(0, -len / 2, 0); // 꼭짓점을 원점(조명 위치)으로
  return geo;
}

const _dir = new THREE.Vector3(), _down = new THREE.Vector3(0, -1, 0);
function orientLight(L) {
  L.group.position.copy(L.pos);
  L.targetObj.position.copy(L.target);
  _dir.subVectors(L.target, L.pos).normalize();
  L.body.lookAt(L.pos.clone().add(_dir)); // 본체 +Z를 타깃으로
  L.cone.quaternion.setFromUnitVectors(_down, _dir);
}

function updateLightVisual(L) {
  L.spot.color.set(L.color);
  L.spot.intensity = L.on ? L.intensity : 0;
  L.spot.angle = THREE.MathUtils.degToRad(L.angle);
  L.lens.material.color.set(L.color);
  L.cone.material.color.set(L.color);
  L.cone.geometry.dispose();
  L.cone.geometry = makeConeGeo(L);
  L.cone.visible = L.on;
  const base = state.perform ? 0.2 : 0.09;
  L.cone.material.opacity = base * Math.min(1, L.intensity / 5);
  orientLight(L);
}

function deleteLight(L, record = true) {
  const i = lights.indexOf(L);
  if (i < 0) return;
  lights.splice(i, 1);
  lightGroup.remove(L.group);
  scene.remove(L.targetObj);
  if (state.selectedLight === L) hideLightPanel();
  if (record) {
    const data = serializeLight(L);
    pushUndo({ undo: () => createLight(data, false) });
  }
}

function serializeLight(L) {
  return {
    id: L.id, type: L.type, color: L.color, intensity: L.intensity,
    angle: L.angle, on: L.on, pos: L.pos.toArray(), target: L.target.toArray(),
  };
}

// 클릭한 지점에 따라 조명 위치 결정
function placeLightAt(point) {
  const type = state.lightType;
  const center = PRESETS[state.preset]?.stageCenter ?? new THREE.Vector3(0, 2, -6);
  let pos, target = point.clone();
  if (type === 'follow') {
    pos = new THREE.Vector3(point.x > 0.5 ? 7 : -6, 9.5, 15);
  } else if (type === 'floor') {
    pos = point.clone().add(new THREE.Vector3(0, 0.15, 0));
    const toCenter = new THREE.Vector3().subVectors(center, point).setY(0);
    if (toCenter.lengthSq() < 0.5) toCenter.set(0, 0, -1);
    toCenter.normalize();
    target = pos.clone().add(toCenter.multiplyScalar(2.5)).add(new THREE.Vector3(0, 6, 0));
  } else {
    // spot / wash / moving — 배튼 높이에 매달기
    pos = new THREE.Vector3(point.x, 10.2, point.z + (type === 'wash' ? 3 : 1.2));
  }
  const L = createLight({ type, pos: pos.toArray(), target: target.toArray() });
  if (L) {
    toast(`${LIGHT_TYPES[type].emoji} ${LIGHT_TYPES[type].name}을(를) 달았어요!`);
    blip(660);
    selectLight(L);
    state.dirty = true;
  }
}

// ---------------- 소품 ----------------
function addPropRaw(type, x, y, z, rot = 0, variant = 0, record = false) {
  const P = {
    id: propSeq++, type, rot, variant,
    pos: new THREE.Vector3(x, y, z),
    group: buildProp(type, variant),
  };
  P.group.position.copy(P.pos);
  P.group.rotation.y = rot;
  P.group.traverse(o => { o.userData = { kind: 'prop', propId: P.id }; });
  propGroup.add(P.group);
  props.push(P);
  if (record) pushUndo({ undo: () => deleteProp(P, false) });
  return P;
}

function deleteProp(P, record = true) {
  const i = props.indexOf(P);
  if (i < 0) return;
  props.splice(i, 1);
  propGroup.remove(P.group);
  if (record) {
    const d = { type: P.type, x: P.pos.x, y: P.pos.y, z: P.pos.z, rot: P.rot, variant: P.variant };
    pushUndo({ undo: () => addPropRaw(d.type, d.x, d.y, d.z, d.rot, d.variant) });
  }
}

// ---------------- 되돌리기 ----------------
function pushUndo(op) {
  undoStack.push(op);
  if (undoStack.length > 100) undoStack.shift();
}
function undo() {
  const op = undoStack.pop();
  if (!op) { toast('되돌릴 것이 없어요'); return; }
  op.undo();
  blip(380);
}

// ---------------- 레이캐스팅 & 상호작용 ----------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function pick(ev, targets) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -((ev.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(targets, true)[0] ?? null;
}

function worldNormal(hit) {
  if (!hit.face) return new THREE.Vector3(0, 1, 0);
  return hit.face.normal.clone().transformDirection(hit.object.matrixWorld).round();
}

function cellFromHit(hit, into = false) {
  const n = worldNormal(hit);
  const p = hit.point.clone().addScaledVector(n, into ? -0.5 : 0.5);
  return { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
}

// 미리보기 고스트 블록
const ghost = new THREE.Mesh(
  cubeGeo,
  new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.35, depthWrite: false })
);
ghost.visible = false;
ghost.raycast = () => {};
scene.add(ghost);

// 소품 미리보기
let propGhost = null;
function refreshPropGhost() {
  if (propGhost) { scene.remove(propGhost); propGhost = null; }
  if (state.mode !== 'prop') return;
  propGhost = buildProp(state.propType, state.propVariant);
  propGhost.traverse(o => {
    if (o.isMesh) {
      o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => { m.transparent = true; m.opacity = 0.5; m.depthWrite = false; });
      o.castShadow = false;
    }
    o.raycast = () => {};
  });
  propGhost.visible = false;
  scene.add(propGhost);
}

function buildTargets() {
  const t = [...blockGroup.children, groundPlane];
  if (state.mode === 'light' || state.mode === 'view') t.push(...lightGroup.children);
  if (state.mode === 'prop') t.push(...propGroup.children);
  return t;
}

function snapHalf(v) { return Math.round(v * 2) / 2; }

function onHover(ev) {
  ghost.visible = false;
  if (propGhost) propGhost.visible = false;
  if (state.mode === 'block') {
    const hit = pick(ev, [...blockGroup.children, groundPlane]);
    if (!hit) return;
    const c = cellFromHit(hit);
    if (!inBounds(c.x, c.y, c.z) || blocks.has(keyOf(c.x, c.y, c.z))) return;
    ghost.geometry = state.blockShape === 'slab' ? slabGeo : cubeGeo;
    ghost.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5);
    ghost.visible = true;
  } else if (state.mode === 'prop' && propGhost) {
    const hit = pick(ev, [...blockGroup.children, groundPlane]);
    if (!hit) return;
    propGhost.position.set(snapHalf(hit.point.x), snapHalf(hit.point.y), snapHalf(hit.point.z));
    propGhost.rotation.y = state.propRot;
    propGhost.visible = true;
  }
}

function onLeftClick(ev) {
  // 다시 겨누기 모드
  if (state.retargeting && state.selectedLight) {
    const hit = pick(ev, [...blockGroup.children, groundPlane]);
    if (hit) {
      state.selectedLight.target.copy(hit.point);
      updateLightVisual(state.selectedLight);
      state.retargeting = false;
      toast('🎯 조명이 새 위치를 비춰요!');
      updateHint();
      state.dirty = true;
    }
    return;
  }

  if (state.mode === 'block') {
    const hit = pick(ev, [...blockGroup.children, groundPlane]);
    if (!hit) return;
    const c = cellFromHit(hit);
    if (addBlock(c.x, c.y, c.z, state.blockType, state.blockShape, true)) {
      blip(540); state.dirty = true;
    }
  } else if (state.mode === 'light') {
    const hitFix = pick(ev, lightGroup.children);
    if (hitFix) {
      const L = lights.find(l => l.id === hitFix.object.userData.lightId);
      if (L) { selectLight(L); return; }
    }
    const hit = pick(ev, [...blockGroup.children, groundPlane]);
    if (hit) placeLightAt(hit.point);
  } else if (state.mode === 'prop') {
    const hit = pick(ev, [...blockGroup.children, groundPlane]);
    if (!hit) return;
    const P = addPropRaw(state.propType, snapHalf(hit.point.x), snapHalf(hit.point.y), snapHalf(hit.point.z), state.propRot, state.propVariant, true);
    if (P) {
      blip(540); state.dirty = true;
      if (state.propType === 'actor') state.propVariant = (state.propVariant + 1) % 7;
      refreshPropGhost();
    }
  } else if (state.mode === 'view') {
    const hitFix = pick(ev, lightGroup.children);
    if (hitFix) {
      const L = lights.find(l => l.id === hitFix.object.userData.lightId);
      if (L) selectLight(L);
    }
  }
}

function onRightClick(ev) {
  if (state.retargeting) { state.retargeting = false; updateHint(); return; }
  const hit = pick(ev, buildTargets());
  if (!hit) return;
  const ud = hit.object.userData;
  if (ud.kind === 'fixture') {
    const L = lights.find(l => l.id === ud.lightId);
    if (L) { deleteLight(L); toast('조명을 뗐어요'); blip(320); state.dirty = true; }
  } else if (ud.kind === 'prop') {
    const P = props.find(p => p.id === ud.propId);
    if (P) { deleteProp(P); blip(320); state.dirty = true; }
  } else if (ud.kind === 'block' && state.mode !== 'view') {
    const c = cellFromHit(hit, true);
    if (removeBlock(c.x, c.y, c.z, true)) { blip(320); state.dirty = true; }
  }
}

// 클릭 vs 드래그 구분
let downInfo = null;
canvas.addEventListener('pointerdown', ev => {
  downInfo = { x: ev.clientX, y: ev.clientY, button: ev.button, shift: ev.shiftKey };
});
canvas.addEventListener('pointerup', ev => {
  if (!downInfo) return;
  const moved = Math.hypot(ev.clientX - downInfo.x, ev.clientY - downInfo.y);
  const info = downInfo;
  downInfo = null;
  if (moved > 6) return; // 드래그 = 카메라 조작
  if (info.button === 0 && !info.shift) onLeftClick(ev);
  else if (info.button === 2 || (info.button === 0 && info.shift)) onRightClick(ev);
});
canvas.addEventListener('pointermove', onHover);
canvas.addEventListener('contextmenu', ev => ev.preventDefault());

// ---------------- 조명 설정 패널 ----------------
const lp = {
  panel: document.getElementById('lightPanel'),
  title: document.getElementById('lpTitle'),
  power: document.getElementById('lpPower'),
  colors: document.getElementById('lpColors'),
  custom: document.getElementById('lpCustomColor'),
  intensity: document.getElementById('lpIntensity'),
  intVal: document.getElementById('lpIntVal'),
  angle: document.getElementById('lpAngle'),
  angVal: document.getElementById('lpAngVal'),
};

GEL_COLORS.forEach(c => {
  const b = document.createElement('button');
  b.className = 'gel';
  b.style.background = c;
  b.title = c;
  b.addEventListener('click', () => {
    if (!state.selectedLight) return;
    state.selectedLight.color = c;
    updateLightVisual(state.selectedLight);
    refreshGelActive();
    state.dirty = true;
  });
  lp.colors.appendChild(b);
});

function refreshGelActive() {
  const cur = state.selectedLight?.color;
  [...lp.colors.children].forEach((b, i) => b.classList.toggle('active', GEL_COLORS[i] === cur));
}

function selectLight(L) {
  if (state.selectedLight) setFixtureHighlight(state.selectedLight, false);
  state.selectedLight = L;
  setFixtureHighlight(L, true);
  const def = LIGHT_TYPES[L.type];
  lp.title.textContent = `${def.emoji} ${def.name}`;
  lp.power.textContent = L.on ? '켜짐' : '꺼짐';
  lp.power.classList.toggle('active', L.on);
  lp.intensity.value = L.intensity;
  lp.intVal.textContent = L.intensity;
  lp.angle.value = L.angle;
  lp.angVal.textContent = `${L.angle}°`;
  lp.custom.value = L.color;
  refreshGelActive();
  lp.panel.classList.remove('hidden');
  blip(760);
}

function setFixtureHighlight(L, on) {
  L.body.material.emissive = new THREE.Color(on ? 0xffd54a : 0x000000);
  L.body.material.emissiveIntensity = on ? 0.6 : 0;
}

function hideLightPanel() {
  if (state.selectedLight) setFixtureHighlight(state.selectedLight, false);
  state.selectedLight = null;
  state.retargeting = false;
  lp.panel.classList.add('hidden');
}

document.getElementById('lpClose').addEventListener('click', hideLightPanel);
lp.power.addEventListener('click', () => {
  const L = state.selectedLight;
  if (!L) return;
  L.on = !L.on;
  lp.power.textContent = L.on ? '켜짐' : '꺼짐';
  lp.power.classList.toggle('active', L.on);
  updateLightVisual(L);
  state.dirty = true;
});
lp.custom.addEventListener('input', () => {
  const L = state.selectedLight;
  if (!L) return;
  L.color = lp.custom.value;
  updateLightVisual(L);
  refreshGelActive();
  state.dirty = true;
});
lp.intensity.addEventListener('input', () => {
  const L = state.selectedLight;
  if (!L) return;
  L.intensity = +lp.intensity.value;
  lp.intVal.textContent = L.intensity;
  updateLightVisual(L);
  state.dirty = true;
});
lp.angle.addEventListener('input', () => {
  const L = state.selectedLight;
  if (!L) return;
  L.angle = +lp.angle.value;
  lp.angVal.textContent = `${L.angle}°`;
  updateLightVisual(L);
  state.dirty = true;
});
document.getElementById('lpAim').addEventListener('click', () => {
  if (!state.selectedLight) return;
  state.retargeting = true;
  setHint('🎯 조명이 비출 곳을 클릭하세요! (오른쪽 클릭으로 취소)');
});
document.getElementById('lpDelete').addEventListener('click', () => {
  if (!state.selectedLight) return;
  deleteLight(state.selectedLight);
  toast('조명을 뗐어요');
  state.dirty = true;
});

// ---------------- UI: 팔레트 ----------------
function buildBlockPalette() {
  const grid = document.getElementById('blockGrid');
  BLOCK_ORDER.forEach(id => {
    const b = document.createElement('button');
    b.className = 'swatch' + (id === state.blockType ? ' active' : '');
    b.title = BLOCKS[id].name;
    const img = document.createElement('img');
    img.src = BLOCKS[id].thumb;
    img.alt = BLOCKS[id].name;
    b.appendChild(img);
    b.addEventListener('click', () => {
      state.blockType = id;
      grid.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      b.classList.add('active');
      setHint(`🧱 ${BLOCKS[id].name} — 클릭해서 놓고, 오른쪽 클릭으로 부숴요`);
    });
    grid.appendChild(b);
  });
}

function buildLightPalette() {
  const grid = document.getElementById('lightGrid');
  Object.entries(LIGHT_TYPES).forEach(([id, def]) => {
    const b = document.createElement('button');
    b.className = 'pcard' + (id === state.lightType ? ' active' : '');
    b.innerHTML = `<span class="ic">${def.emoji}</span><span><div class="nm">${def.name}</div><div class="ds">${def.desc}</div></span>`;
    b.addEventListener('click', () => {
      state.lightType = id;
      grid.querySelectorAll('.pcard').forEach(c => c.classList.remove('active'));
      b.classList.add('active');
      setHint(`${def.emoji} ${def.name} — 비추고 싶은 곳을 클릭하세요`);
    });
    grid.appendChild(b);
  });
}

function buildPropPalette() {
  const grid = document.getElementById('propGrid');
  PROP_TYPES.forEach(def => {
    const b = document.createElement('button');
    b.className = 'pcard' + (def.id === state.propType ? ' active' : '');
    b.innerHTML = `<span class="ic">${def.emoji}</span><span><div class="nm">${def.name}</div><div class="ds">${def.desc}</div></span>`;
    b.addEventListener('click', () => {
      state.propType = def.id;
      grid.querySelectorAll('.pcard').forEach(c => c.classList.remove('active'));
      b.classList.add('active');
      refreshPropGhost();
      setHint(`${def.emoji} ${def.name} — 클릭해서 놓아요 (R키로 방향 돌리기)`);
    });
    grid.appendChild(b);
  });
}

// 모드 전환
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  document.querySelectorAll('.pal-page').forEach(p => p.classList.toggle('hidden', p.dataset.mode !== mode));
  ghost.visible = false;
  refreshPropGhost();
  if (mode !== 'light' && mode !== 'view') hideLightPanel();
  updateHint();
}

const HINTS = {
  view: '👀 드래그로 둘러보고, 휠로 확대해요 · 조명을 클릭하면 설정이 열려요',
  block: '🧱 클릭 = 블록 놓기 · 오른쪽 클릭 = 부수기 · 드래그 = 시점 돌리기',
  light: '💡 무대를 클릭하면 조명이 달려요 · 조명 클릭 = 설정 · 오른쪽 클릭 = 떼기',
  prop: '🪑 클릭 = 소품 놓기 · R = 방향 돌리기 · 오른쪽 클릭 = 치우기',
};
function setHint(t) { document.getElementById('hintText').textContent = t; }
function updateHint() { setHint(HINTS[state.mode]); }

// 반블록 토글
document.querySelectorAll('.shape-btn').forEach(b => {
  b.addEventListener('click', () => {
    state.blockShape = b.dataset.shape;
    document.querySelectorAll('.shape-btn').forEach(s => s.classList.toggle('active', s === b));
  });
});

// ---------------- 상단 바 ----------------
document.getElementById('stageSelect').addEventListener('change', ev => {
  const id = ev.target.value;
  if (state.dirty && !confirm('무대 형태를 바꾸면 지금 만든 것이 사라져요.\n(📤 내보내기로 먼저 저장할 수 있어요)\n계속할까요?')) {
    ev.target.value = state.preset;
    return;
  }
  applyPreset(id);
  toast(`${PRESETS[id].emoji} ${PRESETS[id].name}로 바꿨어요!`);
});

document.getElementById('btnZones').addEventListener('click', function () {
  state.zones = !state.zones;
  this.classList.toggle('active', state.zones);
  if (zoneMesh) zoneMesh.visible = state.zones;
  if (state.zones) toast('📍 무대 구역 이름이 보여요 — 배움터에서 자세히!');
});

document.getElementById('btnSeats').addEventListener('click', function () {
  state.seats = !state.seats;
  this.classList.toggle('active', state.seats);
  seatGroup.visible = state.seats;
});

document.getElementById('btnPerform').addEventListener('click', function () {
  state.perform = !state.perform;
  this.classList.toggle('active', state.perform);
  applyHouseLights();
  lights.forEach(updateLightVisual);
  toast(state.perform ? '🌙 공연 모드 — 여러분의 조명이 무대를 밝혀요!' : '☀️ 작업 모드로 돌아왔어요');
});

document.getElementById('btnUndo').addEventListener('click', undo);

document.getElementById('houseSlider').addEventListener('input', ev => {
  state.house = ev.target.value / 100;
  applyHouseLights();
});

// 스크린샷
document.getElementById('btnShot').addEventListener('click', () => {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = `my-stage-${Date.now()}.png`;
  a.click();
  toast('📸 찰칵! 사진을 저장했어요');
});

// ---------------- 저장 / 불러오기 ----------------
function serialize() {
  return {
    v: 1,
    preset: state.preset,
    house: state.house,
    blocks: [...blocks.entries()].map(([k, b]) => {
      const [x, y, z] = k.split(',').map(Number);
      return [x, y, z, b.type, b.shape === 'slab' ? 1 : 0];
    }),
    lights: lights.map(serializeLight),
    props: props.map(p => ({ type: p.type, x: p.pos.x, y: p.pos.y, z: p.pos.z, rot: p.rot, variant: p.variant })),
  };
}

function restore(data) {
  if (!data || !PRESETS[data.preset]) return false;
  applyPreset(data.preset, true);
  for (const [x, y, z, type, slab] of data.blocks ?? [])
    addBlock(x, y, z, type, slab ? 'slab' : 'cube');
  for (const l of data.lights ?? []) createLight(l, false);
  for (const p of data.props ?? []) addPropRaw(p.type, p.x, p.y, p.z, p.rot, p.variant);
  state.house = data.house ?? 0.7;
  document.getElementById('houseSlider').value = state.house * 100;
  applyHouseLights();
  state.dirty = false;
  return true;
}

function saveLocal(silent = false) {
  if (!state.preset) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serialize()));
    if (!silent) toast('💾 저장했어요!');
  } catch {
    if (!silent) toast('저장 공간이 부족해요 😢 — 📤 내보내기를 이용해 보세요');
  }
}

document.getElementById('btnSave').addEventListener('click', () => saveLocal());

document.getElementById('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(serialize(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'my-stage.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('📤 파일로 내보냈어요 — 친구와 나눠 보세요!');
});

document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', ev => {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      if (restore(JSON.parse(reader.result))) toast('📥 작품을 불러왔어요!');
      else toast('파일을 읽을 수 없어요 😢');
    } catch {
      toast('파일을 읽을 수 없어요 😢');
    }
  };
  reader.readAsText(file);
  ev.target.value = '';
});

setInterval(() => { if (state.dirty) saveLocal(true); }, 20000);
window.addEventListener('beforeunload', () => { if (state.preset) saveLocal(true); });

// ---------------- 배움터 ----------------
const eduModal = document.getElementById('eduModal');
const eduTabs = document.getElementById('eduTabs');
const eduContent = document.getElementById('eduContent');
EDU_TABS.forEach((tab, i) => {
  const b = document.createElement('button');
  b.textContent = tab.title;
  b.addEventListener('click', () => {
    eduTabs.querySelectorAll('button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    eduContent.innerHTML = tab.html;
    eduContent.scrollTop = 0;
  });
  if (i === 0) { b.classList.add('active'); eduContent.innerHTML = tab.html; }
  eduTabs.appendChild(b);
});
document.getElementById('btnEdu').addEventListener('click', () => eduModal.classList.remove('hidden'));
document.getElementById('eduClose').addEventListener('click', () => eduModal.classList.add('hidden'));
eduModal.addEventListener('click', ev => { if (ev.target === eduModal) eduModal.classList.add('hidden'); });

// ---------------- 시작 화면 ----------------
const welcome = document.getElementById('welcomeModal');
const cards = document.getElementById('welcomeCards');
Object.entries(PRESETS).forEach(([id, p]) => {
  const b = document.createElement('button');
  b.className = 'scard';
  b.innerHTML = `<span class="em">${p.emoji}</span><span class="nm">${p.name}</span><span class="ds">${p.desc}</span>`;
  b.addEventListener('click', () => {
    applyPreset(id);
    welcome.classList.add('hidden');
    toast(`${p.emoji} ${p.name}에 온 걸 환영해요! 🧱 블록 탭에서 시작해 보세요`);
  });
  cards.appendChild(b);
});
try {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) {
    const btn = document.getElementById('btnContinue');
    btn.classList.remove('hidden');
    btn.addEventListener('click', () => {
      if (restore(JSON.parse(saved))) {
        welcome.classList.add('hidden');
        toast('지난 작품을 불러왔어요! 이어서 만들어 보세요 ✨');
      }
    });
  }
} catch { /* localStorage 사용 불가 환경 */ }

// ---------------- 카메라 시점 ----------------
const VIEWS = {
  audience: { pos: [0.5, 5, 20], tgt: [0.5, 3, -7] },
  stage:    { pos: [0.5, 3.6, -6], tgt: [0.5, 2.5, 18] },
  bird:     { pos: [0.5, 34, 10], tgt: [0.5, 0, -4] },
  booth:    { pos: [0.5, 11, 24], tgt: [0.5, 2, -7] },
};
let camTween = null;
document.querySelectorAll('.vbtn').forEach(b => {
  b.addEventListener('click', () => {
    const v = VIEWS[b.dataset.view];
    camTween = {
      t: 0,
      fromP: camera.position.clone(), toP: new THREE.Vector3(...v.pos),
      fromT: controls.target.clone(), toT: new THREE.Vector3(...v.tgt),
    };
  });
});

// ---------------- 키보드 ----------------
window.addEventListener('keydown', ev => {
  if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT') return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo(); return; }
  switch (ev.key) {
    case '1': setMode('view'); break;
    case '2': setMode('block'); break;
    case '3': setMode('light'); break;
    case '4': setMode('prop'); break;
    case 'r': case 'R':
      if (state.mode === 'prop') {
        state.propRot = (state.propRot + Math.PI / 2) % (Math.PI * 2);
        if (propGhost) propGhost.rotation.y = state.propRot;
      }
      break;
    case 'Escape': hideLightPanel(); break;
  }
});

// ---------------- 효과음 ----------------
let audioCtx = null;
function blip(freq) {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.045, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.13);
  } catch { /* 소리 미지원 */ }
}

// ---------------- 토스트 ----------------
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ---------------- 루프 ----------------
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  resize();
  const t = clock.getElapsedTime();

  // 무빙 라이트 애니메이션
  for (const L of lights) {
    if (L.type !== 'moving' || !L.on) continue;
    const r = 2.6;
    L.target.x = L.pos.x + Math.cos(t * 0.9 + L.phase) * r;
    L.target.z = L.pos.z - 3 + Math.sin(t * 0.9 + L.phase) * r;
    const hue = (t * 0.08 + L.phase / 6) % 1;
    const col = new THREE.Color().setHSL(hue, 0.85, 0.6);
    L.color = `#${col.getHexString()}`;
    L.spot.color.copy(col);
    L.lens.material.color.copy(col);
    L.cone.material.color.copy(col);
    orientLight(L);
  }

  // 카메라 이동 트윈
  if (camTween) {
    camTween.t = Math.min(1, camTween.t + 0.035);
    const e = 1 - Math.pow(1 - camTween.t, 3);
    camera.position.lerpVectors(camTween.fromP, camTween.toP, e);
    controls.target.lerpVectors(camTween.fromT, camTween.toT, e);
    if (camTween.t >= 1) camTween = null;
  }

  controls.update();
  renderer.render(scene, camera);
}

// ---------------- 시작 ----------------
buildBlockPalette();
buildLightPalette();
buildPropPalette();
updateHint();
applyPreset('proscenium'); // 시작 화면 뒤에 미리 보여줄 기본 무대
applyHouseLights();
resize();
animate();
