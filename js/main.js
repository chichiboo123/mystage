// ============================================================
// My Stage 🌟 — 어린이·청소년을 위한 3D 무대 디자인 앱
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBlockTypes } from './blocks.js';
import { PROP_CATEGORIES, PROP_INFO, buildProp, isPerson } from './props.js';
import { randomActorCfg, defaultCfgFor, normalizeCfg, buildCustomizerUI } from './character-customizer.js';
import { POSES, applyPose, DEFAULT_POSE } from './character-animation.js';
import { createCameraRig } from './camera-controls.js';
import { EDU_TABS } from './education.js';
import { LIGHT_PRESETS } from './lighting-presets.js';

// ---------------- 상수 ----------------
const WORLD = { minX: -30, maxX: 30, minY: 0, maxY: 16, minZ: -26, maxZ: 30 };
const SAVE_KEY = 'mystage-save-v2';
const TUT_KEY = 'mystage-tutorial-v3';
const MAX_LIGHTS = 24;
const MAX_SHADOW_LIGHTS = 4;
const GEL_COLORS = ['#fff2cc', '#ffffff', '#ff5a4e', '#ff9d3b', '#ffe14d', '#5ad06a', '#4aa3ff', '#b06aff'];

const LIGHT_TYPES = {
  spot:   { emoji: '🔦', name: '스포트라이트', desc: '무대 위에서 한 곳을 콕! 집어 비춰요', color: '#fff2cc', intensity: 5, angle: 22 },
  follow: { emoji: '🎯', name: '팔로우 스팟', desc: '객석 뒤에서 주인공을 따라가며 비춰요', color: '#ffffff', intensity: 6, angle: 14 },
  wash:   { emoji: '🌊', name: '워시 조명', desc: '무대를 넓고 부드럽게 적시듯 비춰요', color: '#cfe0ff', intensity: 3.5, angle: 50 },
  floor:  { emoji: '🕯️', name: '플로어 라이트', desc: '바닥에서 위로! 신비한 그림자를 만들어요', color: '#4aa3ff', intensity: 4, angle: 35 },
  moving: { emoji: '🌀', name: '무빙 라이트', desc: '빙글빙글 돌며 색이 변하는 콘서트 조명', color: '#ff5ad0', intensity: 4.5, angle: 18 },
};

let uidSeq = 1;
const uid = () => uidSeq++;

// ---------------- 상태 ----------------
const state = {
  mode: 'view', blockType: 'wood', blockShape: 'cube',
  lightType: 'spot', lightMode: 'preset', activePreset: null,
  propCat: 'people', propType: 'actor', propRot: 0, propVariant: 0,
  actorCfg: defaultCfgFor('actor'), actorPose: DEFAULT_POSE,
  cameraLocked: false,
  activeImage: null,
  perform: false, zones: false, marks: false, markCenter: null, settingCenter: false, seats: true, house: 0.7,
  selected: null, retargeting: false, moveMode: false, dirty: false,
  boxSelect: false, multi: [], multiMove: false,
  cueMul: 1, cueTransition: null,
  baseErasable: false, // 켜면 기본 무대 바닥(base 블록)도 여느 블록처럼 지울 수 있다
};

const proj = { preset: 'proscenium', house: 0.7, active: 0, scenes: [], seatTransform: { x: 0, z: 0, rot: 0 }, arenaShape: 'circle' };

const blocks = new Map();
const lights = [];
const props = [];
const images = [];
let cues = [];
let cueSeq = 1;

const uploadedImages = new Map();
const undoStack = [];
let lightSeq = 1;

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
controls.minDistance = 4;
controls.maxDistance = 80;
controls.zoomToCursor = false;
controls.target.set(0, 2, -6);

// 카메라 잠금·확대/축소·화면 맞추기를 한 곳에서 관리
const camRig = createCameraRig(camera, controls);
const HOME_VIEW = { pos: [0.5, 11, 24], tgt: [0.5, 2, -7] };

// ---------------- 하우스 조명 ----------------
const ambientL = new THREE.AmbientLight(0xffffff, 0.35);
const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x33291f, 0.55);
const sun = new THREE.DirectionalLight(0xfff1d8, 1.5);
sun.position.set(14, 24, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -32; sun.shadow.camera.right = 32;
sun.shadow.camera.top = 32; sun.shadow.camera.bottom = -32;
sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0004;
scene.add(ambientL, hemi, sun, sun.target);

const HOUSE_BASE = { ambient: 0.35, hemi: 0.55, sun: 1.5 };
let envLightCfg = { bg: 0x17181d, hemiSky: 0xbfd4ff };

function applyHouseLights() {
  const h = state.house;
  const perf = state.perform ? 0.1 : 1;
  // 슬라이더 상단(0.6 이상)에서 부스트가 서서히 켜져, 최댓값에서는 완전히 불 켜진 것처럼 밝아진다.
  // 낮은·중간 밝기는 기존과 거의 동일하게 유지.
  const t = Math.max(0, (h - 0.6) / 0.4); // 0.6→0, 1.0→1
  const boost = t * t * perf;
  ambientL.intensity = HOUSE_BASE.ambient * h * perf + 0.03 + 0.55 * boost;
  hemi.intensity = HOUSE_BASE.hemi * h * perf + 0.02 + 0.65 * boost;
  sun.intensity = HOUSE_BASE.sun * h * perf + 1.5 * boost;
  const bg = new THREE.Color(envLightCfg.bg);
  if (state.perform) bg.multiplyScalar(0.16);
  else if (boost > 0) bg.lerp(new THREE.Color(0x2a2d36), boost * 0.6); // 최대에서 배경도 살짝 밝게
  scene.background = bg;
  if (scene.fog) scene.fog.color.copy(bg);
}

// ---------------- 그룹 ----------------
const envGroup = new THREE.Group();
const blockGroup = new THREE.Group();
const propGroup = new THREE.Group();
const lightGroup = new THREE.Group();
const imageGroup = new THREE.Group();
const seatGroup = new THREE.Group();
scene.add(envGroup, blockGroup, propGroup, lightGroup, imageGroup, seatGroup);
let envAnims = []; // 환경 애니메이션 (물결, 반딧불이, 행성 회전…)

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
const inBounds = (x, y, z) => x >= WORLD.minX && x < WORLD.maxX && y >= WORLD.minY && y < WORLD.maxY && z >= WORLD.minZ && z < WORLD.maxZ;

// layingBase=true 동안 놓이는 블록은 "무대 기본 바닥"(base)으로 표시된다.
// 무대 종류를 바꾸면 base 블록만 새 무대 것으로 교체하고, 사용자가 추가한 블록은 남긴다.
let layingBase = false;
function addBlock(x, y, z, type, shape = 'cube', record = false, base = layingBase) {
  if (!inBounds(x, y, z) || blocks.has(keyOf(x, y, z)) || !BLOCKS[type]) return false;
  const mesh = new THREE.Mesh(shape === 'slab' ? slabGeo : cubeGeo, BLOCKS[type].mat);
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData = { kind: 'block', x, y, z };
  blockGroup.add(mesh);
  blocks.set(keyOf(x, y, z), { type, shape, mesh, base });
  if (record) pushUndo({ undo: () => removeBlock(x, y, z, false) });
  return true;
}
function removeBlock(x, y, z, record = false) {
  const k = keyOf(x, y, z);
  const b = blocks.get(k);
  if (!b) return false;
  blockGroup.remove(b.mesh);
  blocks.delete(k);
  if (state.selected?.kind === 'block' && state.selected.ref.x === x && state.selected.ref.y === y && state.selected.ref.z === z) clearSelection();
  if (record) pushUndo({ undo: () => addBlock(x, y, z, b.type, b.shape, false, b.base) });
  return true;
}
// 무대 기본 바닥(base) 블록만 모두 제거 (사용자 블록은 유지)
function removeBaseBlocks() {
  for (const [k, b] of [...blocks]) if (b.base) { const [x, y, z] = k.split(',').map(Number); removeBlock(x, y, z); }
}
// 기본 무대 바닥 잠금: 옵션이 꺼져 있으면 base 블록은 사용자가 지울 수 없다
function baseLocked(x, y, z) {
  if (state.baseErasable) return false;
  const b = blocks.get(keyOf(x, y, z));
  return !!(b && b.base);
}
const BASE_LOCK_MSG = '🔒 기본 무대는 잠겨 있어요 — "보기 › 화면 옵션 › 기본 무대도 지우기"를 켜면 지울 수 있어요';

// ---------------- 환경(무대 배경) 헬퍼 ----------------
const envMat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...opts });
function envBox(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), envMat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; envGroup.add(m); return m;
}
function makeCurtain(width, height, color) {
  const geo = new THREE.PlaneGeometry(width, height, Math.max(8, Math.round(width * 6)), 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 2.6) * 0.22);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = true; return m;
}
function makeRoom(size, height, color) {
  const room = new THREE.Mesh(new THREE.BoxGeometry(size, height, size), new THREE.MeshStandardMaterial({ color, roughness: 0.96, side: THREE.BackSide }));
  room.position.y = height / 2 - 0.05; room.receiveShadow = true; envGroup.add(room);
}
function makeFloor(color, texture = null) {
  const params = texture ? { color: 0xffffff, roughness: 0.95, map: texture } : { color, roughness: 0.95 };
  const f = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial(params));
  f.rotation.x = -Math.PI / 2; f.position.y = -0.01; f.receiveShadow = true; envGroup.add(f); return f;
}
function makeBatten(x1, x2, y, z) {
  const len = Math.abs(x2 - x1);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8), envMat('#111318', { metalness: 0.5 }));
  bar.rotation.z = Math.PI / 2; bar.position.set((x1 + x2) / 2, y, z); envGroup.add(bar);
}
function makePalm(x, z) {
  const g = new THREE.Group();
  const leanX = 0.12; // 줄기가 살짝 기운 정도(위로 갈수록 +X)
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.12 - i * 0.015, 0.15 - i * 0.015, 0.8, 8), envMat('#8a6a3a'));
    seg.position.set(i * leanX, 0.4 + i * 0.75, 0); seg.rotation.z = -0.1; g.add(seg);
  }
  // 잎: 줄기 꼭대기를 중심으로 방사형으로 뻗고 아래로 살짝 처짐
  const crown = new THREE.Vector3(4 * leanX, 3.35, 0);
  const frondGeo = new THREE.BoxGeometry(1.7, 0.05, 0.38);
  frondGeo.translate(0.85, 0, 0); // 안쪽 끝이 프론드 그룹의 원점에 오도록
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const frond = new THREE.Group();
    frond.position.copy(crown);
    frond.rotation.y = a;          // 방사 방향
    frond.rotation.z = -0.32;      // 바깥으로 갈수록 아래로 처짐
    const leaf = new THREE.Mesh(frondGeo, envMat(i % 2 ? '#357f42' : '#2f7d3a'));
    frond.add(leaf);
    g.add(frond);
  }
  // 열매(코코넛)
  for (const dx of [-0.12, 0.12, 0]) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), envMat('#6b4a2b')).translateX(crown.x + dx).translateY(crown.y - 0.25).translateZ(dx * 1.4));
  g.position.set(x, 0, z);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  envGroup.add(g);
}
function makeStars() {
  const n = 1100;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 70 + Math.random() * 40;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) + 2;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true }));
  envGroup.add(stars);
}
// 반딧불이 (숲)
function makeFireflies() {
  const n = 28;
  const base = new Float32Array(n * 3), pos = new Float32Array(n * 3), phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    base[i * 3] = -14 + Math.random() * 30;
    base[i * 3 + 1] = 1.5 + Math.random() * 4;
    base[i * 3 + 2] = -16 + Math.random() * 32;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd8ff9a, size: 0.22, sizeAttenuation: true, transparent: true, opacity: 0.9 }));
  envGroup.add(pts);
  envAnims.push(t => {
    for (let i = 0; i < n; i++) {
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.5 + phase[i]) * 1.2;
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.9 + phase[i] * 2) * 0.5;
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.4 + phase[i]) * 1.2;
    }
    geo.attributes.position.needsUpdate = true;
    pts.material.opacity = 0.55 + 0.4 * Math.sin(t * 2);
  });
}
let seatBase = [], seatCentroid = new THREE.Vector3();
let seatMat = null;
function setSeatBase(list) {
  seatBase = list;
  seatCentroid.set(0, 0, 0);
  if (list.length) { for (const s of list) seatCentroid.add(new THREE.Vector3(s.x, 0, s.z)); seatCentroid.multiplyScalar(1 / list.length); }
  rebuildSeats();
}
// 객석은 proj.seatTransform(중심 기준 회전 + 이동)을 적용해 통째로 옮길 수 있다
function rebuildSeats() {
  seatGroup.clear();
  if (!seatBase.length) { seatGroup.userData = {}; return; }
  const seatG = new THREE.BoxGeometry(0.75, 0.14, 0.7); seatG.translate(0, 0.42, 0);
  const backG = new THREE.BoxGeometry(0.75, 0.62, 0.12); backG.translate(0, 0.75, -0.3);
  const legG = new THREE.BoxGeometry(0.6, 0.36, 0.55); legG.translate(0, 0.18, 0);
  const merged = mergeGeometries([seatG, backG, legG]);
  seatMat = envMat('#7e2432', { roughness: 0.8 });
  const inst = new THREE.InstancedMesh(merged, seatMat, seatBase.length);
  const tr = proj.seatTransform || { x: 0, z: 0, rot: 0 };
  const cosr = Math.cos(tr.rot), sinr = Math.sin(tr.rot);
  const dummy = new THREE.Object3D();
  seatBase.forEach((s, i) => {
    const rx = s.x - seatCentroid.x, rz = s.z - seatCentroid.z;
    const nx = seatCentroid.x + (rx * cosr - rz * sinr) + tr.x;
    const nz = seatCentroid.z + (rx * sinr + rz * cosr) + tr.z;
    dummy.position.set(nx, s.y, nz); dummy.rotation.set(0, s.rot + tr.rot, 0); dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  });
  inst.castShadow = true; inst.receiveShadow = true;
  inst.userData = { kind: 'seats' };
  seatGroup.add(inst);
  seatGroup.userData.inst = inst;
}
function buildSeats(list) { setSeatBase(list); }
function seatHL(on) { if (seatMat) { seatMat.emissive = new THREE.Color(on ? 0x3b6bff : 0x000000); seatMat.emissiveIntensity = on ? 0.5 : 0; } }
function platform(x0, x1, z0, z1, topType = 'wood', baseType = 'darkwood', h = 2) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = 0; y < h; y++)
    addBlock(x, y, z, y === h - 1 ? topType : baseType);
}
// 사방 객석 무대 바닥 모양 (원/사각형/마름모)
function arenaShapeTest(shape, r) {
  if (shape === 'square') return (dx, dz) => Math.abs(dx) <= r && Math.abs(dz) <= r;
  if (shape === 'diamond') return (dx, dz) => Math.abs(dx) + Math.abs(dz) <= r + 0.5;
  return (dx, dz) => Math.hypot(dx, dz) <= r + 0.2; // circle (기본)
}
// 무대 중심(cx)을 기준으로 좌우 대칭인 정면 객석 (가운데 통로)
function frontalSeats(cx, z0, { rows = 6, cols = 6, gap = 1.5, rowGap = 1.9 } = {}) {
  const list = [];
  for (let row = 0; row < rows; row++)
    for (let n = -cols; n <= cols; n++) {
      if (n === 0) continue;
      list.push({ x: cx + n * gap, y: 0, z: z0 + row * rowGap, rot: Math.PI });
    }
  return list;
}

// ---------------- 무대 프리셋 ----------------
// 야외 무대 — 숲/바다/우주 각각 고유한 무대 구조
function outdoorPreset(theme) {
  const cfg = {
    forest: { name: '야외 무대 · 숲속', emoji: '🌲', desc: '나무와 바위에 둘러싸인 숲속 공연장', env: { bg: 0x87b8e8, hemiSky: 0xbfe0ff, fog: [0x9cc4e4, 34, 120] }, bounds: { x0: -7, x1: 9, z0: -11, z1: -1, y: 2 } },
    sea:    { name: '야외 무대 · 바닷가', emoji: '🌊', desc: '파도와 수평선이 보이는 해변 축제무대', env: { bg: 0x8fd2ee, hemiSky: 0xd6f2ff, fog: [0xa8dcee, 45, 140] }, bounds: { x0: -8, x1: 10, z0: -12, z1: -1, y: 2 } },
    space:  { name: '야외 무대 · 우주', emoji: '🚀', desc: '달 표면 크레이터 위의 우주기지 무대', env: { bg: 0x070811, hemiSky: 0x5a6a9a }, bounds: { x0: -6, x1: 7, z0: -13, z1: 0, y: 2 } },
  }[theme];
  return {
    name: cfg.name, emoji: cfg.emoji, desc: cfg.desc,
    stageBounds: cfg.bounds, stageCenter: new THREE.Vector3(0.5, 2, (cfg.bounds.z0 + cfg.bounds.z1) / 2),
    gridY: 8.4, env: cfg.env, freeFront: false,
    build() {
      if (theme === 'forest') {
        const grassTex = BLOCKS.grass.mat.map.clone(); grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(60, 60); grassTex.needsUpdate = true;
        makeFloor('#4f9e3f', grassTex);
        // 무대를 감싸는 숲 (지붕·기둥 없이 자연 지형과 어우러진 빈터)
        for (let i = 0; i < 11; i++) {
          const a = -1.15 + (i / 10) * 2.3;
          const r = 13 + (i % 3) * 2.2;
          const t = buildProp(i % 4 === 0 ? 'pine' : 'tree');
          t.position.set(0.5 + Math.sin(a) * r, 0, -6 - Math.cos(a) * r);
          t.rotation.y = Math.random() * 6.28;
          const s = 1 + Math.random() * 0.7; t.scale.setScalar(s);
          envGroup.add(t);
        }
        for (const [x, z, s] of [[-9.5, -1.5, 1.2], [10.5, -3, 1], [-11, 4, 0.8], [12, 2, 0.9]]) {
          const rock = new THREE.Mesh(new THREE.SphereGeometry(0.9 * s, 8, 6), envMat('#8f9099', { flatShading: true }));
          rock.scale.set(1, 0.6, 0.85); rock.position.set(x, 0.3 * s, z); rock.castShadow = true; rock.receiveShadow = true; envGroup.add(rock);
        }
        // 먼 언덕
        for (const [x, z, r] of [[-24, -20, 10], [26, -24, 12], [0, -34, 16]]) {
          const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), envMat('#3e7a38'));
          hill.scale.set(1, 0.28, 1); hill.position.set(x, -0.4, z); hill.receiveShadow = true; envGroup.add(hill);
        }
        for (const [x, z] of [[-16, 8], [18, 10], [-20, 18], [21, 20], [12, 22], [-11, 24]]) {
          const t = buildProp('tree'); t.position.set(x, 0, z); t.rotation.y = Math.random() * 6.28; envGroup.add(t);
        }
        makeFireflies();
      } else if (theme === 'sea') {
        makeFloor('#ecd9a8'); // 모래사장
        const water = new THREE.Mesh(new THREE.PlaneGeometry(220, 60), new THREE.MeshStandardMaterial({ color: 0x1f7ab8, roughness: 0.22, metalness: 0.25 }));
        water.rotation.x = -Math.PI / 2; water.position.set(0, 0.02, -46); water.receiveShadow = true; envGroup.add(water);
        // 밀려오는 파도 거품
        const foams = [];
        for (let i = 0; i < 3; i++) {
          const foam = new THREE.Mesh(new THREE.PlaneGeometry(220, 1.4 - i * 0.3), new THREE.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, opacity: 0.65 - i * 0.15 }));
          foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.035, -16.5 - i * 3); envGroup.add(foam); foams.push(foam);
        }
        envAnims.push(t => { foams.forEach((f, i) => { f.position.z = -16.5 - i * 3 + Math.sin(t * 0.5 + i * 1.4) * 1.4; f.material.opacity = (0.5 - i * 0.12) + 0.2 * Math.sin(t * 0.5 + i); }); });
        // 축제 깃발 (양쪽 대나무 기둥 + 만국기)
        const poleL = envBox(0.22, 6.6, 0.22, '#d9c08a', -8.6, 3.3, -0.4);
        const poleR = envBox(0.22, 6.6, 0.22, '#d9c08a', 10.6, 3.3, -0.4);
        void poleL; void poleR;
        const flagCols = ['#ff5a4e', '#ffe14d', '#5ad06a', '#4aa3ff', '#b06aff', '#ff9d3b'];
        const flags = [];
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          const x = -8.6 + u * 19.2;
          const y = 6.4 - Math.sin(u * Math.PI) * 0.9;
          const f = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.5), new THREE.MeshStandardMaterial({ color: flagCols[i % 6], side: THREE.DoubleSide, roughness: 0.8 }));
          f.position.set(x, y - 0.3, -0.4); envGroup.add(f); flags.push(f);
        }
        envAnims.push(t => flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 2 + i) * 0.35; }));
        for (const [x, z] of [[-14, -8], [16, -6], [-18, 10], [19, 12], [-12, 20]]) makePalm(x, z);
        // 파라솔
        for (const [x, z, c] of [[13, 8, '#e85555'], [-13, 12, '#4aa3ff']]) {
          envGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), envMat('#eee')).translateX(x).translateY(1.2).translateZ(z));
          const top = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.6, 10), envMat(c, { side: THREE.DoubleSide }));
          top.position.set(x, 2.5, z); top.castShadow = true; envGroup.add(top);
        }
        const rock = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), envMat('#9a9a9a', { flatShading: true }));
        rock.scale.set(1, 0.55, 0.8); rock.position.set(15, 0.3, 18); rock.castShadow = true; envGroup.add(rock);
      } else {
        // 우주 — 달 표면 + 크레이터 + 우주기지 구조물
        makeFloor('#5a5d68');
        for (const [cx, cz, r] of [[-12, 10, 2.4], [15, 16, 3.2], [8, -20, 1.8], [-19, -14, 2.8], [-6, 22, 1.5], [20, -6, 2.2]]) {
          const crater = new THREE.Mesh(new THREE.CircleGeometry(r, 20), envMat('#43454f'));
          crater.rotation.x = -Math.PI / 2; crater.position.set(cx, 0.005, cz); crater.receiveShadow = true; envGroup.add(crater);
          const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 6, 22), envMat('#6a6d78'));
          rim.rotation.x = Math.PI / 2; rim.position.set(cx, 0.08, cz); envGroup.add(rim);
        }
        makeStars();
        const earth = new THREE.Mesh(new THREE.SphereGeometry(4.2, 24, 18), envMat('#3a7fd0', { emissive: 0x1a3f70, emissiveIntensity: 0.5, roughness: 0.6 }));
        earth.position.set(-26, 20, -42); envGroup.add(earth);
        const land = new THREE.Mesh(new THREE.SphereGeometry(4.24, 12, 9), envMat('#4fae5f', { transparent: true, opacity: 0.6, emissive: 0x2a6a35, emissiveIntensity: 0.4 }));
        land.position.copy(earth.position); envGroup.add(land);
        const saturn = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 14), envMat('#d8a860', { emissive: 0x6a4a20, emissiveIntensity: 0.4 }));
        saturn.position.set(24, 15, -36); envGroup.add(saturn);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.5, 6, 30), envMat('#e8cf9a', { emissive: 0x7a6030, emissiveIntensity: 0.35 }));
        ring.position.copy(saturn.position); ring.rotation.x = Math.PI / 2.4; ring.scale.z = 0.25; envGroup.add(ring);
        envAnims.push((t, dt) => { earth.rotation.y += dt * 0.06; land.rotation.y += dt * 0.06; saturn.rotation.y += dt * 0.1; });
        // 우주기지: 돔 거주구 + 모듈 + 안테나
        const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 1.1, 16), envMat('#8a929e', { metalness: 0.6, roughness: 0.35 }));
        domeBase.position.set(-13, 0.55, -17); domeBase.castShadow = true; envGroup.add(domeBase);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide }));
        dome.position.set(-13, 1.1, -17); envGroup.add(dome);
        const tube = envBox(4.5, 1.1, 1.2, '#8a929e', -9.2, 0.55, -16.4, { metalness: 0.6, roughness: 0.35 });
        tube.rotation.y = 0.2;
        const mod = envBox(3.2, 1.8, 2.2, '#9aa2ae', 14, 0.9, -16, { metalness: 0.6, roughness: 0.35 });
        void mod;
        for (const wx of [13, 14.6]) { const win = envBox(0.7, 0.5, 0.06, '#ffdf8a', wx, 1.1, -14.85, { emissive: 0xffc94a, emissiveIntensity: 0.8 }); void win; }
        envGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 5.5, 8), envMat('#b9c2cc', { metalness: 0.7 })).translateX(16.2).translateY(2.75).translateZ(-17));
        const dish = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), envMat('#d5dae2', { metalness: 0.5, side: THREE.DoubleSide }));
        dish.position.set(16.2, 5.6, -17); dish.rotation.x = -0.9; envGroup.add(dish);
        // 착륙장 링 표시
        const pad = new THREE.Mesh(new THREE.TorusGeometry(7.3, 0.14, 6, 40), envMat('#ffd54a', { emissive: 0x7a5f00, emissiveIntensity: 0.5 }));
        pad.rotation.x = Math.PI / 2; pad.position.set(0.5, 0.04, -6.5); envGroup.add(pad);
        makeBatten(-6, 8, 8.4, -12.5); makeBatten(-6, 8, 8.4, -0.8);
      }
    },
    starter() {
      if (theme === 'space') {
        // 원형 금속 착륙 패드 무대
        for (let x = -7; x <= 8; x++) for (let z = -14; z <= 1; z++) {
          const d = Math.hypot(x + 0.5 - 0.5, z + 0.5 - (-6.5));
          if (d <= 6.4) { addBlock(x, 0, z, 'stone'); addBlock(x, 1, z, 'metal'); }
        }
      } else if (theme === 'sea') {
        platform(-8, 9, -12, -1, 'wood', 'darkwood');
      } else {
        platform(-7, 8, -11, -2, 'wood', 'darkwood');
      }
    },
    seats() {
      // 무대 중심(x=0.5) 기준 좌우 대칭
      return frontalSeats(0.5, 3, { rows: 6, cols: 6, gap: 1.6, rowGap: 2 });
    },
  };
}

const PRESETS = {
  proscenium: {
    // 액자형: 아치·한쪽 객석·윙·막·배튼·배경막
    name: '프로시니엄 무대', emoji: '🏛️', desc: '액자 틀 너머로 보는 가장 익숙한 극장',
    stageBounds: { x0: -10, x1: 11, z0: -14, z1: -1, y: 2 }, stageCenter: new THREE.Vector3(0.5, 2, -7),
    gridY: 10.2, env: { bg: 0x141519, hemiSky: 0xbfd4ff },
    build() {
      makeRoom(72, 20, '#1b1c22'); makeFloor('#2a2b31');
      const cyc = new THREE.Mesh(new THREE.PlaneGeometry(23, 9.5), envMat('#d8e8f8', { roughness: 1 }));
      cyc.position.set(0.5, 6.7, -15.4); cyc.receiveShadow = true; envGroup.add(cyc);
      envBox(2.2, 10, 1.4, '#54202b', -11.6, 7, -1.5); envBox(2.2, 10, 1.4, '#54202b', 12.6, 7, -1.5);
      envBox(26.5, 2.6, 1.4, '#54202b', 0.5, 10.9, -1.5); envBox(26.5, 0.25, 1.5, '#c9a23a', 0.5, 9.65, -1.5);
      const cl = makeCurtain(4.2, 7.4, '#8f1f2d'); cl.position.set(-8.4, 5.9, -2.1); envGroup.add(cl);
      const cr = makeCurtain(4.2, 7.4, '#8f1f2d'); cr.position.set(9.4, 5.9, -2.1); envGroup.add(cr);
      const val = makeCurtain(22, 1.7, '#7c1a27'); val.position.set(0.5, 8.9, -2.1); envGroup.add(val);
      for (const z of [-5.5, -9.5, -13]) {
        const l1 = makeCurtain(2.6, 7.2, '#20222a'); l1.position.set(-9.6, 5.8, z); l1.rotation.y = Math.PI / 2.4; envGroup.add(l1);
        const l2 = makeCurtain(2.6, 7.2, '#20222a'); l2.position.set(10.6, 5.8, z); l2.rotation.y = -Math.PI / 2.4; envGroup.add(l2);
      }
      for (const z of [-4, -8, -12]) makeBatten(-11, 12, 10.3, z);
      makeBatten(-12, 13, 11.5, 7);
    },
    starter() {
      platform(-10, 10, -14, -2, 'wood', 'darkwood');
    },
    seats() {
      const list = [];
      for (let row = 0; row < 8; row++) for (let x = -9; x <= 9; x += 1.5) { if (Math.abs(x) < 1) continue; list.push({ x: x + 0.5, y: 0, z: 3.5 + row * 1.8, rot: Math.PI }); }
      return list;
    },
  },
  thrust: {
    // 3면 객석·낮은 배경: 시야를 가리는 높은 장치를 줄인다
    name: '돌출 무대', emoji: '📐', desc: '객석 속으로 쑥! 관객이 3면을 둘러싸요',
    stageBounds: { x0: -6, x1: 7, z0: -14, z1: 7, y: 2 }, stageCenter: new THREE.Vector3(0.5, 2, -2),
    gridY: 9.5, env: { bg: 0x15161b, hemiSky: 0xbfd4ff },
    build() {
      makeRoom(66, 18, '#1b1c22'); makeFloor('#2a2b31');
      // 낮은 배경벽 + 배우 등장용 출입구 두 곳
      envBox(6.5, 4.6, 0.8, '#262b3a', -4.9, 2.3, -15.2);
      envBox(6.5, 4.6, 0.8, '#262b3a', 5.9, 2.3, -15.2);
      envBox(3.2, 0.9, 0.8, '#262b3a', 0.5, 4.15, -15.2); // 출입구 위 상인방
      const l1 = makeCurtain(2.4, 4.2, '#24437c'); l1.position.set(-8.8, 2.9, -14.4); l1.rotation.y = Math.PI / 3; envGroup.add(l1);
      const l2 = makeCurtain(2.4, 4.2, '#24437c'); l2.position.set(9.8, 2.9, -14.4); l2.rotation.y = -Math.PI / 3; envGroup.add(l2);
      for (const z of [-10, -4, 2, 6]) makeBatten(-10, 11, 9.5, z);
    },
    starter() { platform(-9, 9, -14, -7, 'wood', 'darkwood'); platform(-6, 6, -7, 6, 'wood', 'darkwood'); },
    seats() {
      // 돌출부(x -5~6, 앞쪽 z=6)에서 넉넉히 떨어뜨려 관객 시야를 확보
      const list = []; const cx = 0.5;
      // 정면 객석 (돌출부 앞)
      for (let row = 0; row < 5; row++)
        for (let n = -6; n <= 6; n++) { if (n === 0) continue; list.push({ x: cx + n * 1.5, y: 0, z: 10.5 + row * 1.9, rot: Math.PI }); }
      // 좌우 객석 (돌출부 양옆)
      for (let row = 0; row < 4; row++) {
        const off = 10.5 + row * 1.8;
        for (let z = -6; z <= 8; z += 1.7) {
          list.push({ x: cx - off, y: 0, z, rot: Math.PI / 2 });
          list.push({ x: cx + off, y: 0, z, rot: -Math.PI / 2 });
        }
      }
      return list;
    },
  },
  arena: {
    // 사방(360도) 객석: 배경막 없음, 낮은 소품과 천장 조명 중심, 등장 통로(보메토리)
    name: '사방 객석 무대', emoji: '⭕', desc: '관객이 360도로 둘러싸요 (원형 플랫폼 예시)',
    stageBounds: { x0: -7, x1: 8, z0: -11, z1: 4, y: 1 }, stageCenter: new THREE.Vector3(0.5, 1, -3.5),
    gridY: 9.2, env: { bg: 0x141419, hemiSky: 0xcfd8ff }, freeFront: true,
    build() {
      makeRoom(64, 17, '#191a20'); makeFloor('#26272d');
      // 천장 조명 그리드: 십자 배튼 + 원형 트러스
      makeBatten(-10, 11, 10, -3.5);
      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 21, 8), envMat('#111318', { metalness: 0.5 })); b2.rotation.x = Math.PI / 2; b2.position.set(0.5, 10, -3.5); envGroup.add(b2);
      for (const r of [5.5, 8]) {
        const ringT = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 8, 40), envMat('#111318', { metalness: 0.5 }));
        ringT.rotation.x = Math.PI / 2; ringT.position.set(0.5, 9.2, -3.5); envGroup.add(ringT);
      }
    },
    starter() {
      const test = arenaShapeTest(proj.arenaShape, 7);
      for (let x = -8; x <= 9; x++) for (let z = -12; z <= 5; z++) { const dx = x + 0.5 - 0.5, dz = z + 0.5 - (-3.5); if (test(dx, dz)) addBlock(x, 0, z, 'wood'); }
    },
    seats() {
      // 네 방향 통로(보메토리)를 남기고 360도 배치
      const list = []; const cx = 0.5, cz = -3.5;
      for (let ring = 0; ring < 3; ring++) {
        const r = 10 + ring * 1.9; const n = Math.round(r * 3.4);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const m = a % (Math.PI / 2);
          if (m < 0.12 || m > Math.PI / 2 - 0.12) continue;
          list.push({ x: cx + Math.cos(a) * r, y: 0, z: cz + Math.sin(a) * r, rot: -a - Math.PI / 2 });
        }
      }
      return list;
    },
  },
  blackbox: {
    // 가변형 공연 공간: 빈 검은 방 + 조명 그리드 + 이동식 플랫폼·객석
    name: '블랙박스', emoji: '⬛', desc: '무대와 객석을 마음대로 배치하는 빈 공간',
    stageBounds: { x0: -8, x1: 9, z0: -10, z1: 3, y: 0 }, stageCenter: new THREE.Vector3(0.5, 0, -3.5),
    gridY: 8.6, env: { bg: 0x0d0d10, hemiSky: 0x9aa4c0 }, freeFront: true,
    build() {
      makeRoom(44, 13, '#101014'); makeFloor('#1a1a1e');
      for (const z of [-10, -5, 0, 5]) makeBatten(-12, 13, 8.6, z);
      for (const x of [-9, -3, 3, 9]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 20, 8), envMat('#111318', { metalness: 0.5 })); b.rotation.x = Math.PI / 2; b.position.set(x + 0.5, 8.6, -2.5); envGroup.add(b); }
    },
    starter() {
      // 블랙박스는 텅 빈 검은 공간에서 시작 — 무대·객석을 원하는 대로 직접 배치
    },
    seats: () => [],
  },
  outdoor_forest: outdoorPreset('forest'),
  outdoor_sea: outdoorPreset('sea'),
  outdoor_space: outdoorPreset('space'),
};

function stageFrame() {
  const p = PRESETS[proj.preset]; const b = p.stageBounds;
  return { cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, cy: b.y, w: b.x1 - b.x0, d: b.z1 - b.z0, gridY: p.gridY, backZ: b.z0, frontZ: b.z1, fohZ: b.z1 + 13 };
}
function buildEnvironment(id) {
  envGroup.clear(); seatGroup.clear(); envAnims = [];
  const p = PRESETS[id];
  envLightCfg = { ...envLightCfg, ...p.env };
  hemi.color.set(p.env.hemiSky);
  scene.fog = p.env.fog ? new THREE.Fog(p.env.fog[0], p.env.fog[1], p.env.fog[2]) : null;
  p.build();
  buildSeats(p.seats());
  seatGroup.visible = state.seats;
  buildZoneOverlay();
  buildMarks();
  applyHouseLights();
  ambient.set(id);
  updateArenaCard();
  document.getElementById('stageSelect').value = id;
}
function layStarter(id) { layingBase = true; PRESETS[id].starter(); layingBase = false; }

// ---------------- 간격 눈금 (야광 스파이크 테이프) ----------------
let marksGroup = null;
function makeNumberSprite(txt) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8ff3a'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, 32, 34);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  spr.scale.set(0.7, 0.7, 0.7); return spr;
}
function buildMarks() {
  if (marksGroup) { scene.remove(marksGroup); marksGroup = null; }
  const fr = stageFrame();
  marksGroup = new THREE.Group();
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xe6ff4a, emissive: 0xb9d400, emissiveIntensity: 0.9, roughness: 0.5 });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xff5a8a, emissive: 0xd0206a, emissiveIntensity: 0.9, roughness: 0.5 });
  // 사용자가 센터를 지정하면 그 지점에서, 아니면 무대 앞 가장자리 중앙에서 시작
  const mc = state.markCenter;
  const cxp = mc ? mc.x : fr.cx;
  const zEdge = mc ? mc.z : fr.frontZ - 0.35;
  const y = (mc ? mc.y : fr.cy) + 0.03;
  const half = Math.max(6, Math.floor(fr.w / 2) + 2);
  // 센터 십자 마크(분홍)
  marksGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.16), centerMat).translateX(cxp).translateY(y).translateZ(zEdge));
  marksGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.7), centerMat).translateX(cxp).translateY(y).translateZ(zEdge));
  for (let n = -half; n <= half; n++) {
    if (n === 0) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.16), tapeMat);
    m.position.set(cxp + n, y, zEdge);
    marksGroup.add(m);
    if (Math.abs(n) % 2 === 0) { const spr = makeNumberSprite(String(Math.abs(n))); spr.position.set(cxp + n, y + 0.5, zEdge); marksGroup.add(spr); }
  }
  marksGroup.visible = state.marks;
  scene.add(marksGroup);
}

// ---------------- 무대 구역 오버레이 (배우 기준 SR/SL) ----------------
let zoneMesh = null;
function buildZoneOverlay() {
  if (zoneMesh) { scene.remove(zoneMesh); zoneMesh = null; }
  const preset = PRESETS[proj.preset];
  const b = preset?.stageBounds; if (!b) return;
  const w = b.x1 - b.x0, d = b.z1 - b.z0;
  const c = document.createElement('canvas'); const S = 64; c.width = w * S; c.height = d * S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(20,22,30,0.35)'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(255,213,74,0.9)'; ctx.lineWidth = 4;
  const cw = c.width / 3, ch = c.height / 3;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cw * i, 0); ctx.lineTo(cw * i, c.height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, ch * i); ctx.lineTo(c.width, ch * i); ctx.stroke(); }
  ctx.strokeRect(2, 2, c.width - 4, c.height - 4);
  // 캔버스 위 = 윗무대(업스테이지), 왼쪽(-X) = 배우 기준 무대 오른쪽(SR) → 관객 화면에서 왼쪽에 보인다
  const rows = [
    [['윗무대 오른쪽', 'USR'], ['윗무대 중앙', 'USC'], ['윗무대 왼쪽', 'USL']],
    [['무대 오른쪽', 'SR'], ['★ 무대 중앙', 'CS'], ['무대 왼쪽', 'SL']],
    [['아랫무대 오른쪽', 'DSR'], ['아랫무대 중앙', 'DSC'], ['아랫무대 왼쪽', 'DSL']],
  ];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
    const [ko, en] = rows[r][col];
    const x = cw * col + cw / 2, y = ch * r + ch / 2;
    ctx.fillStyle = '#ffe89a'; ctx.font = `bold ${S * 0.36}px sans-serif`;
    ctx.fillText(ko, x, y - S * 0.22);
    ctx.fillStyle = '#ffd54a'; ctx.font = `bold ${S * 0.3}px sans-serif`;
    ctx.fillText(en, x, y + S * 0.24);
  }
  ctx.font = `bold ${S * 0.3}px sans-serif`; ctx.fillStyle = '#9fd8ff';
  ctx.fillText('▲ 윗무대 (업스테이지) — 무대 뒤쪽', c.width / 2, S * 0.32);
  ctx.fillText('▼ 아랫무대 (다운스테이지) — 객석 쪽', c.width / 2, c.height - S * (preset.freeFront ? 0.9 : 0.32));
  if (preset.freeFront) {
    ctx.font = `${S * 0.24}px sans-serif`; ctx.fillStyle = '#ffe0a0';
    ctx.fillText('※ 이 무대는 정면이 정해져 있지 않아요 — 아래쪽을 이 앱의 기준 정면(객석)으로 표시했어요', c.width / 2, c.height - S * 0.35);
  }
  ctx.save(); ctx.translate(S * 0.32, c.height / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = '#9fd8ff'; ctx.font = `bold ${S * 0.28}px sans-serif`;
  ctx.fillText('무대 오른쪽 SR (배우 기준)', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(c.width - S * 0.32, c.height / 2); ctx.rotate(Math.PI / 2); ctx.fillStyle = '#9fd8ff'; ctx.font = `bold ${S * 0.28}px sans-serif`;
  ctx.fillText('무대 왼쪽 SL (배우 기준)', 0, 0); ctx.restore();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  zoneMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  zoneMesh.rotation.x = -Math.PI / 2; zoneMesh.position.set((b.x0 + b.x1) / 2, b.y + 0.03, (b.z0 + b.z1) / 2);
  zoneMesh.visible = state.zones; zoneMesh.renderOrder = 5; scene.add(zoneMesh);
}

// ---------------- 환경 소리 (BGM) ----------------
const AMBIENT_SRC = { outdoor_forest: 'audio/forest.mp3', outdoor_sea: 'audio/ocean.mp3', outdoor_space: 'audio/space.mp3' };
const ambient = {
  el: new Audio(), key: null, vol: 0.5, muted: false, pending: false,
  set(id) {
    const key = AMBIENT_SRC[id] ? id : null;
    if (key === this.key) { this.syncUI(); return; } // 같은 환경/장면 전환 → 음악 이어서
    this.key = key;
    if (!key) { this.el.pause(); this.syncUI(); return; }
    this.el.src = AMBIENT_SRC[key];
    this.el.loop = true;
    this.el.volume = this.muted ? 0 : this.vol;
    this.tryPlay();
    this.syncUI();
  },
  tryPlay() {
    if (!this.key) return;
    this.el.play().then(() => { this.pending = false; }).catch(() => { this.pending = true; });
  },
  setVol(v) { this.vol = v; this.el.volume = this.muted ? 0 : v; },
  setMuted(m) { this.muted = m; this.el.volume = m ? 0 : this.vol; if (!m && this.pending) this.tryPlay(); this.syncUI(); },
  syncUI() {
    const pill = document.getElementById('ambPill');
    pill.classList.toggle('hidden', !this.key);
    pill.textContent = this.muted ? '🔇' : '🔊';
    pill.classList.toggle('muted', this.muted);
    const sw = document.getElementById('ambMute');
    sw.classList.toggle('on', !this.muted);
    sw.setAttribute('aria-checked', String(!this.muted));
  },
};
document.addEventListener('pointerdown', () => { if (ambient.pending && !ambient.muted) ambient.tryPlay(); }, true);
document.getElementById('ambPill').addEventListener('click', () => ambient.setMuted(!ambient.muted));
document.getElementById('ambMute').addEventListener('click', () => ambient.setMuted(!ambient.muted));
document.getElementById('ambVol').addEventListener('input', ev => ambient.setVol(ev.target.value / 100));

// ---------------- 조명 기구 ----------------
const fixtureBodyGeo = new THREE.CylinderGeometry(0.16, 0.24, 0.55, 10);
fixtureBodyGeo.rotateX(Math.PI / 2);
function shadowLightCount() { return lights.filter(l => l.spot.castShadow).length; }

function createLight(data, record = true) {
  if (lights.length >= MAX_LIGHTS) { toast(`조명은 ${MAX_LIGHTS}개까지 달 수 있어요!`); return null; }
  const def = LIGHT_TYPES[data.type];
  const Lg = {
    id: data.id ?? lightSeq++, type: data.type, color: data.color ?? def.color,
    intensity: data.intensity ?? def.intensity, angle: data.angle ?? def.angle, on: data.on ?? true,
    presetId: data.presetId ?? null, name: data.name ?? null, hide: data.hide ?? false,
    pos: new THREE.Vector3().fromArray(data.pos), target: new THREE.Vector3().fromArray(data.target), phase: Math.random() * Math.PI * 2,
  };
  lightSeq = Math.max(lightSeq, Lg.id + 1);
  const group = new THREE.Group(); group.position.copy(Lg.pos);
  let body, lens;
  if (Lg.type === 'floor') {
    // 바닥 조명: 무대 위로 솟지 않도록 납작한 바닥 매입형 기구
    body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.5, metalness: 0.4 }));
    body.position.y = -0.02; body.castShadow = false; body.receiveShadow = true;
    lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), new THREE.MeshBasicMaterial({ color: Lg.color }));
    lens.rotation.x = -Math.PI / 2; lens.position.y = 0.035; body.add(lens);
    group.add(body);
  } else {
    body = new THREE.Mesh(fixtureBodyGeo, new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.5, metalness: 0.4 })); body.castShadow = true;
    lens = new THREE.Mesh(new THREE.CircleGeometry(0.13, 10), new THREE.MeshBasicMaterial({ color: Lg.color })); lens.position.z = 0.29; body.add(lens);
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.07), new THREE.MeshStandardMaterial({ color: 0x111318, metalness: 0.5 })); clamp.position.y = 0.4;
    group.add(body, clamp);
  }
  group.traverse(o => { o.userData = { kind: 'fixture', lightId: Lg.id }; });
  const spot = new THREE.SpotLight(Lg.color, Lg.intensity, 60, THREE.MathUtils.degToRad(Lg.angle), 0.35, 0);
  spot.position.set(0, 0, 0);
  if (shadowLightCount() < MAX_SHADOW_LIGHTS) { spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.002; }
  group.add(spot);
  const targetObj = new THREE.Object3D(); scene.add(targetObj); targetObj.position.copy(Lg.target); spot.target = targetObj;
  const cone = new THREE.Mesh(makeConeGeo(Lg), new THREE.MeshBasicMaterial({ color: Lg.color, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.userData = { kind: 'beam' }; cone.raycast = () => {}; group.add(cone);
  Object.assign(Lg, { group, body, lens, spot, cone, targetObj });
  group.visible = !Lg.hide;
  lightGroup.add(group); lights.push(Lg);
  orientLight(Lg); updateLightVisual(Lg);
  if (record) pushUndo({ undo: () => deleteLight(Lg, false) });
  return Lg;
}
function makeConeGeo(Lg) {
  const len = Math.max(1, Lg.pos.distanceTo(Lg.target));
  const r = Math.tan(THREE.MathUtils.degToRad(Lg.angle)) * len;
  const geo = new THREE.ConeGeometry(r, len, 20, 1, true); geo.translate(0, -len / 2, 0); return geo;
}
const _dir = new THREE.Vector3(), _down = new THREE.Vector3(0, -1, 0);
function orientLight(Lg) {
  Lg.group.position.copy(Lg.pos); Lg.targetObj.position.copy(Lg.target);
  _dir.subVectors(Lg.target, Lg.pos).normalize();
  if (Lg.type !== 'floor') Lg.body.lookAt(Lg.pos.clone().add(_dir)); // 바닥 조명 몸체는 눕힌 채 유지
  Lg.cone.quaternion.setFromUnitVectors(_down, _dir);
}
function coneOpacity(Lg) {
  const base = state.perform ? 0.17 : 0.09;
  const len = Math.max(1, Lg.pos.distanceTo(Lg.target));
  const lenF = Math.min(1, 9 / len);
  return base * Math.min(1, Lg.intensity / 5) * lenF * state.cueMul;
}
function updateLightVisual(Lg) {
  Lg.spot.color.set(Lg.color);
  Lg.spot.intensity = Lg.on ? Lg.intensity * state.cueMul : 0;
  Lg.spot.angle = THREE.MathUtils.degToRad(Lg.angle);
  Lg.lens.material.color.set(Lg.color); Lg.cone.material.color.set(Lg.color);
  Lg.cone.geometry.dispose(); Lg.cone.geometry = makeConeGeo(Lg);
  Lg.cone.visible = Lg.on && state.cueMul > 0.02;
  Lg.cone.material.opacity = coneOpacity(Lg);
  Lg.group.visible = !Lg.hide;
  orientLight(Lg);
}
function applyCueScale() {
  for (const Lg of lights) {
    Lg.spot.intensity = Lg.on ? Lg.intensity * state.cueMul : 0;
    Lg.cone.visible = Lg.on && state.cueMul > 0.02;
    Lg.cone.material.opacity = coneOpacity(Lg);
  }
}
function deleteLight(Lg, record = true) {
  const i = lights.indexOf(Lg); if (i < 0) return;
  lights.splice(i, 1); lightGroup.remove(Lg.group); scene.remove(Lg.targetObj);
  if (state.selected && state.selected.ref === Lg) clearSelection();
  if (record) { const data = serializeLight(Lg); pushUndo({ undo: () => createLight(data, false) }); }
}
const serializeLight = (Lg) => ({ id: Lg.id, type: Lg.type, color: Lg.color, intensity: Lg.intensity, angle: Lg.angle, on: Lg.on, presetId: Lg.presetId, name: Lg.name, hide: Lg.hide, pos: Lg.pos.toArray(), target: Lg.target.toArray() });

function placeLightAt(point) {
  const type = state.lightType;
  const fr = stageFrame();
  const center = PRESETS[proj.preset]?.stageCenter ?? new THREE.Vector3(0, 2, -6);
  let pos, target = point.clone();
  if (type === 'follow') { pos = new THREE.Vector3(point.x > 0.5 ? 7 : -6, 9.5, 15); }
  else if (type === 'floor') {
    pos = point.clone().add(new THREE.Vector3(0, 0.05, 0));
    const toCenter = new THREE.Vector3().subVectors(center, point).setY(0);
    if (toCenter.lengthSq() < 0.5) toCenter.set(0, 0, -1); toCenter.normalize();
    target = pos.clone().add(toCenter.multiplyScalar(2.5)).add(new THREE.Vector3(0, 6, 0));
  } else { pos = new THREE.Vector3(point.x, fr.gridY + 1.6, point.z + (type === 'wash' ? 3 : 1.2)); }
  const Lg = createLight({ type, pos: pos.toArray(), target: target.toArray() });
  if (Lg) { toast(`${LIGHT_TYPES[type].emoji} ${LIGHT_TYPES[type].name}을(를) 달았어요!`); blip(660); selectElement('light', Lg); markDirty(); }
}

// 조명 세트 — 토글 방식: 같은 세트 다시 클릭 = 끄기, 다른 세트 = 교체 (직접 단 조명은 유지)
function applyLightPreset(preset) {
  const prev = lights.map(serializeLight);
  const prevActive = state.activePreset;
  const turningOff = state.activePreset === preset.id;
  for (const Lg of [...lights]) if (Lg.presetId) deleteLight(Lg, false);
  if (!turningOff) {
    const fr = stageFrame();
    for (const cfg of preset.build(fr)) { const l = createLight(cfg, false); if (l) l.presetId = preset.id; }
    state.activePreset = preset.id;
    toast(`${preset.emoji} ${preset.name} 조명을 켰어요! (한 번 더 누르면 꺼져요)`);
  } else {
    state.activePreset = null;
    toast(`${preset.emoji} ${preset.name} 조명을 껐어요`);
  }
  pushUndo({ undo: () => {
    for (const Lg of [...lights]) deleteLight(Lg, false);
    for (const d of prev) createLight(d, false);
    state.activePreset = prevActive;
    refreshPresetButtons(); renderElementList();
  } });
  refreshPresetButtons();
  markDirty(); renderElementList();
  blip(720);
}
function refreshPresetButtons() {
  document.querySelectorAll('#presetGrid .preset-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === state.activePreset));
}

// ---------------- 소품 ----------------
// 소품 그룹에 선택용 userData를 입히되, 인물 골격(rig/part) 정보는 지우지 않고 병합한다
function tagPropGroup(P) {
  P.group.traverse(o => { o.userData.kind = 'prop'; o.userData.propId = P.id; });
  P.group.userData.animPhase = P.animPhase;
  if (isPerson(P.type)) applyPose(P.group, P.pose, 0); // 정적 자세는 즉시 반영
}
function addPropRaw(type, x, y, z, rot = 0, variant = 0, record = false, extra = {}) {
  const P = {
    id: uid(), type, rot, variant,
    scale: extra.scale ?? 1, cfg: extra.cfg ?? null, name: extra.name ?? null, hide: extra.hide ?? false,
    pose: extra.pose ?? DEFAULT_POSE, animPhase: extra.animPhase ?? Math.random() * Math.PI * 2,
    pos: new THREE.Vector3(x, y, z), group: null,
  };
  if (isPerson(type)) P.cfg = normalizeCfg(P.cfg, type); // 인물은 항상 완전한 꾸미기값 보유
  P.group = buildProp(type, variant, P.cfg);
  P.group.position.copy(P.pos); P.group.rotation.y = rot; P.group.scale.setScalar(P.scale);
  P.group.visible = !P.hide;
  tagPropGroup(P);
  propGroup.add(P.group); props.push(P);
  if (record) pushUndo({ undo: () => deleteProp(P, false) });
  return P;
}
function rebuildPropGroup(P) {
  propGroup.remove(P.group);
  P.group = buildProp(P.type, P.variant, P.cfg);
  P.group.position.copy(P.pos); P.group.rotation.y = P.rot; P.group.scale.setScalar(P.scale);
  P.group.visible = !P.hide;
  tagPropGroup(P);
  propGroup.add(P.group);
}
function deleteProp(P, record = true) {
  const i = props.indexOf(P); if (i < 0) return;
  props.splice(i, 1); propGroup.remove(P.group);
  if (state.selected && state.selected.ref === P) clearSelection();
  if (record) {
    const d = { type: P.type, x: P.pos.x, y: P.pos.y, z: P.pos.z, rot: P.rot, variant: P.variant, extra: { scale: P.scale, cfg: P.cfg, name: P.name, hide: P.hide, pose: P.pose } };
    pushUndo({ undo: () => addPropRaw(d.type, d.x, d.y, d.z, d.rot, d.variant, false, d.extra) });
  }
}

// ---------------- 이미지 (2D 입간판) ----------------
function loadTex(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; resolve({ tex, aspect: img.width / img.height }); };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function buildStandee(tex, aspect, scale) {
  const H = 2.2 * scale;
  const W = H * Math.min(4, Math.max(0.25, aspect));
  const g = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }));
  plane.position.y = H / 2 + 0.06;
  g.add(plane);
  const base = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, 0.12, 0.35), envMat('#2a2c34', { metalness: 0.3 }));
  base.position.y = 0.06;
  g.add(base);
  return g;
}
function addImageRaw(data, record = false) {
  const I = { id: uid(), src: data.src, aspect: data.aspect, scale: data.scale ?? 1, rot: data.rot ?? 0, name: data.name ?? null, hide: data.hide ?? false, pos: new THREE.Vector3(data.x, data.y, data.z), group: null, tex: data.tex };
  const build = (tex, aspect) => {
    I.tex = tex; I.aspect = aspect;
    I.group = buildStandee(tex, aspect, I.scale);
    I.group.position.copy(I.pos); I.group.rotation.y = I.rot; I.group.visible = !I.hide;
    I.group.traverse(o => { o.userData = { kind: 'image', imageId: I.id }; });
    imageGroup.add(I.group);
  };
  if (data.tex) build(data.tex, data.aspect);
  else loadTex(data.src).then(r => { if (r) { build(r.tex, r.aspect); renderElementList(); } });
  images.push(I);
  if (record) pushUndo({ undo: () => deleteImage(I, false) });
  return I;
}
function rebuildImage(I) {
  if (I.group) imageGroup.remove(I.group);
  I.group = buildStandee(I.tex, I.aspect, I.scale);
  I.group.position.copy(I.pos); I.group.rotation.y = I.rot; I.group.visible = !I.hide;
  I.group.traverse(o => { o.userData = { kind: 'image', imageId: I.id }; });
  imageGroup.add(I.group);
}
function deleteImage(I, record = true) {
  const i = images.indexOf(I); if (i < 0) return;
  images.splice(i, 1); if (I.group) imageGroup.remove(I.group);
  if (state.selected && state.selected.ref === I) clearSelection();
  if (record) { const d = { src: I.src, aspect: I.aspect, scale: I.scale, rot: I.rot, name: I.name, hide: I.hide, x: I.pos.x, y: I.pos.y, z: I.pos.z, tex: I.tex }; pushUndo({ undo: () => addImageRaw(d, false) }); }
}

// ---------------- 선택 & 편집 ----------------
const selBox = new THREE.Mesh(cubeGeo, new THREE.MeshBasicMaterial({ color: 0xffd54a, wireframe: true, transparent: true, opacity: 0.9 }));
selBox.visible = false; selBox.raycast = () => {}; selBox.scale.setScalar(1.04);
scene.add(selBox);

function setHL(obj, on) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      if (!m.emissive) return;
      if (on) { if (m.__he === undefined) { m.__he = m.emissive.getHex(); m.__hi = m.emissiveIntensity; } m.emissive.setHex(0x3b6bff); m.emissiveIntensity = 0.55; }
      else if (m.__he !== undefined) { m.emissive.setHex(m.__he); m.emissiveIntensity = m.__hi; m.__he = undefined; }
    });
  });
}
function fixtureHL(Lg, on) { Lg.body.material.emissive = new THREE.Color(on ? 0xffd54a : 0x000000); Lg.body.material.emissiveIntensity = on ? 0.6 : 0; }

function clearSelection() {
  const s = state.selected;
  if (s) {
    if (s.kind === 'light') fixtureHL(s.ref, false);
    else if (s.kind === 'seats') seatHL(false);
    else if (s.kind !== 'block' && s.ref.group) setHL(s.ref.group, false);
  }
  selBox.visible = false;
  state.selected = null; state.retargeting = false; state.moveMode = false;
  hidePanel('editPanel');
  renderElementList();
}
function sameBlock(a, b) { return a && b && a.x === b.x && a.y === b.y && a.z === b.z; }
function selectElement(kind, ref) {
  if (state.selected && state.selected.kind === kind) {
    if (kind === 'block' && sameBlock(state.selected.ref, ref)) return; // 블록은 다시 클릭해도 유지 (실수 방지)
    if (kind !== 'block' && state.selected.ref === ref) { deleteSelected(); return; }
  }
  clearSelection();
  if (state.multi.length) clearMulti();
  state.selected = { kind, ref };
  if (kind === 'light') fixtureHL(ref, true);
  else if (kind === 'seats') seatHL(true);
  else if (kind === 'block') {
    const b = blocks.get(keyOf(ref.x, ref.y, ref.z)); if (!b) { state.selected = null; return; }
    selBox.geometry = b.shape === 'slab' ? slabGeo : cubeGeo;
    selBox.position.set(ref.x + 0.5, ref.y + 0.5, ref.z + 0.5);
    selBox.visible = true;
  } else setHL(ref.group, true);
  openEditPanel();
  renderElementList();
  if (kind === 'seats') setHint('🪑 객석 선택! 이동·회전으로 통째로 옮겨 보세요');
  else if (kind !== 'block') setHint('한 번 더 클릭하면 삭제 · 패널에서 이동·회전·복제할 수 있어요');
  else if (baseLocked(ref.x, ref.y, ref.z)) setHint('🔒 기본 무대 블록이에요 — 색은 바꿀 수 있지만 지우려면 화면 옵션을 켜세요');
  else setHint('🧱 블록 선택! 패널에서 다른 블록으로 바꾸거나 삭제할 수 있어요');
}
function deleteSelected() {
  const s = state.selected; if (!s) return;
  if (s.kind === 'light') { deleteLight(s.ref); toast('조명을 뗐어요'); }
  else if (s.kind === 'prop') { deleteProp(s.ref); toast('소품을 치웠어요'); }
  else if (s.kind === 'image') { deleteImage(s.ref); toast('이미지를 뺐어요'); }
  else if (s.kind === 'block') {
    if (baseLocked(s.ref.x, s.ref.y, s.ref.z)) { toast(BASE_LOCK_MSG); return; }
    removeBlock(s.ref.x, s.ref.y, s.ref.z, true); toast('블록을 지웠어요');
  }
  blip(320); markDirty(); renderElementList();
}

// ---------------- 통합 편집 패널 ----------------
const ep = {
  panel: document.getElementById('editPanel'), title: document.getElementById('epTitle'),
  move: document.getElementById('epMove'), rotate: document.getElementById('epRotate'),
  dup: document.getElementById('epDup'), del: document.getElementById('epDelete'),
  scaleRow: document.getElementById('epScaleRow'), scale: document.getElementById('epScale'), scaleVal: document.getElementById('epScaleVal'),
  rotRow: document.getElementById('epRotRow'), rot: document.getElementById('epRot'), rotVal: document.getElementById('epRotVal'),
  lightSec: document.getElementById('epLightSec'), blockSec: document.getElementById('epBlockSec'), actorSec: document.getElementById('epActorSec'),
  seatSec: document.getElementById('epSeatSec'),
};
function elementDisplayName(kind, ref) {
  if (kind === 'seats') return '객석 전체';
  if (ref.name) return ref.name;
  if (kind === 'light') return `${LIGHT_TYPES[ref.type].name}`;
  if (kind === 'prop') return PROP_INFO[ref.type]?.name ?? ref.type;
  if (kind === 'image') return '내 이미지';
  if (kind === 'block') return BLOCKS[blocks.get(keyOf(ref.x, ref.y, ref.z))?.type]?.name ?? '블록';
  return '요소';
}
function openEditPanel() {
  const s = state.selected; if (!s) return;
  const { kind, ref } = s;
  const icon = kind === 'seats' ? '🪑' : kind === 'light' ? LIGHT_TYPES[ref.type].emoji : kind === 'prop' ? (PROP_INFO[ref.type]?.emoji ?? '🔷') : kind === 'image' ? '🖼️' : '🧱';
  ep.title.textContent = `${icon} ${elementDisplayName(kind, ref)}`;
  ep.move.classList.remove('hidden');
  ep.rotate.classList.toggle('hidden', kind === 'light' || kind === 'block');
  ep.dup.classList.toggle('hidden', kind === 'block' || kind === 'seats');
  ep.del.classList.toggle('hidden', kind === 'seats' || (kind === 'block' && baseLocked(ref.x, ref.y, ref.z)));
  ep.scaleRow.classList.toggle('hidden', kind === 'light' || kind === 'block' || kind === 'seats');
  // 회전: 소품·이미지·객석은 자유 회전(45° 자석 스냅). 조명·블록은 숨김
  ep.rotRow.classList.toggle('hidden', kind === 'light' || kind === 'block');
  ep.lightSec.classList.toggle('hidden', kind !== 'light');
  ep.blockSec.classList.toggle('hidden', kind !== 'block');
  ep.actorSec.classList.toggle('hidden', !(kind === 'prop' && isPerson(ref.type)));
  ep.seatSec.classList.toggle('hidden', kind !== 'seats');
  ep.move.classList.toggle('mode-on', state.moveMode);
  if (!ep.rotRow.classList.contains('hidden')) setRotSlider(currentRotOf(s));
  if (kind === 'seats') { showPanel('editPanel'); return; }
  if (kind === 'prop' || kind === 'image') { ep.scale.value = ref.scale; ep.scaleVal.textContent = `${(+ref.scale).toFixed(1)}배`; }
  if (kind === 'light') openLightControls(ref);
  if (kind === 'block') refreshEpBlockGrid();
  if (kind === 'prop' && isPerson(ref.type)) {
    ref.cfg = normalizeCfg(ref.cfg, ref.type);
    if (!ref.pose) ref.pose = DEFAULT_POSE;
    buildCustomizerUI(document.getElementById('epActorChips'),
      () => ref.cfg,
      cfg => {
        const old = { ...ref.cfg };
        ref.cfg = cfg; rebuildPropGroup(ref); setHL(ref.group, true); markDirty();
        pushUndo({ undo: () => { ref.cfg = old; rebuildPropGroup(ref); if (state.selected?.ref === ref) setHL(ref.group, true); } });
      },
      { pose: {
        list: POSES, get: () => ref.pose,
        set: p => { const old = ref.pose; ref.pose = p; applyPose(ref.group, p, 0); markDirty(); pushUndo({ undo: () => { ref.pose = old; applyPose(ref.group, old, 0); } }); },
      } });
  }
  showPanel('editPanel');
}
ep.move.addEventListener('click', () => {
  if (!state.selected) return;
  state.moveMode = !state.moveMode;
  ep.move.classList.toggle('mode-on', state.moveMode);
  setHint(state.moveMode ? '📍 옮길 곳을 클릭하세요! (오른쪽 클릭 = 취소)' : '이동을 취소했어요');
});
ep.rotate.addEventListener('click', () => rotateSelected());
ep.dup.addEventListener('click', () => duplicateSelected());
ep.del.addEventListener('click', () => deleteSelected());
ep.scale.addEventListener('input', () => {
  const s = state.selected; if (!s || (s.kind !== 'prop' && s.kind !== 'image')) return;
  if (ep.scale._start === undefined) ep.scale._start = s.ref.scale;
  s.ref.scale = +ep.scale.value;
  ep.scaleVal.textContent = `${s.ref.scale.toFixed(1)}배`;
  if (s.kind === 'prop') s.ref.group.scale.setScalar(s.ref.scale);
  else { rebuildImage(s.ref); setHL(s.ref.group, true); }
  markDirty();
});
ep.scale.addEventListener('change', () => {
  const s = state.selected; const old = ep.scale._start; ep.scale._start = undefined;
  if (!s || old === undefined || old === s.ref.scale) return;
  const ref = s.ref, kind = s.kind;
  pushUndo({ undo: () => { ref.scale = old; if (kind === 'prop') ref.group.scale.setScalar(old); else rebuildImage(ref); } });
});

const ROT_STEP = Math.PI / 4; // 45° — 버튼/R 키는 45°씩 회전
const TAU = Math.PI * 2;
// 45°(π/4) 배수에 가까우면 자석처럼 스냅
function snapRot(rad, thresholdDeg = 5) {
  const step = Math.PI / 4;
  const nearest = Math.round(rad / step) * step;
  return Math.abs(rad - nearest) <= thresholdDeg * Math.PI / 180 ? nearest : rad;
}
function currentRotOf(s) {
  if (s.kind === 'seats') return proj.seatTransform.rot || 0;
  return s.ref.rot || 0;
}
function applyRotTo(s, rad) {
  if (s.kind === 'seats') { proj.seatTransform.rot = ((rad % TAU) + TAU) % TAU; rebuildSeats(); seatHL(true); }
  else { s.ref.rot = ((rad % TAU) + TAU) % TAU; s.ref.group.rotation.y = s.ref.rot; }
}
function setRotSlider(rad) {
  const deg = Math.round((((rad % TAU) + TAU) % TAU) * 180 / Math.PI);
  ep.rot.value = deg % 360;
  ep.rotVal.textContent = `${deg % 360}°`;
}
function rotateSelected() {
  const s = state.selected; if (!s) return;
  if (s.kind !== 'seats' && s.kind !== 'prop' && s.kind !== 'image') return;
  const old = currentRotOf(s);
  // 다음 45° 눈금으로 딱 맞춰 회전
  const next = Math.round((old + ROT_STEP - 1e-4) / ROT_STEP) * ROT_STEP;
  applyRotTo(s, next);
  setRotSlider(currentRotOf(s));
  pushUndo({ undo: () => { applyRotTo(s, old); if (state.selected === s) setRotSlider(old); } });
  blip(500); markDirty();
}
// 자유 회전 슬라이더 (45° 자석 스냅)
ep.rot.addEventListener('input', () => {
  const s = state.selected; if (!s || (s.kind !== 'prop' && s.kind !== 'image' && s.kind !== 'seats')) return;
  if (ep.rot._start === undefined) ep.rot._start = currentRotOf(s);
  const rad = snapRot((+ep.rot.value) * Math.PI / 180);
  applyRotTo(s, rad);
  setRotSlider(rad);
  markDirty();
});
ep.rot.addEventListener('change', () => {
  const s = state.selected; const old = ep.rot._start; ep.rot._start = undefined;
  if (!s || old === undefined) return;
  const now = currentRotOf(s);
  if (Math.abs(now - old) < 1e-4) return;
  pushUndo({ undo: () => { applyRotTo(s, old); if (state.selected === s) setRotSlider(old); } });
});
document.getElementById('epSeatReset').addEventListener('click', () => {
  const old = { ...proj.seatTransform };
  proj.seatTransform = { x: 0, z: 0, rot: 0 }; rebuildSeats(); seatHL(true);
  pushUndo({ undo: () => { proj.seatTransform = old; rebuildSeats(); } });
  toast('🪑 객석을 원래 자리로 되돌렸어요'); markDirty();
});
function duplicateSelected() {
  const s = state.selected; if (!s) return;
  if (s.kind === 'prop') {
    const P = s.ref;
    const N = addPropRaw(P.type, P.pos.x + 1, P.pos.y, P.pos.z + 0.5, P.rot, P.variant, true, { scale: P.scale, cfg: P.cfg ? { ...P.cfg } : null, pose: P.pose });
    selectElement('prop', N);
  } else if (s.kind === 'image') {
    const I = s.ref;
    const N = addImageRaw({ src: I.src, tex: I.tex, aspect: I.aspect, scale: I.scale, rot: I.rot, x: I.pos.x + 1, y: I.pos.y, z: I.pos.z + 0.5 }, true);
    selectElement('image', N);
  } else if (s.kind === 'light') {
    const d = serializeLight(s.ref);
    delete d.id; d.presetId = null; d.name = null;
    d.pos = [d.pos[0] + 1.2, d.pos[1], d.pos[2]];
    d.target = [d.target[0] + 1.2, d.target[1], d.target[2]];
    const N = createLight(d, true);
    if (N) selectElement('light', N);
  }
  toast('⧉ 복제했어요!'); blip(620); markDirty(); renderElementList();
}
function moveSelectedTo(point, hit) {
  const s = state.selected; if (!s) return;
  const ref = s.ref;
  if (s.kind === 'seats') {
    const old = { ...proj.seatTransform };
    // 클릭한 곳으로 객석 무리의 중심이 오도록 이동 오프셋 계산
    proj.seatTransform.x = point.x - seatCentroid.x;
    proj.seatTransform.z = point.z - seatCentroid.z;
    rebuildSeats(); seatHL(true);
    pushUndo({ undo: () => { proj.seatTransform = old; rebuildSeats(); } });
    state.moveMode = false; ep.move.classList.remove('mode-on');
    blip(560); markDirty(); updateHint(); return;
  }
  if (s.kind === 'block') {
    const c = cellFromHit(hit);
    if (!inBounds(c.x, c.y, c.z) || blocks.has(keyOf(c.x, c.y, c.z))) { toast('그 자리에는 놓을 수 없어요'); return; }
    const b = blocks.get(keyOf(ref.x, ref.y, ref.z)); if (!b) return;
    const old = { ...ref }, wasBase = b.base;
    removeBlock(ref.x, ref.y, ref.z); addBlock(c.x, c.y, c.z, b.type, b.shape, false, wasBase);
    pushUndo({ undo: () => { removeBlock(c.x, c.y, c.z); addBlock(old.x, old.y, old.z, b.type, b.shape, false, wasBase); } });
    state.selected = { kind: 'block', ref: c };
    selBox.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5); selBox.visible = true;
  } else if (s.kind === 'prop' || s.kind === 'image') {
    const old = ref.pos.clone();
    ref.pos.set(snapHalf(point.x), snapHalf(point.y), snapHalf(point.z));
    ref.group.position.copy(ref.pos);
    pushUndo({ undo: () => { ref.pos.copy(old); ref.group.position.copy(old); } });
  } else if (s.kind === 'light') {
    const old = ref.pos.clone();
    if (ref.type === 'floor') ref.pos.set(point.x, point.y + 0.05, point.z);
    else ref.pos.set(point.x, ref.pos.y, point.z);
    updateLightVisual(ref);
    pushUndo({ undo: () => { ref.pos.copy(old); updateLightVisual(ref); } });
  }
  state.moveMode = false; ep.move.classList.remove('mode-on');
  blip(560); markDirty(); updateHint();
}

// ---------------- 되돌리기 ----------------
function pushUndo(op) { undoStack.push(op); if (undoStack.length > 120) undoStack.shift(); }
function undo() { const op = undoStack.pop(); if (!op) { toast('되돌릴 것이 없어요'); return; } op.undo(); renderElementList(); blip(380); markDirty(); }

// ---------------- 레이캐스팅 & 상호작용 ----------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function pick(ev, targets) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(targets, true)[0] ?? null;
}
function worldNormal(hit) { if (!hit.face) return new THREE.Vector3(0, 1, 0); return hit.face.normal.clone().transformDirection(hit.object.matrixWorld).round(); }
function cellFromHit(hit, into = false) { const n = worldNormal(hit); const p = hit.point.clone().addScaledVector(n, into ? -0.5 : 0.5); return { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }; }
const snapHalf = (v) => Math.round(v * 2) / 2;

const ghostMatAdd = new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.35, depthWrite: false });
const ghostMatErase = new THREE.MeshBasicMaterial({ color: 0xff5a4e, transparent: true, opacity: 0.4, depthWrite: false });
const ghostMatLock = new THREE.MeshBasicMaterial({ color: 0x4a7fd4, transparent: true, opacity: 0.32, depthWrite: false });
const ghost = new THREE.Mesh(cubeGeo, ghostMatAdd);
ghost.visible = false; ghost.raycast = () => {}; scene.add(ghost);

let propGhost = null;
function refreshPropGhost() {
  if (propGhost) { scene.remove(propGhost); propGhost = null; }
  if (state.mode !== 'prop' || state.propCat === 'images') return;
  propGhost = buildProp(state.propType, state.propVariant, state.propType === 'actor' ? state.actorCfg : null);
  propGhost.traverse(o => {
    if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => { m.transparent = true; m.opacity = 0.55; m.depthWrite = false; }); o.castShadow = false; }
    o.raycast = () => {};
  });
  propGhost.visible = false; scene.add(propGhost);
}
function selectTargets() { return [...propGroup.children, ...imageGroup.children, ...lightGroup.children]; }
const isSelectMode = () => state.mode === 'view' || state.mode === 'perform';

function onHover(ev) {
  ghost.visible = false; if (propGhost) propGhost.visible = false;
  if (state.mode === 'block') {
    if (state.blockShape === 'erase') {
      const hit = pick(ev, blockGroup.children); if (!hit) return;
      const c = cellFromHit(hit, true);
      const b = blocks.get(keyOf(c.x, c.y, c.z)); if (!b) return;
      ghost.material = baseLocked(c.x, c.y, c.z) ? ghostMatLock : ghostMatErase;
      ghost.geometry = b.shape === 'slab' ? slabGeo : cubeGeo;
      ghost.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5); ghost.visible = true;
      return;
    }
    const hit = pick(ev, [...blockGroup.children, groundPlane]); if (!hit) return;
    const c = cellFromHit(hit);
    if (!inBounds(c.x, c.y, c.z) || blocks.has(keyOf(c.x, c.y, c.z))) return;
    ghost.material = ghostMatAdd;
    ghost.geometry = state.blockShape === 'slab' ? slabGeo : cubeGeo;
    ghost.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5); ghost.visible = true;
  } else if (state.mode === 'prop' && propGhost) {
    const hit = pick(ev, [...blockGroup.children, groundPlane]); if (!hit) return;
    propGhost.position.set(snapHalf(hit.point.x), snapHalf(hit.point.y), snapHalf(hit.point.z));
    propGhost.rotation.y = state.propRot; propGhost.visible = true;
  }
}

function onLeftClick(ev) {
  // 무대 센터(간격 눈금) 지정
  if (state.settingCenter) {
    const hit = pick(ev, [...blockGroup.children, groundPlane]);
    if (hit) { state.markCenter = { x: hit.point.x, y: hit.point.y, z: hit.point.z }; buildMarks(); state.settingCenter = false; document.getElementById('btnSetCenter').classList.remove('mode-on'); toast('🎯 여기를 센터(0)로 눈금을 그렸어요!'); blip(660); markDirty(); updateHint(); }
    return;
  }
  // 여러 개 함께 이동
  if (state.multiMove && state.multi.length) {
    const hit = pick(ev, [...blockGroup.children, groundPlane]);
    if (hit) moveMultiTo(hit.point);
    return;
  }
  // 이동 모드
  if (state.moveMode && state.selected) {
    const hit = pick(ev, [...blockGroup.children, groundPlane]);
    if (hit) moveSelectedTo(hit.point, hit);
    return;
  }
  // 조명 다시 겨누기
  if (state.retargeting && state.selected?.kind === 'light') {
    const hit = pick(ev, [...blockGroup.children, groundPlane]);
    if (hit) { state.selected.ref.target.copy(hit.point); updateLightVisual(state.selected.ref); state.retargeting = false; toast('🎯 조명이 새 위치를 비춰요!'); updateHint(); markDirty(); }
    return;
  }
  if (state.mode === 'block') {
    if (state.blockShape === 'erase') {
      const hit = pick(ev, blockGroup.children); if (!hit) return;
      const c = cellFromHit(hit, true);
      if (baseLocked(c.x, c.y, c.z)) { toast(BASE_LOCK_MSG); return; }
      if (removeBlock(c.x, c.y, c.z, true)) { blip(320); markDirty(); renderElementList(); }
      return;
    }
    const hit = pick(ev, [...blockGroup.children, groundPlane]); if (!hit) return;
    const c = cellFromHit(hit);
    if (addBlock(c.x, c.y, c.z, state.blockType, state.blockShape, true)) { blip(540); markDirty(); renderElementList(); }
  } else if (state.mode === 'light') {
    const hitFix = pick(ev, lightGroup.children);
    if (hitFix) { const Lg = lights.find(l => l.id === hitFix.object.userData.lightId); if (Lg) { selectElement('light', Lg); return; } }
    if (state.lightMode === 'free') { const hit = pick(ev, [...blockGroup.children, groundPlane]); if (hit) placeLightAt(hit.point); }
  } else if (state.mode === 'prop') {
    if (state.propCat === 'images') {
      if (!state.activeImage) { toast('먼저 이미지를 올리고 골라주세요'); return; }
      const hit = pick(ev, [...blockGroup.children, groundPlane]); if (!hit) return;
      const im = uploadedImages.get(state.activeImage);
      const I = addImageRaw({ src: im.src, tex: im.tex, aspect: im.aspect, scale: 1, rot: state.propRot, x: snapHalf(hit.point.x), y: snapHalf(hit.point.y), z: snapHalf(hit.point.z) }, true);
      blip(560); markDirty(); renderElementList(); selectElement('image', I);
      return;
    }
    const hit = pick(ev, [...blockGroup.children, groundPlane]); if (!hit) return;
    const extra = state.propType === 'actor' ? { cfg: { ...state.actorCfg }, pose: state.actorPose } : {};
    const P = addPropRaw(state.propType, snapHalf(hit.point.x), snapHalf(hit.point.y), snapHalf(hit.point.z), state.propRot, state.propVariant, true, extra);
    if (P) { blip(540); markDirty(); renderElementList(); if (state.propType === 'ball') { state.propVariant = (state.propVariant + 1) % 8; refreshPropGhost(); } }
  } else if (isSelectMode()) {
    const hit = pick(ev, selectTargets());
    if (hit) {
      const ud = hit.object.userData;
      if (ud.kind === 'fixture') { const Lg = lights.find(l => l.id === ud.lightId); if (Lg) selectElement('light', Lg); }
      else if (ud.kind === 'prop') { const P = props.find(p => p.id === ud.propId); if (P) selectElement('prop', P); }
      else if (ud.kind === 'image') { const I = images.find(im => im.id === ud.imageId); if (I) selectElement('image', I); }
      return;
    }
    // 객석 클릭 → 객석 전체 선택
    if (state.seats && seatGroup.userData.inst) {
      const hitSeat = pick(ev, seatGroup.children);
      if (hitSeat) { selectElement('seats', { kind: 'seats' }); return; }
    }
    const hitBlock = pick(ev, blockGroup.children);
    if (hitBlock) { const c = cellFromHit(hitBlock, true); if (blocks.has(keyOf(c.x, c.y, c.z))) { selectElement('block', c); return; } }
    clearSelection(); updateHint();
  }
}
function onRightClick(ev) {
  if (state.settingCenter) { state.settingCenter = false; document.getElementById('btnSetCenter').classList.remove('mode-on'); updateHint(); return; }
  if (state.moveMode) { state.moveMode = false; ep.move.classList.remove('mode-on'); updateHint(); return; }
  if (state.retargeting) { state.retargeting = false; updateHint(); return; }
  const hit = pick(ev, [...selectTargets(), ...blockGroup.children, groundPlane]); if (!hit) return;
  const ud = hit.object.userData;
  if (ud.kind === 'fixture') { const Lg = lights.find(l => l.id === ud.lightId); if (Lg) { deleteLight(Lg); toast('조명을 뗐어요'); blip(320); markDirty(); } }
  else if (ud.kind === 'prop') { const P = props.find(p => p.id === ud.propId); if (P) { deleteProp(P); blip(320); markDirty(); } }
  else if (ud.kind === 'image') { const I = images.find(im => im.id === ud.imageId); if (I) { deleteImage(I); blip(320); markDirty(); } }
  else if (ud.kind === 'block' && !isSelectMode()) { const c = cellFromHit(hit, true); if (baseLocked(c.x, c.y, c.z)) { toast(BASE_LOCK_MSG); } else if (removeBlock(c.x, c.y, c.z, true)) { blip(320); markDirty(); } }
  renderElementList();
}

let downInfo = null;
let marquee = null; // 드래그 선택 중 상태
const marqueeEl = document.getElementById('marquee');
canvas.addEventListener('pointerdown', ev => {
  downInfo = { x: ev.clientX, y: ev.clientY, button: ev.button, shift: ev.shiftKey };
  // 여러 개 선택 모드: 왼쪽 드래그로 사각형 그리기 (카메라 회전 잠시 끔)
  if (state.boxSelect && isSelectMode() && ev.button === 0 && !state.moveMode && !state.multiMove) {
    const rect = canvas.getBoundingClientRect();
    marquee = { sx: ev.clientX, sy: ev.clientY, rect };
    camRig.pauseForDrag();
    marqueeEl.classList.remove('hidden');
    updateMarqueeEl(ev.clientX, ev.clientY);
  }
});
canvas.addEventListener('pointermove', ev => {
  if (marquee) { updateMarqueeEl(ev.clientX, ev.clientY); return; }
  onHover(ev);
});
canvas.addEventListener('pointerup', ev => {
  if (marquee) {
    marqueeEl.classList.add('hidden'); camRig.resumeAfterDrag();
    const dist = Math.hypot(ev.clientX - marquee.sx, ev.clientY - marquee.sy);
    const m = marquee; marquee = null; downInfo = null;
    if (dist > 8) { doBoxSelect(m.sx, m.sy, ev.clientX, ev.clientY); return; }
    // 작은 클릭이면 일반 선택처럼 처리
    onLeftClick(ev); return;
  }
  if (!downInfo) return;
  const moved = Math.hypot(ev.clientX - downInfo.x, ev.clientY - downInfo.y);
  const info = downInfo; downInfo = null;
  if (moved > 6) return;
  if (info.button === 0 && !info.shift) onLeftClick(ev);
  else if (info.button === 2 || (info.button === 0 && info.shift)) onRightClick(ev);
});
canvas.addEventListener('contextmenu', ev => ev.preventDefault());
function updateMarqueeEl(cx, cy) {
  const r = marquee.rect;
  const x0 = Math.min(marquee.sx, cx) - r.left, y0 = Math.min(marquee.sy, cy) - r.top;
  marqueeEl.style.left = x0 + 'px'; marqueeEl.style.top = y0 + 'px';
  marqueeEl.style.width = Math.abs(cx - marquee.sx) + 'px';
  marqueeEl.style.height = Math.abs(cy - marquee.sy) + 'px';
}

// ---------------- 여러 개 선택 (드래그 박스) ----------------
const multiHLGroup = new THREE.Group(); scene.add(multiHLGroup); // 블록 선택 표시(와이어프레임)
const multiHLMat = new THREE.MeshBasicMaterial({ color: 0x3b9bff, wireframe: true, transparent: true, opacity: 0.9 });
function rebuildBlockHL() {
  multiHLGroup.clear();
  for (const it of state.multi) {
    if (it.kind !== 'block') continue;
    const b = blocks.get(keyOf(it.ref.x, it.ref.y, it.ref.z)); if (!b) continue;
    const box = new THREE.Mesh(b.shape === 'slab' ? slabGeo : cubeGeo, multiHLMat);
    box.scale.setScalar(1.04); box.position.set(it.ref.x + 0.5, it.ref.y + 0.5, it.ref.z + 0.5);
    box.raycast = () => {}; multiHLGroup.add(box);
  }
}
function clearMulti() {
  for (const it of state.multi) { if (it.kind === 'light') fixtureHL(it.ref, false); else if (it.kind !== 'block' && it.ref.group) setHL(it.ref.group, false); }
  state.multi = []; state.multiMove = false;
  multiHLGroup.clear();
  document.getElementById('mpMove').classList.remove('mode-on');
  hidePanel('multiPanel');
}
const _v = new THREE.Vector3();
function screenOf(worldPos) {
  const r = canvas.getBoundingClientRect();
  _v.copy(worldPos).project(camera);
  return { x: r.left + (_v.x * 0.5 + 0.5) * r.width, y: r.top + (-_v.y * 0.5 + 0.5) * r.height, behind: _v.z > 1 };
}
function itemPos(it) { return it.kind === 'block' ? new THREE.Vector3(it.ref.x + 0.5, it.ref.y + 0.5, it.ref.z + 0.5) : it.ref.pos.clone(); }
function doBoxSelect(x0, y0, x1, y1) {
  clearSelection();
  const minx = Math.min(x0, x1), maxx = Math.max(x0, x1), miny = Math.min(y0, y1), maxy = Math.max(y0, y1);
  const inside = (w) => { const s = screenOf(w); return !s.behind && s.x >= minx && s.x <= maxx && s.y >= miny && s.y <= maxy; };
  const picked = [];
  for (const P of props) if (inside(P.pos.clone().setY(P.pos.y + 0.6))) picked.push({ kind: 'prop', ref: P });
  for (const I of images) if (inside(I.pos.clone().setY(I.pos.y + 1))) picked.push({ kind: 'image', ref: I });
  for (const Lg of lights) if (inside(Lg.pos.clone())) picked.push({ kind: 'light', ref: Lg });
  for (const [k, b] of blocks) { const [x, y, z] = k.split(',').map(Number); if (inside(new THREE.Vector3(x + 0.5, y + (b.shape === 'slab' ? 0.25 : 0.5), z + 0.5))) picked.push({ kind: 'block', ref: { x, y, z } }); }
  if (!picked.length) { toast('선택된 요소가 없어요 — 요소 위로 드래그해 보세요'); return; }
  state.multi = picked;
  for (const it of picked) { if (it.kind === 'light') fixtureHL(it.ref, true); else if (it.kind !== 'block') setHL(it.ref.group, true); }
  rebuildBlockHL();
  const nB = picked.filter(it => it.kind === 'block').length;
  const nOther = picked.length - nB;
  document.getElementById('mpTitle').textContent = `여러 개 선택 (${picked.length}개)`;
  showPanel('multiPanel');
  setHint(`${nOther ? `요소 ${nOther}개` : ''}${nOther && nB ? ' + ' : ''}${nB ? `블록 ${nB}개` : ''}를 선택했어요`);
  blip(700);
}
function multiCentroid() {
  const c = new THREE.Vector3();
  for (const it of state.multi) c.add(itemPos(it));
  return c.multiplyScalar(1 / state.multi.length);
}
document.getElementById('mpMove').addEventListener('click', function () {
  if (!state.multi.length) return;
  state.multiMove = !state.multiMove;
  this.classList.toggle('mode-on', state.multiMove);
  setHint(state.multiMove ? '📍 옮길 곳을 클릭하면 선택한 요소가 함께 이동해요' : '이동을 취소했어요');
});
document.getElementById('mpRotate').addEventListener('click', () => {
  const rotatable = state.multi.filter(it => it.kind === 'prop' || it.kind === 'image');
  if (!rotatable.length) { toast('회전할 수 있는 소품·이미지가 없어요'); return; }
  const olds = rotatable.map(it => it.ref.rot);
  rotatable.forEach(it => { it.ref.rot = (it.ref.rot + Math.PI / 2) % (Math.PI * 2); it.ref.group.rotation.y = it.ref.rot; });
  pushUndo({ undo: () => rotatable.forEach((it, i) => { it.ref.rot = olds[i]; it.ref.group.rotation.y = olds[i]; }) });
  blip(500); markDirty();
});
document.getElementById('mpDelete').addEventListener('click', () => {
  if (!state.multi.length) return;
  // 잠긴 기본 무대 바닥은 삭제 대상에서 빼고 남겨 둔다
  const targets = state.multi.filter(it => !(it.kind === 'block' && baseLocked(it.ref.x, it.ref.y, it.ref.z)));
  const lockedCount = state.multi.length - targets.length;
  if (!targets.length) { toast(BASE_LOCK_MSG); return; }
  const snap = targets.map(it => it.kind === 'block'
    ? { kind: 'block', data: { ...blocks.get(keyOf(it.ref.x, it.ref.y, it.ref.z)), x: it.ref.x, y: it.ref.y, z: it.ref.z } }
    : { kind: it.kind, data: it.kind === 'light' ? serializeLight(it.ref) : it.kind === 'prop' ? serializeProp(it.ref) : serializeImageEl(it.ref) });
  const n = targets.length;
  for (const it of targets) {
    if (it.kind === 'light') deleteLight(it.ref, false);
    else if (it.kind === 'prop') deleteProp(it.ref, false);
    else if (it.kind === 'image') deleteImage(it.ref, false);
    else removeBlock(it.ref.x, it.ref.y, it.ref.z, false);
  }
  pushUndo({ undo: () => { snap.forEach(s => recreateEl(s.kind, s.data)); renderElementList(); } });
  toast(lockedCount ? `🗑️ ${n}개를 삭제했어요 (기본 무대는 남겨 뒀어요)` : `🗑️ ${n}개를 삭제했어요`);
  clearMulti(); markDirty(); renderElementList(); blip(320);
});
document.getElementById('mpDup').addEventListener('click', () => {
  if (!state.multi.length) return;
  const created = [];
  for (const it of state.multi) {
    if (it.kind === 'prop') { const P = it.ref; created.push({ kind: 'prop', el: addPropRaw(P.type, P.pos.x + 1, P.pos.y, P.pos.z + 0.5, P.rot, P.variant, false, { scale: P.scale, cfg: P.cfg ? { ...P.cfg } : null, pose: P.pose }) }); }
    else if (it.kind === 'image') { const I = it.ref; created.push({ kind: 'image', el: addImageRaw({ src: I.src, tex: I.tex, aspect: I.aspect, scale: I.scale, rot: I.rot, x: I.pos.x + 1, y: I.pos.y, z: I.pos.z + 0.5 }, false) }); }
    else if (it.kind === 'light') { const d = serializeLight(it.ref); delete d.id; d.presetId = null; d.name = null; d.pos = [d.pos[0] + 1.2, d.pos[1], d.pos[2]]; d.target = [d.target[0] + 1.2, d.target[1], d.target[2]]; created.push({ kind: 'light', el: createLight(d, false) }); }
    else { const b = blocks.get(keyOf(it.ref.x, it.ref.y, it.ref.z)); const nx = it.ref.x + 1, nz = it.ref.z + 1; if (b && inBounds(nx, it.ref.y, nz) && !blocks.has(keyOf(nx, it.ref.y, nz))) { addBlock(nx, it.ref.y, nz, b.type, b.shape); created.push({ kind: 'block', pos: { x: nx, y: it.ref.y, z: nz } }); } }
  }
  pushUndo({ undo: () => { created.forEach(c => { if (c.kind === 'block') removeBlock(c.pos.x, c.pos.y, c.pos.z, false); else if (!c.el) {} else if (c.kind === 'light') deleteLight(c.el, false); else if (c.kind === 'prop') deleteProp(c.el, false); else deleteImage(c.el, false); }); renderElementList(); } });
  toast(`⧉ ${created.length}개를 복제했어요`); markDirty(); renderElementList(); blip(620);
});

// 요소 직렬화/복원 헬퍼 (여러 개 삭제 되돌리기용)
function serializeProp(P) { return { type: P.type, x: P.pos.x, y: P.pos.y, z: P.pos.z, rot: P.rot, variant: P.variant, scale: P.scale, cfg: P.cfg, name: P.name, hide: P.hide, pose: P.pose }; }
function serializeImageEl(I) { return { src: I.src, aspect: I.aspect, scale: I.scale, rot: I.rot, name: I.name, hide: I.hide, x: I.pos.x, y: I.pos.y, z: I.pos.z, tex: I.tex }; }
function recreateEl(kind, d) {
  if (kind === 'light') createLight(d, false);
  else if (kind === 'prop') addPropRaw(d.type, d.x, d.y, d.z, d.rot, d.variant, false, { scale: d.scale, cfg: d.cfg, name: d.name, hide: d.hide, pose: d.pose });
  else if (kind === 'block') addBlock(d.x, d.y, d.z, d.type, d.shape, false, !!d.base);
  else addImageRaw(d, false);
}
function moveMultiTo(point) {
  if (!state.multi.length) return;
  const c = multiCentroid();
  const dx = point.x - c.x, dz = point.z - c.z;
  const blockItems = state.multi.filter(it => it.kind === 'block');
  const gdx = Math.round(dx), gdz = Math.round(dz);
  // 블록 이동 사전 검증 (범위 밖·다른 블록과 충돌 시 전체 취소)
  if (blockItems.length && (gdx || gdz)) {
    const selKeys = new Set(blockItems.map(it => keyOf(it.ref.x, it.ref.y, it.ref.z)));
    for (const it of blockItems) {
      const nx = it.ref.x + gdx, ny = it.ref.y, nz = it.ref.z + gdz, nk = keyOf(nx, ny, nz);
      if (!inBounds(nx, ny, nz) || (blocks.has(nk) && !selKeys.has(nk))) { toast('그쪽으로는 옮길 수 없어요'); return; }
    }
  }
  const olds = state.multi.map(it => it.kind === 'block' ? { x: it.ref.x, y: it.ref.y, z: it.ref.z } : it.ref.pos.clone());
  // 블록: 정보 저장 → 제거 → 재배치
  const bData = blockItems.map(it => { const b = blocks.get(keyOf(it.ref.x, it.ref.y, it.ref.z)); return { it, type: b.type, shape: b.shape, base: b.base, ox: it.ref.x, oy: it.ref.y, oz: it.ref.z }; });
  for (const bd of bData) removeBlock(bd.ox, bd.oy, bd.oz);
  for (const bd of bData) { addBlock(bd.ox + gdx, bd.oy, bd.oz + gdz, bd.type, bd.shape, false, bd.base); bd.it.ref = { x: bd.ox + gdx, y: bd.oy, z: bd.oz + gdz }; }
  // 소품·이미지·조명
  for (const it of state.multi) {
    if (it.kind === 'block') continue;
    it.ref.pos.x = snapHalf(it.ref.pos.x + dx); it.ref.pos.z = snapHalf(it.ref.pos.z + dz);
    if (it.kind === 'light') updateLightVisual(it.ref); else it.ref.group.position.copy(it.ref.pos);
  }
  rebuildBlockHL();
  pushUndo({ undo: () => {
    for (const bd of bData) removeBlock(bd.ox + gdx, bd.oy, bd.oz + gdz);
    for (const bd of bData) { addBlock(bd.ox, bd.oy, bd.oz, bd.type, bd.shape, false, bd.base); bd.it.ref = { x: bd.ox, y: bd.oy, z: bd.oz }; }
    state.multi.forEach((it, i) => { if (it.kind !== 'block') { it.ref.pos.copy(olds[i]); if (it.kind === 'light') updateLightVisual(it.ref); else it.ref.group.position.copy(it.ref.pos); } });
    rebuildBlockHL(); renderElementList();
  } });
  state.multiMove = false; document.getElementById('mpMove').classList.remove('mode-on');
  blip(560); markDirty(); renderElementList(); updateHint();
}
document.getElementById('tgBoxSelect').addEventListener('click', function () {
  state.boxSelect = !state.boxSelect;
  this.classList.toggle('mode-on', state.boxSelect);
  if (!state.boxSelect) clearMulti();
  else { clearSelection(); toast('🔲 무대를 드래그해서 여러 요소를 선택하세요'); }
});

// ---------------- 스위치 유틸 ----------------
function setSwitch(el, on) { el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on)); }

// ---------------- 조명 세부 컨트롤 ----------------
const lp = {
  power: document.getElementById('lpPower'), colors: document.getElementById('lpColors'), custom: document.getElementById('lpCustomColor'),
  intensity: document.getElementById('lpIntensity'), intVal: document.getElementById('lpIntVal'), angle: document.getElementById('lpAngle'), angVal: document.getElementById('lpAngVal'),
};
GEL_COLORS.forEach(c => {
  const b = document.createElement('button'); b.className = 'gel'; b.style.background = c; b.title = c;
  b.addEventListener('click', () => {
    const Lg = sel('light'); if (!Lg) return;
    const old = Lg.color;
    Lg.color = c; updateLightVisual(Lg); refreshGel(); markDirty();
    pushUndo({ undo: () => { Lg.color = old; updateLightVisual(Lg); } });
  });
  lp.colors.appendChild(b);
});
function refreshGel() { const cur = state.selected?.kind === 'light' ? state.selected.ref.color : null; [...lp.colors.children].forEach((b, i) => b.classList.toggle('active', GEL_COLORS[i] === cur)); }
function openLightControls(Lg) {
  setSwitch(lp.power, Lg.on);
  lp.intensity.value = Lg.intensity; lp.intVal.textContent = Lg.intensity;
  lp.angle.value = Lg.angle; lp.angVal.textContent = `${Lg.angle}°`; lp.custom.value = Lg.color;
  refreshGel();
}
function sel(kind) { return state.selected?.kind === kind ? state.selected.ref : null; }
lp.power.addEventListener('click', () => { const Lg = sel('light'); if (!Lg) return; Lg.on = !Lg.on; setSwitch(lp.power, Lg.on); updateLightVisual(Lg); markDirty(); pushUndo({ undo: () => { Lg.on = !Lg.on; updateLightVisual(Lg); } }); });
lp.custom.addEventListener('input', () => { const Lg = sel('light'); if (!Lg) return; if (lp.custom._start === undefined) lp.custom._start = Lg.color; Lg.color = lp.custom.value; updateLightVisual(Lg); refreshGel(); markDirty(); });
lp.custom.addEventListener('change', () => { const Lg = sel('light'); const old = lp.custom._start; lp.custom._start = undefined; if (!Lg || old === undefined || old === Lg.color) return; pushUndo({ undo: () => { Lg.color = old; updateLightVisual(Lg); } }); });
lp.intensity.addEventListener('input', () => { const Lg = sel('light'); if (!Lg) return; if (lp.intensity._start === undefined) lp.intensity._start = Lg.intensity; Lg.intensity = +lp.intensity.value; lp.intVal.textContent = Lg.intensity; updateLightVisual(Lg); markDirty(); });
lp.intensity.addEventListener('change', () => { const Lg = sel('light'); const old = lp.intensity._start; lp.intensity._start = undefined; if (!Lg || old === undefined || old === Lg.intensity) return; pushUndo({ undo: () => { Lg.intensity = old; updateLightVisual(Lg); } }); });
lp.angle.addEventListener('input', () => { const Lg = sel('light'); if (!Lg) return; if (lp.angle._start === undefined) lp.angle._start = Lg.angle; Lg.angle = +lp.angle.value; lp.angVal.textContent = `${Lg.angle}°`; updateLightVisual(Lg); markDirty(); });
lp.angle.addEventListener('change', () => { const Lg = sel('light'); const old = lp.angle._start; lp.angle._start = undefined; if (!Lg || old === undefined || old === Lg.angle) return; pushUndo({ undo: () => { Lg.angle = old; updateLightVisual(Lg); } }); });
document.getElementById('lpAim').addEventListener('click', () => { if (!sel('light')) return; state.retargeting = true; setHint('🎯 조명이 비출 곳을 클릭하세요! (오른쪽 클릭 = 취소)'); });

// 블록 종류 변경 그리드
function refreshEpBlockGrid() {
  const grid = document.getElementById('epBlockGrid'); grid.innerHTML = '';
  const s = state.selected; if (s?.kind !== 'block') return;
  const cur = blocks.get(keyOf(s.ref.x, s.ref.y, s.ref.z));
  BLOCK_ORDER.forEach(id => {
    const b = document.createElement('button'); b.className = 'swatch' + (cur?.type === id ? ' active' : ''); b.title = BLOCKS[id].name;
    const img = document.createElement('img'); img.src = BLOCKS[id].thumb; img.alt = BLOCKS[id].name; b.appendChild(img);
    b.addEventListener('click', () => {
      const ss = state.selected; if (ss?.kind !== 'block') return;
      const { x, y, z } = ss.ref;
      const bb = blocks.get(keyOf(x, y, z)); if (!bb || bb.type === id) return;
      const oldType = bb.type, shape = bb.shape, wasBase = bb.base;
      removeBlock(x, y, z); addBlock(x, y, z, id, shape, false, wasBase);
      pushUndo({ undo: () => { removeBlock(x, y, z); addBlock(x, y, z, oldType, shape, false, wasBase); } });
      state.selected = { kind: 'block', ref: { x, y, z } };
      selBox.visible = true;
      refreshEpBlockGrid(); markDirty(); blip(540);
    });
    grid.appendChild(b);
  });
}

// ---------------- 패널 유틸 ----------------
function showPanel(id) { document.getElementById(id).classList.remove('hidden'); }
function hidePanel(id) { document.getElementById(id).classList.add('hidden'); }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => {
  const id = b.dataset.close; hidePanel(id);
  if (id === 'editPanel') clearSelection();
  if (id === 'multiPanel') clearMulti();
  if (id === 'floatList') document.getElementById('viewport').classList.remove('list-open');
}));

// ---------------- 배우 꾸미기 (놓기 전 미리 꾸미기) ----------------
function refreshActorCard() {
  const card = document.getElementById('actorCard');
  const show = state.propCat === 'people' && state.propType === 'actor';
  card.classList.toggle('hidden', !show);
  if (show) buildCustomizerUI(document.getElementById('actorChips'),
    () => state.actorCfg,
    cfg => { state.actorCfg = cfg; refreshPropGhost(); },
    { pose: { list: POSES, get: () => state.actorPose, set: p => { state.actorPose = p; refreshActorCard(); } } });
}
document.getElementById('btnActorRandom').addEventListener('click', () => {
  state.actorCfg = randomActorCfg();
  refreshActorCard(); refreshPropGhost();
  toast('🎲 새로운 모습으로 바꿨어요!');
});

// ---------------- 팔레트 UI ----------------
function buildBlockPalette() {
  const grid = document.getElementById('blockGrid');
  BLOCK_ORDER.forEach(id => {
    const b = document.createElement('button'); b.className = 'swatch' + (id === state.blockType ? ' active' : ''); b.title = BLOCKS[id].name;
    const img = document.createElement('img'); img.src = BLOCKS[id].thumb; img.alt = BLOCKS[id].name; b.appendChild(img);
    b.addEventListener('click', () => {
      state.blockType = id;
      grid.querySelectorAll('.swatch').forEach(s => s.classList.remove('active')); b.classList.add('active');
      if (state.blockShape === 'erase') setBlockShape('cube');
      setHint(`🧱 ${BLOCKS[id].name} — 무대를 클릭해서 놓아요`);
    });
    grid.appendChild(b);
  });
}
const BLOCK_HELP = {
  cube: '바닥이나 블록 위를 <b>클릭</b>하면 블록이 놓여요.',
  slab: '반 높이 블록! 계단이나 낮은 단을 만들 때 좋아요.',
  erase: '지우고 싶은 블록을 <b>클릭</b>하세요. 빨갛게 표시된 블록이 지워져요.',
};
function setBlockShape(shape) {
  state.blockShape = shape;
  document.querySelectorAll('.shape-btn').forEach(s => s.classList.toggle('active', s.dataset.shape === shape));
  document.getElementById('blockHelp').innerHTML = BLOCK_HELP[shape];
}
document.querySelectorAll('.shape-btn').forEach(b => b.addEventListener('click', () => setBlockShape(b.dataset.shape)));

// 사방 객석 무대 바닥 모양 (원/사각형/마름모)
function updateArenaCard() {
  const card = document.getElementById('arenaShapeCard');
  card.classList.toggle('hidden', proj.preset !== 'arena');
  document.querySelectorAll('.arena-shape').forEach(b => b.classList.toggle('active', b.dataset.ashape === proj.arenaShape));
}
function relayArena(shape) {
  if (proj.preset !== 'arena') return;
  const hasBase = [...blocks.values()].some(b => b.base);
  if (shape === proj.arenaShape && hasBase) return;
  removeBaseBlocks();          // 기본 바닥만 다시 깔기 (직접 놓은 블록·소품은 유지)
  proj.arenaShape = shape;
  layStarter('arena');
  updateArenaCard(); markDirty(); renderElementList(); blip(600);
  toast(`무대 바닥을 ${shape === 'circle' ? '원' : shape === 'square' ? '사각형' : '마름모'} 모양으로 바꿨어요!`);
}
document.querySelectorAll('.arena-shape').forEach(b => b.addEventListener('click', () => relayArena(b.dataset.ashape)));

function buildLightPalette() {
  const grid = document.getElementById('lightGrid');
  Object.entries(LIGHT_TYPES).forEach(([id, def]) => {
    const b = document.createElement('button'); b.className = 'pcard' + (id === state.lightType ? ' active' : '');
    b.innerHTML = `<span class="ic">${def.emoji}</span><span><div class="nm">${def.name}</div><div class="ds">${def.desc}</div></span>`;
    b.addEventListener('click', () => { state.lightType = id; grid.querySelectorAll('.pcard').forEach(c => c.classList.remove('active')); b.classList.add('active'); setHint(`${def.emoji} ${def.name} — 비추고 싶은 곳을 클릭하세요`); });
    grid.appendChild(b);
  });
}
function buildPresetGrid() {
  const grid = document.getElementById('presetGrid');
  LIGHT_PRESETS.forEach(p => {
    const b = document.createElement('button'); b.className = 'preset-btn'; b.dataset.preset = p.id;
    b.innerHTML = `<span class="pe">${p.emoji}</span><span class="pn">${p.name}</span><span class="pd">${p.desc}</span>`;
    b.addEventListener('click', () => applyLightPreset(p));
    grid.appendChild(b);
  });
}
document.querySelectorAll('.lm-btn').forEach(b => b.addEventListener('click', () => {
  state.lightMode = b.dataset.lm;
  document.querySelectorAll('.lm-btn').forEach(x => x.classList.toggle('active', x === b));
  document.getElementById('lmPreset').classList.toggle('hidden', state.lightMode !== 'preset');
  document.getElementById('lmFree').classList.toggle('hidden', state.lightMode !== 'free');
}));

function buildPropUI() {
  const cats = document.getElementById('propCats');
  const chip = (id, label, active) => { const c = document.createElement('button'); c.className = 'cat-chip' + (active ? ' active' : ''); c.textContent = label; c.dataset.cat = id; return c; };
  PROP_CATEGORIES.forEach(cat => cats.appendChild(chip(cat.id, `${cat.emoji} ${cat.name}`, cat.id === state.propCat)));
  cats.appendChild(chip('images', '🖼️ 내 이미지', false));
  cats.querySelectorAll('.cat-chip').forEach(c => c.addEventListener('click', () => selectCategory(c.dataset.cat)));
  renderPropGrid();
  refreshActorCard();
}
function selectCategory(catId) {
  state.propCat = catId;
  document.querySelectorAll('#propCats .cat-chip').forEach(c => c.classList.toggle('active', c.dataset.cat === catId));
  const isImg = catId === 'images';
  document.getElementById('propGrid').classList.toggle('hidden', isImg);
  document.getElementById('imagePanel').classList.toggle('hidden', !isImg);
  if (!isImg) renderPropGrid();
  refreshActorCard();
  refreshPropGhost();
}
function renderPropGrid() {
  const grid = document.getElementById('propGrid'); grid.innerHTML = '';
  const cat = PROP_CATEGORIES.find(c => c.id === state.propCat); if (!cat) return;
  cat.items.forEach(def => {
    const b = document.createElement('button'); b.className = 'pcard' + (def.id === state.propType ? ' active' : '');
    b.innerHTML = `<span class="ic">${def.emoji}</span><span><div class="nm">${def.name}</div><div class="ds">${def.desc}</div></span>`;
    b.addEventListener('click', () => { state.propType = def.id; grid.querySelectorAll('.pcard').forEach(c => c.classList.remove('active')); b.classList.add('active'); refreshActorCard(); refreshPropGhost(); setHint(`${def.emoji} ${def.name} — 무대를 클릭해서 놓아요 (R = 방향)`); });
    grid.appendChild(b);
  });
}

// 이미지 업로드
document.getElementById('btnUploadImg').addEventListener('click', () => document.getElementById('imgInput').click());
document.getElementById('imgInput').addEventListener('change', ev => {
  const file = ev.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const src = reader.result; const r = await loadTex(src);
    if (!r) { toast('이미지를 읽을 수 없어요 😢'); return; }
    const id = uid(); uploadedImages.set(id, { src, tex: r.tex, aspect: r.aspect });
    state.activeImage = id; renderImgGrid();
    toast('🖼️ 이미지를 올렸어요! 무대를 클릭해 세워보세요');
  };
  reader.readAsDataURL(file); ev.target.value = '';
});
function renderImgGrid() {
  const grid = document.getElementById('imgGrid'); grid.innerHTML = '';
  uploadedImages.forEach((im, id) => {
    const b = document.createElement('button'); b.className = 'swatch' + (id === state.activeImage ? ' active' : '');
    const img = document.createElement('img'); img.src = im.src; img.style.imageRendering = 'auto'; b.appendChild(img);
    b.addEventListener('click', () => { state.activeImage = id; grid.querySelectorAll('.swatch').forEach(s => s.classList.remove('active')); b.classList.add('active'); setHint('🖼️ 무대를 클릭하면 이미지가 입간판으로 세워져요'); });
    grid.appendChild(b);
  });
}

// 모드 전환
document.querySelectorAll('.mode-tab').forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));

// ---------------- 모바일 하단 시트(도구 패널) ----------------
const sidebarEl = document.getElementById('sidebar');
const sheetHandle = document.getElementById('sheetHandle');
const isMobile = () => window.matchMedia('(max-width: 640px)').matches;
function setSheet(open) {
  sidebarEl.classList.toggle('collapsed', !open);
  sheetHandle?.setAttribute('aria-expanded', String(open));
}
sheetHandle?.addEventListener('click', () => setSheet(sidebarEl.classList.contains('collapsed')));
// 모바일에서 모드 탭을 누르면 도구 시트를 펼쳐서 바로 사용할 수 있게 한다
document.querySelectorAll('.mode-tab').forEach(tab => tab.addEventListener('click', () => { if (isMobile()) setSheet(true); }));
// 휴대폰에서는 처음에 시트를 접어 무대를 먼저 크게 보여준다
if (isMobile()) setSheet(false);

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  document.querySelectorAll('.pal-page').forEach(p => p.classList.toggle('hidden', p.dataset.mode !== mode));
  ghost.visible = false; refreshPropGhost();
  if (mode === 'block' || mode === 'prop') { clearSelection(); clearMulti(); }
  updateHint();
}
const HINTS = {
  view: '👀 드래그 = 둘러보기 · 놓은 것을 클릭하면 선택하고 편집할 수 있어요',
  block: '🧱 클릭 = 블록 놓기 · 드래그 = 시점 돌리기',
  prop: '🪑 소품을 고르고 무대를 클릭하세요 · R = 방향 돌리기',
  light: '💡 세트 버튼 하나면 조명 완성! 한 번 더 누르면 꺼져요',
  perform: '🎬 큐와 음악을 준비하고, 공연 모드를 켜 보세요!',
};
function setHint(t) { document.getElementById('hintText').textContent = t; }
function updateHint() { setHint(HINTS[state.mode]); }

// ---------------- 장면(Scene) 관리 ----------------
function freshScene(name) { return { name, blocks: [], lights: [], props: [], images: [], cues: [] }; }
function serializeScene() {
  return {
    name: proj.scenes[proj.active].name,
    blocks: [...blocks.entries()].map(([k, b]) => { const [x, y, z] = k.split(',').map(Number); return [x, y, z, b.type, b.shape === 'slab' ? 1 : 0, b.base ? 1 : 0]; }),
    lights: lights.map(serializeLight),
    props: props.map(p => ({ type: p.type, x: p.pos.x, y: p.pos.y, z: p.pos.z, rot: p.rot, variant: p.variant, scale: p.scale, cfg: p.cfg, name: p.name, hide: p.hide, pose: p.pose })),
    images: images.map(im => ({ src: im.src, aspect: im.aspect, scale: im.scale, rot: im.rot, name: im.name, hide: im.hide, x: im.pos.x, y: im.pos.y, z: im.pos.z })),
    cues: cues.map(c => ({ name: c.name, lights: c.lights })),
  };
}
function snapshot() { proj.scenes[proj.active] = serializeScene(); }
function clearLive() {
  for (const b of blocks.values()) blockGroup.remove(b.mesh); blocks.clear();
  for (const Lg of [...lights]) { lightGroup.remove(Lg.group); scene.remove(Lg.targetObj); } lights.length = 0;
  for (const P of [...props]) propGroup.remove(P.group); props.length = 0;
  for (const I of [...images]) if (I.group) imageGroup.remove(I.group); images.length = 0;
  undoStack.length = 0; state.selected = null; state.moveMode = false; selBox.visible = false;
  hidePanel('editPanel');
}
function hydrateScene(s) {
  clearLive();
  for (const [x, y, z, type, slab, base] of s.blocks ?? []) addBlock(x, y, z, type, slab ? 'slab' : 'cube', false, !!base);
  for (const l of s.lights ?? []) createLight(l, false);
  for (const p of s.props ?? []) addPropRaw(p.type, p.x, p.y, p.z, p.rot, p.variant, false, { scale: p.scale, cfg: p.cfg, name: p.name, hide: p.hide, pose: p.pose });
  for (const im of s.images ?? []) addImageRaw(im);
  cues = (s.cues ?? []).map(c => ({ name: c.name, lights: c.lights }));
  cueSeq = cues.length + 1;
  cueActive = -1;
  state.activePreset = lights.find(l => l.presetId)?.presetId ?? null;
  refreshPresetButtons();
}
function renderSceneBar() {
  const tabs = document.getElementById('sceneTabs'); tabs.innerHTML = '';
  proj.scenes.forEach((s, i) => {
    const t = document.createElement('div'); t.className = 'scene-tab' + (i === proj.active ? ' active' : '');
    const nm = document.createElement('span'); nm.textContent = s.name; t.appendChild(nm);
    if (proj.scenes.length > 1) { const x = document.createElement('span'); x.className = 'sx'; x.textContent = '✕'; x.title = '이 장면 삭제'; x.addEventListener('click', e => { e.stopPropagation(); deleteScene(i); }); t.appendChild(x); }
    t.addEventListener('click', () => switchScene(i));
    t.addEventListener('dblclick', () => { const nn = prompt('장면 이름을 바꿀까요?', s.name); if (nn) { s.name = nn.slice(0, 16); renderSceneBar(); markDirty(); } });
    tabs.appendChild(t);
  });
}
function switchScene(i) {
  if (i === proj.active) return;
  snapshot(); proj.active = i; hydrateScene(proj.scenes[i]);
  renderSceneBar(); renderElementList(); renderCues(); updateHint();
  toast(`🎬 ${proj.scenes[i].name}(으)로 이동했어요`);
}
function addScene() {
  snapshot();
  const s = freshScene(`${proj.scenes.length + 1}장`); proj.scenes.push(s);
  proj.active = proj.scenes.length - 1; hydrateScene(s); layStarter(proj.preset); snapshot();
  renderSceneBar(); renderElementList(); renderCues(); markDirty();
  toast(`🎬 ${s.name}을(를) 만들었어요!`);
}
function deleteScene(i) {
  if (proj.scenes.length <= 1) return;
  if (!confirm(`"${proj.scenes[i].name}" 장면을 삭제할까요?`)) return;
  if (i === proj.active) { proj.scenes.splice(i, 1); proj.active = Math.max(0, i - 1); hydrateScene(proj.scenes[proj.active]); }
  else { proj.scenes.splice(i, 1); if (proj.active > i) proj.active--; }
  renderSceneBar(); renderElementList(); renderCues(); markDirty();
}
document.getElementById('btnAddScene').addEventListener('click', addScene);

// ---------------- 요소 목록 (사이드바 + 플로팅) ----------------
function renderElementList() {
  renderElementListInto(document.getElementById('elementList'));
  renderElementListInto(document.getElementById('elementListFloat'));
}
function renderElementListInto(box) {
  if (!box) return;
  box.innerHTML = '';
  const section = (title) => { const h = document.createElement('div'); h.className = 'el-group-title'; h.textContent = title; box.appendChild(h); };
  const empty = () => { const e = document.createElement('div'); e.className = 'el-empty'; e.textContent = '아직 없어요'; box.appendChild(e); };
  const icBtn = (icon, title, fn) => {
    const b = document.createElement('button'); b.className = 'ebtn' + (icon === 'delete' ? ' edel' : '');
    b.innerHTML = `<span class="material-icons-outlined">${icon}</span>`; b.title = title;
    b.addEventListener('click', e => { e.stopPropagation(); fn(); });
    return b;
  };
  const row = (kind, ref, icon, name, i) => {
    const r = document.createElement('div');
    r.className = 'el-row' + (state.selected?.ref === ref ? ' sel' : '') + (ref.hide ? ' ghosted' : '');
    r.innerHTML = `<span class="eic">${icon}</span><span class="enm">${ref.name ?? name}</span>`;
    r.appendChild(icBtn('edit', '이름 바꾸기', () => {
      const nn = prompt('이름을 바꿀까요?', ref.name ?? name);
      if (nn) { ref.name = nn.slice(0, 20); markDirty(); renderElementList(); if (state.selected?.ref === ref) openEditPanel(); }
    }));
    r.appendChild(icBtn(ref.hide ? 'visibility_off' : 'visibility', ref.hide ? '보이기' : '숨기기', () => {
      ref.hide = !ref.hide;
      if (kind === 'light') updateLightVisual(ref); else ref.group.visible = !ref.hide;
      markDirty(); renderElementList();
    }));
    r.appendChild(icBtn('content_copy', '복제', () => { selectElement(kind, ref); duplicateSelected(); }));
    r.appendChild(icBtn('delete', '삭제', () => {
      if (kind === 'light') deleteLight(ref); else if (kind === 'prop') deleteProp(ref); else deleteImage(ref);
      markDirty(); renderElementList();
    }));
    r.addEventListener('click', () => selectElement(kind, ref));
    box.appendChild(r);
  };
  section(`💡 조명 (${lights.length})`);
  if (!lights.length) empty();
  lights.forEach((Lg, i) => row('light', Lg, LIGHT_TYPES[Lg.type].emoji, `${LIGHT_TYPES[Lg.type].name} ${i + 1}${Lg.on ? '' : ' (꺼짐)'}`, i));
  section(`🪑 소품 (${props.length})`);
  if (!props.length) empty();
  props.forEach(P => row('prop', P, PROP_INFO[P.type]?.emoji ?? '🔷', PROP_INFO[P.type]?.name ?? P.type));
  section(`🖼️ 이미지 (${images.length})`);
  if (!images.length) empty();
  images.forEach((I, i) => row('image', I, '🖼️', `내 이미지 ${i + 1}`));
  section(`🧱 블록 (${blocks.size})`);
  const clr = document.createElement('div'); clr.className = 'el-row';
  clr.innerHTML = `<span class="eic">🧱</span><span class="enm">블록 모두 지우기</span>`;
  const cd = document.createElement('button'); cd.className = 'ebtn edel'; cd.innerHTML = '<span class="material-icons-outlined">delete</span>';
  cd.addEventListener('click', e => {
    e.stopPropagation();
    if (!blocks.size) return;
    const targets = [...blocks].filter(([k]) => { const [x, y, z] = k.split(',').map(Number); return !baseLocked(x, y, z); });
    if (!targets.length) { toast('지울 블록이 없어요 — 기본 무대는 잠겨 있어요'); return; }
    if (confirm('이 장면의 블록을 모두 지울까요?' + (state.baseErasable ? '' : '\n(기본 무대 바닥은 잠겨 있어 남겨 둬요)'))) {
      for (const [k] of targets) { const [x, y, z] = k.split(',').map(Number); removeBlock(x, y, z); }
      markDirty(); renderElementList();
    }
  });
  clr.appendChild(cd); box.appendChild(clr);
}

// 플로팅 목록 열기/접기/닫기
const floatList = document.getElementById('floatList');
document.getElementById('btnList').addEventListener('click', () => {
  const opening = floatList.classList.contains('hidden');
  floatList.classList.toggle('hidden', !opening);
  document.getElementById('viewport').classList.toggle('list-open', opening);
  if (opening) renderElementList();
});
document.getElementById('flCollapse').addEventListener('click', function () {
  floatList.classList.toggle('collapsed');
  this.querySelector('.material-icons-outlined').textContent = floatList.classList.contains('collapsed') ? 'expand_more' : 'expand_less';
});

// ---------------- 조명 큐 ----------------
let cueActive = -1, cuePlaying = false, cueHoldTimer = null;
function captureCue() {
  if (!lights.length) { toast('먼저 조명을 만들어 주세요! (조명 탭)'); return; }
  cues.push({ name: `큐 ${cueSeq++}`, lights: lights.map(serializeLight) });
  renderCues(); markDirty(); toast('🎬 지금 조명을 큐로 저장했어요!'); blip(700);
}
function renderCues() {
  const list = document.getElementById('cueList'); list.innerHTML = '';
  if (!cues.length) { const e = document.createElement('div'); e.className = 'cue-empty'; e.textContent = '아직 큐가 없어요. 조명을 만들고 위 버튼을 눌러보세요!'; list.appendChild(e); return; }
  cues.forEach((c, i) => {
    const chip = document.createElement('div'); chip.className = 'cue-chip' + (i === cueActive ? ' active' : '');
    chip.innerHTML = `<span class="cnm">${i + 1}. ${c.name} (💡${c.lights.length})</span>`;
    const x = document.createElement('span'); x.className = 'cx'; x.innerHTML = '<span class="material-icons-outlined">close</span>'; x.title = '큐 삭제';
    x.addEventListener('click', e => { e.stopPropagation(); cues.splice(i, 1); if (cueActive >= i) cueActive--; renderCues(); markDirty(); });
    chip.appendChild(x); chip.addEventListener('click', () => goToCue(i)); list.appendChild(chip);
  });
}
function goToCue(index, fromPlay = false) {
  if (index < 0 || index >= cues.length) return;
  if (!fromPlay) { cuePlaying = false; clearTimeout(cueHoldTimer); }
  const fade = +document.getElementById('cueFade').value;
  state.cueTransition = { phase: 'out', t: 0, dur: Math.max(0.15, fade * 0.5), target: index };
}
function finishCueSwap(index) {
  for (const Lg of [...lights]) { lightGroup.remove(Lg.group); scene.remove(Lg.targetObj); } lights.length = 0;
  state.cueMul = 0;
  for (const data of cues[index].lights) createLight(data, false);
  applyCueScale();
  cueActive = index; renderCues(); renderElementList();
  state.activePreset = lights.find(l => l.presetId)?.presetId ?? null;
  refreshPresetButtons();
  if (state.selected?.kind === 'light') clearSelection();
}
function playCues() {
  if (!cues.length) { toast('먼저 큐를 저장해 주세요'); return; }
  cuePlaying = true; cueActive = -1; advancePlay();
  toast('▶️ 큐를 순서대로 재생해요');
}
function advancePlay() {
  if (!cuePlaying) return;
  const next = cueActive + 1;
  if (next >= cues.length) { cuePlaying = false; toast('🎬 큐 재생을 마쳤어요'); return; }
  goToCue(next, true);
}
document.getElementById('cueCapture').addEventListener('click', captureCue);
document.getElementById('cuePlay').addEventListener('click', playCues);
document.getElementById('cueFade').addEventListener('input', ev => { document.getElementById('cueFadeVal').textContent = `${(+ev.target.value).toFixed(1)}초`; });

// ---------------- 음악 (사용자 음악) ----------------
const music = (() => {
  const audio = new Audio(); audio.loop = false;
  let mode = 'file', ytPlayer = null, ytReady = false, loop = false, vol = 0.8, playing = false;
  let ytApiLoading = false; let ytCbs = [];
  audio.volume = vol;
  const nameEl = document.getElementById('audioName');
  const playIc = document.querySelector('#mPlay .material-icons-outlined');
  function setPlayIcon() { playIc.textContent = playing ? 'pause' : 'play_arrow'; }
  function ensureYT(cb) {
    if (window.YT && window.YT.Player) return cb();
    ytCbs.push(cb);
    if (!ytApiLoading) { ytApiLoading = true; const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev && prev(); ytCbs.forEach(f => f()); ytCbs = []; }; }
  }
  function parseId(url) { const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : (url.trim().length === 11 ? url.trim() : null); }
  return {
    loadFile(file) {
      mode = 'file'; if (ytPlayer) try { ytPlayer.stopVideo(); } catch {}
      audio.src = URL.createObjectURL(file); audio.loop = loop; audio.volume = vol;
      nameEl.textContent = '🎧 ' + file.name; audio.play().then(() => { playing = true; setPlayIcon(); }).catch(() => {});
    },
    loadYT(url) {
      const id = parseId(url); if (!id) { toast('유튜브 주소를 확인해 주세요'); return; }
      mode = 'yt'; try { audio.pause(); } catch {}
      ensureYT(() => {
        if (!ytPlayer) {
          ytPlayer = new YT.Player('ytHost', { height: '1', width: '1', videoId: id, playerVars: { autoplay: 1, loop: loop ? 1 : 0, playlist: id }, events: { onReady: e => { ytReady = true; e.target.setVolume(vol * 100); e.target.playVideo(); playing = true; setPlayIcon(); } } });
        } else { ytPlayer.loadVideoById(id); ytPlayer.setVolume(vol * 100); playing = true; setPlayIcon(); }
        this.ytId = id;
      });
      this.ytId = id;
    },
    toggle() {
      if (mode === 'file') { if (audio.paused) { audio.play(); playing = true; } else { audio.pause(); playing = false; } }
      else if (ytPlayer && ytReady) { const st = ytPlayer.getPlayerState(); if (st === 1) { ytPlayer.pauseVideo(); playing = false; } else { ytPlayer.playVideo(); playing = true; } }
      setPlayIcon();
    },
    setLoop(v) { loop = v; audio.loop = v; },
    setVol(v) { vol = v; audio.volume = v; if (ytPlayer && ytReady) try { ytPlayer.setVolume(v * 100); } catch {} },
    reset() { try { audio.pause(); } catch {} if (ytPlayer) try { ytPlayer.stopVideo(); } catch {} playing = false; setPlayIcon(); this.ytId = null; nameEl.textContent = '아직 올린 음악이 없어요'; },
    getState() { return { yt: this.ytId || null, loop, vol }; },
    restore(m) { if (!m) return; loop = m.loop ?? false; vol = m.vol ?? 0.8; audio.volume = vol; document.getElementById('mVol').value = vol * 100; document.getElementById('mLoop').classList.toggle('on', loop); if (m.yt) document.getElementById('ytUrl').value = `https://youtu.be/${m.yt}`; },
    ytId: null,
  };
})();
document.getElementById('btnUploadAudio').addEventListener('click', () => document.getElementById('audioInput').click());
document.getElementById('audioInput').addEventListener('change', ev => { const f = ev.target.files[0]; if (f) { music.loadFile(f); toast('🎵 음악을 재생해요!'); } ev.target.value = ''; });
document.getElementById('btnLoadYt').addEventListener('click', () => { const u = document.getElementById('ytUrl').value; if (u) { music.loadYT(u); markDirty(); } });
document.getElementById('mPlay').addEventListener('click', () => music.toggle());
document.getElementById('mLoop').addEventListener('click', function () { const on = !this.classList.contains('on'); this.classList.toggle('on', on); music.setLoop(on); });
document.getElementById('mVol').addEventListener('input', ev => music.setVol(ev.target.value / 100));
document.querySelectorAll('.mtab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.mtab').forEach(x => x.classList.toggle('active', x === t));
  document.getElementById('mFile').classList.toggle('hidden', t.dataset.mtab !== 'file');
  document.getElementById('mYt').classList.toggle('hidden', t.dataset.mtab !== 'yt');
}));

// ---------------- 상단 바 ----------------
document.getElementById('btnUndo').addEventListener('click', undo);
const saveMenu = document.getElementById('saveMenu');
document.getElementById('btnSaveMenu').addEventListener('click', ev => { ev.stopPropagation(); saveMenu.classList.toggle('hidden'); });
document.addEventListener('click', ev => { if (!ev.target.closest('.menu-wrap')) saveMenu.classList.add('hidden'); });
saveMenu.addEventListener('click', () => saveMenu.classList.add('hidden'));

document.getElementById('houseSlider').addEventListener('input', ev => { state.house = ev.target.value / 100; proj.house = state.house; applyHouseLights(); });
document.getElementById('tgZones').addEventListener('click', function () {
  state.zones = !state.zones; setSwitch(this, state.zones);
  if (zoneMesh) zoneMesh.visible = state.zones;
  if (state.zones) toast('📍 무대 구역이 보여요 — SR/SL은 배우 기준이에요!');
});
document.getElementById('tgSeats').addEventListener('click', function () {
  state.seats = !state.seats; setSwitch(this, state.seats);
  seatGroup.visible = state.seats;
  if (!state.seats && state.selected?.kind === 'seats') clearSelection();
});
document.getElementById('tgBaseErase').addEventListener('click', function () {
  state.baseErasable = !state.baseErasable; setSwitch(this, state.baseErasable);
  if (state.selected?.kind === 'block') openEditPanel(); // 삭제 버튼 표시 갱신
  markDirty();
  toast(state.baseErasable ? '🔓 이제 기본 무대도 지울 수 있어요' : '🔒 기본 무대를 다시 잠갔어요');
});
document.getElementById('tgMarks').addEventListener('click', function () {
  state.marks = !state.marks; setSwitch(this, state.marks);
  if (marksGroup) marksGroup.visible = state.marks;
  document.getElementById('markCenterRow').classList.toggle('hidden', !state.marks);
  if (!state.marks) { state.settingCenter = false; document.getElementById('btnSetCenter').classList.remove('mode-on'); }
  if (state.marks) toast('📏 간격 눈금이 켜졌어요 — 센터를 직접 지정할 수도 있어요');
});
document.getElementById('btnSetCenter').addEventListener('click', function () {
  state.settingCenter = !state.settingCenter;
  this.classList.toggle('mode-on', state.settingCenter);
  setHint(state.settingCenter ? '🎯 무대를 클릭하면 그 지점이 눈금의 센터(0)가 돼요' : '');
});
document.getElementById('btnCenterAuto').addEventListener('click', () => {
  state.markCenter = null; state.settingCenter = false;
  document.getElementById('btnSetCenter').classList.remove('mode-on');
  buildMarks(); markDirty(); toast('↺ 센터를 무대 기본 중앙으로 되돌렸어요');
});

const performPill = document.getElementById('performPill');
performPill.addEventListener('click', () => {
  state.perform = !state.perform;
  performPill.classList.toggle('on', state.perform);
  performPill.textContent = state.perform ? '☀️ 공연 끝내기' : '🌙 공연 모드';
  applyHouseLights();
  lights.forEach(updateLightVisual);
  toast(state.perform ? '🌙 공연 시작! 여러분의 조명이 무대를 밝혀요' : '☀️ 다시 만들기 모드로 돌아왔어요');
});

document.getElementById('stageSelect').addEventListener('change', ev => {
  const id = ev.target.value;
  if (id === proj.preset) return;
  if (!confirm(`무대를 "${PRESETS[id].name}"(으)로 바꿀까요?\n기본 무대는 새 모양으로 바뀌고, 직접 놓은 소품·조명·블록은 그대로 남아요.`)) { ev.target.value = proj.preset; return; }
  if (state.selected?.kind === 'seats') clearSelection();
  proj.preset = id; proj.seatTransform = { x: 0, z: 0, rot: 0 }; state.markCenter = null;
  removeBaseBlocks();          // 이전 무대 기본 바닥 제거 (사용자 블록은 유지)
  buildEnvironment(id);
  layStarter(id);              // 새 무대 기본 바닥 깔기
  markDirty(); renderElementList(); toast(`${PRESETS[id].emoji} ${PRESETS[id].name}로 바꿨어요!`);
});

document.getElementById('btnShot').addEventListener('click', () => {
  renderer.render(scene, camera);
  const a = document.createElement('a'); a.href = renderer.domElement.toDataURL('image/png'); a.download = `my-stage-${Date.now()}.png`; a.click();
  toast('📸 찰칵! 사진을 저장했어요');
});

// ---------------- 저장 / 불러오기 ----------------
// v3: 인물 자세·움직임(pose), 확장 꾸미기(cfg), 화면 고정(cameraLocked) 추가.
// v2 이하 파일도 그대로 불러온다 — 빠진 값은 안전한 기본값으로 채운다(migrateProject).
function serializeProject() { snapshot(); return { v: 3, preset: proj.preset, house: proj.house, active: proj.active, scenes: proj.scenes, music: music.getState(), seatTransform: proj.seatTransform, arenaShape: proj.arenaShape, marks: state.marks, markCenter: state.markCenter, baseErasable: state.baseErasable, cameraLocked: state.cameraLocked }; }
// 이전 버전 데이터를 새 구조로 변환 (사라지는 요소가 없도록 안전하게)
function migrateProject(data) {
  for (const sc of data.scenes ?? []) {
    for (const p of sc.props ?? []) {
      if (p.pose == null) p.pose = DEFAULT_POSE;                 // 자세 기본값
      if (isPerson(p.type)) p.cfg = normalizeCfg(p.cfg, p.type); // 빠진 꾸미기 항목 채우기
    }
  }
  return data;
}
function restoreProject(data) {
  if (!data) return false;
  if (data.preset === 'outdoor') data.preset = 'outdoor_forest';
  if (!PRESETS[data.preset]) return false;
  migrateProject(data);
  proj.preset = data.preset; proj.house = data.house ?? 0.7; state.house = proj.house;
  proj.seatTransform = data.seatTransform ?? { x: 0, z: 0, rot: 0 };
  proj.arenaShape = data.arenaShape ?? 'circle';
  state.marks = !!data.marks; setSwitch(document.getElementById('tgMarks'), state.marks);
  state.baseErasable = !!data.baseErasable; setSwitch(document.getElementById('tgBaseErase'), state.baseErasable);
  setCameraLock(!!data.cameraLocked, true);
  state.markCenter = data.markCenter ?? null;
  document.getElementById('markCenterRow').classList.toggle('hidden', !state.marks);
  document.getElementById('houseSlider').value = proj.house * 100;
  proj.scenes = (data.scenes && data.scenes.length) ? data.scenes : [freshScene('1장')];
  proj.active = Math.min(data.active ?? 0, proj.scenes.length - 1);
  buildEnvironment(proj.preset);
  if (marksGroup) marksGroup.visible = state.marks;
  hydrateScene(proj.scenes[proj.active]);
  applyHouseLights(); music.restore(data.music);
  renderSceneBar(); renderElementList(); renderCues();
  state.dirty = false; return true;
}
function saveLocal(silent = false) {
  if (!proj.scenes.length) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(serializeProject())); if (!silent) toast('💾 저장했어요!'); }
  catch { if (!silent) toast('저장 공간이 부족해요 😢 — 파일로 내보내기를 이용해 보세요'); }
}
document.getElementById('btnSave').addEventListener('click', () => saveLocal());
document.getElementById('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(serializeProject(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-stage.json'; a.click(); URL.revokeObjectURL(a.href);
  toast('📤 파일로 내보냈어요 — 친구와 나눠 보세요!');
});
// ---------------- 링크로 공유 (자체 완결형: 데이터를 압축해 URL에 담음) ----------------
// 서버가 없는 정적 웹앱이라 데이터를 URL에 넣는다. 링크를 최대한 짧게 하려고
// (1) JSON을 deflate로 압축하고 (2) URL-safe base64로 인코딩해 위치 해시(#p=)에 담는다.
function bytesToB64url(bytes) {
  let bin = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s); const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a;
}
const canCompress = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
async function deflate(str) {
  const cs = new CompressionStream('deflate-raw');
  const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(str)); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
async function inflate(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter(); w.write(bytes); w.close();
  return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
}
async function buildShareLink() {
  const json = JSON.stringify(serializeProject());
  let payload, scheme;
  if (canCompress) { payload = bytesToB64url(await deflate(json)); scheme = 'p'; }        // 압축본
  else { payload = bytesToB64url(new TextEncoder().encode(json)); scheme = 'u'; }           // 압축 미지원 폴백
  const base = location.origin + location.pathname;
  return { url: `${base}#${scheme}=${payload}`, jsonLen: json.length };
}
async function loadFromHash() {
  const h = location.hash || '';
  const m = h.match(/^#(p|u)=(.+)$/);
  if (!m) return false;
  try {
    const bytes = b64urlToBytes(m[2]);
    const json = m[1] === 'p' ? await inflate(bytes) : new TextDecoder().decode(bytes);
    const ok = restoreProject(JSON.parse(json));
    if (ok) { history.replaceState(null, '', location.pathname); return true; } // 주소창 깔끔하게
  } catch { toast('공유 링크를 읽을 수 없어요 😢'); }
  return false;
}
document.getElementById('btnShareLink').addEventListener('click', async () => {
  try {
    const { url, jsonLen } = await buildShareLink();
    let copied = false;
    try { await navigator.clipboard.writeText(url); copied = true; } catch { /* 권한 없음 */ }
    if (url.length > 16000) toast('🔗 링크가 만들어졌지만 조금 길어요 (사진을 많이 넣으면 링크가 길어져요). 긴 작품은 파일 내보내기를 추천해요');
    else if (copied) toast('🔗 공유 링크를 복사했어요! 붙여넣기 해서 나눠 보세요');
    else toast('🔗 링크가 만들어졌어요 — 아래 상자에서 복사하세요');
    if (!copied) showShareBox(url);
    void jsonLen;
  } catch { toast('링크를 만들 수 없어요 😢 — 파일로 내보내기를 이용해 보세요'); }
});
// 클립보드 복사가 막힌 환경을 위한 수동 복사 상자
function showShareBox(url) {
  let box = document.getElementById('shareBox');
  if (!box) {
    box = document.createElement('div'); box.id = 'shareBox'; box.className = 'share-box';
    box.innerHTML = '<div class="sb-head">🔗 이 링크를 복사해 나눠 보세요<button class="sb-x" title="닫기">✕</button></div><textarea readonly rows="3"></textarea>';
    document.body.appendChild(box);
    box.querySelector('.sb-x').addEventListener('click', () => box.classList.add('hidden'));
  }
  box.classList.remove('hidden');
  const ta = box.querySelector('textarea'); ta.value = url; ta.focus(); ta.select();
}
document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', ev => {
  const file = ev.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { if (restoreProject(JSON.parse(reader.result))) toast('📥 작품을 불러왔어요!'); else toast('파일을 읽을 수 없어요 😢'); } catch { toast('파일을 읽을 수 없어요 😢'); } };
  reader.readAsText(file); ev.target.value = '';
});
function markDirty() { state.dirty = true; }
setInterval(() => { if (state.dirty) { saveLocal(true); state.dirty = false; } }, 20000);
window.addEventListener('beforeunload', () => { if (proj.scenes.length) saveLocal(true); });

// ---------------- 배움터 ----------------
const eduModal = document.getElementById('eduModal'), eduTabs = document.getElementById('eduTabs'), eduContent = document.getElementById('eduContent');
EDU_TABS.forEach((tab, i) => {
  const b = document.createElement('button'); b.textContent = tab.title;
  b.addEventListener('click', () => { eduTabs.querySelectorAll('button').forEach(x => x.classList.remove('active')); b.classList.add('active'); eduContent.innerHTML = tab.html; eduContent.scrollTop = 0; });
  if (i === 0) { b.classList.add('active'); eduContent.innerHTML = tab.html; }
  eduTabs.appendChild(b);
});
document.getElementById('btnEdu').addEventListener('click', () => eduModal.classList.remove('hidden'));
document.getElementById('eduClose').addEventListener('click', () => eduModal.classList.add('hidden'));
eduModal.addEventListener('click', ev => { if (ev.target === eduModal) eduModal.classList.add('hidden'); });

// ---------------- 시작 화면 & 튜토리얼 ----------------
const welcome = document.getElementById('welcomeModal'), cards = document.getElementById('welcomeCards');
const tutModal = document.getElementById('tutorialModal');
function showTutorial() { tutModal.classList.remove('hidden'); }
document.getElementById('tutClose').addEventListener('click', () => { tutModal.classList.add('hidden'); try { localStorage.setItem(TUT_KEY, '1'); } catch {} });
document.getElementById('btnHelp').addEventListener('click', showTutorial);

Object.entries(PRESETS).forEach(([id, p]) => {
  const b = document.createElement('button'); b.className = 'scard';
  b.innerHTML = `<span class="em">${p.emoji}</span><span class="nm">${p.name}</span><span class="ds">${p.desc}</span>`;
  b.addEventListener('click', () => {
    newProject(id); welcome.classList.add('hidden');
    toast(`${p.emoji} ${p.name}에 온 걸 환영해요!`);
    try { if (!localStorage.getItem(TUT_KEY)) showTutorial(); } catch { showTutorial(); }
  });
  cards.appendChild(b);
});
function newProject(id) {
  proj.preset = id; proj.house = 0.7; state.house = 0.7; proj.active = 0; proj.scenes = [freshScene('1장')];
  proj.seatTransform = { x: 0, z: 0, rot: 0 }; proj.arenaShape = 'circle'; state.markCenter = null;
  music.reset(); buildEnvironment(id); hydrateScene(proj.scenes[0]); layStarter(id); snapshot();
  renderSceneBar(); renderElementList(); renderCues(); applyHouseLights();
}
try {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) { const btn = document.getElementById('btnContinue'); btn.classList.remove('hidden'); btn.addEventListener('click', () => { if (restoreProject(JSON.parse(saved))) { welcome.classList.add('hidden'); toast('지난 작품을 불러왔어요! 이어서 만들어 보세요 ✨'); } }); }
} catch { /* localStorage 불가 */ }

// ---------------- 카메라 시점 ----------------
const VIEWS = {
  audience: { pos: [0.5, 5, 20], tgt: [0.5, 3, -7] }, stage: { pos: [0.5, 3.6, -6], tgt: [0.5, 2.5, 18] },
  bird: { pos: [0.5, 34, 10], tgt: [0.5, 0, -4] }, booth: { pos: [0.5, 11, 24], tgt: [0.5, 2, -7] },
};
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  if (camRig.isLocked()) { toast('🔒 화면이 고정되어 있어요 — 먼저 화면 고정을 꺼 주세요'); return; }
  camRig.fitView(VIEWS[b.dataset.view]);
}));

// ---------------- 화면 고정 · 확대/축소 · 화면 맞추기 ----------------
function setCameraLock(on, silent = false) {
  state.cameraLocked = on;
  camRig.setLocked(on);
  setSwitch(document.getElementById('tgCamLock'), on);
  document.getElementById('camLockPill').classList.toggle('hidden', !on);
  document.querySelectorAll('.cam-btn.zoomable').forEach(b => b.classList.toggle('disabled', on));
  if (silent) return;
  if (on) toast('🔒 화면을 고정했어요 — 회전·이동·확대가 잠겼어요');
  else toast('🔓 화면 고정을 껐어요 — 다시 자유롭게 움직일 수 있어요');
}
document.getElementById('tgCamLock').addEventListener('click', () => setCameraLock(!state.cameraLocked));
document.getElementById('camLockPill').addEventListener('click', () => setCameraLock(false));
document.getElementById('camZoomIn').addEventListener('click', () => camRig.zoomBy(0.8));
document.getElementById('camZoomOut').addEventListener('click', () => camRig.zoomBy(1.25));
document.getElementById('camFit').addEventListener('click', () => {
  if (camRig.isLocked()) { toast('🔒 화면이 고정되어 있어요 — 먼저 화면 고정을 꺼 주세요'); return; }
  camRig.fitView(HOME_VIEW); toast('🎯 무대 중앙으로 화면을 맞췄어요');
});

// ---------------- 키보드 ----------------
window.addEventListener('keydown', ev => {
  if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.target.tagName === 'TEXTAREA') return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo(); return; }
  switch (ev.key) {
    case '1': setMode('view'); break; case '2': setMode('block'); break; case '3': setMode('prop'); break; case '4': setMode('light'); break; case '5': setMode('perform'); break;
    case 'r': case 'R':
      if (state.mode === 'prop') { state.propRot = (state.propRot + ROT_STEP) % (Math.PI * 2); if (propGhost) propGhost.rotation.y = state.propRot; }
      else if (state.selected && (state.selected.kind === 'prop' || state.selected.kind === 'image' || state.selected.kind === 'seats')) rotateSelected();
      break;
    case 'Delete': case 'Backspace': if (state.selected && state.selected.kind !== 'seats') { ev.preventDefault(); deleteSelected(); } break;
    case 'Escape': clearSelection(); clearMulti(); if (state.settingCenter) { state.settingCenter = false; document.getElementById('btnSetCenter').classList.remove('mode-on'); } updateHint(); break;
  }
});

// ---------------- 효과음 ----------------
let audioCtx = null;
function blip(freq) {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.045, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.13);
  } catch { /* 소리 미지원 */ }
}

// ---------------- 토스트 ----------------
function toast(msg) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; document.getElementById('toasts').appendChild(el); setTimeout(() => el.remove(), 3000); }

// ---------------- 루프 ----------------
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  resize();
  const t = clock.getElapsedTime(), dt = Math.min(0.05, clock.getDelta());

  for (const fn of envAnims) fn(t, dt);

  // 인물 자세·움직임 갱신 (골격이 있는 인물만)
  for (const P of props) {
    if (P.group?.userData?.rig) applyPose(P.group, P.pose, t);
  }

  for (const Lg of lights) {
    if (Lg.type !== 'moving' || !Lg.on) continue;
    const r = 2.6;
    Lg.target.x = Lg.pos.x + Math.cos(t * 0.9 + Lg.phase) * r;
    Lg.target.z = Lg.pos.z - 3 + Math.sin(t * 0.9 + Lg.phase) * r;
    const col = new THREE.Color().setHSL((t * 0.08 + Lg.phase / 6) % 1, 0.85, 0.6);
    Lg.color = `#${col.getHexString()}`; Lg.spot.color.copy(col); Lg.lens.material.color.copy(col); Lg.cone.material.color.copy(col);
    orientLight(Lg);
  }

  if (state.cueTransition) {
    const tr = state.cueTransition; tr.t += dt / tr.dur;
    if (tr.phase === 'out') {
      state.cueMul = Math.max(0, 1 - tr.t); applyCueScale();
      if (tr.t >= 1) { finishCueSwap(tr.target); tr.phase = 'in'; tr.t = 0; }
    } else {
      state.cueMul = Math.min(1, tr.t); applyCueScale();
      if (tr.t >= 1) { state.cueMul = 1; applyCueScale(); state.cueTransition = null; if (cuePlaying) cueHoldTimer = setTimeout(advancePlay, 2600); }
    }
  }

  camRig.update();
  controls.update();
  renderer.render(scene, camera);
}

// ---------------- 시작 ----------------
buildBlockPalette(); buildLightPalette(); buildPresetGrid(); buildPropUI(); renderImgGrid();
updateHint();
newProject('proscenium');
resize(); animate();

// 개발용 소품 형태 점검 — window.__validateProps() 또는 URL ?dev=1
window.__validateProps = () => import('./model-validation.js')
  .then(m => m.runModelValidation({ scene, buildProp, categories: PROP_CATEGORIES }));
const devParams = new URLSearchParams(location.search);
if (devParams.has('dev')) {
  window.__dev = { scene, props, THREE, camRig, addPropRaw, applyPose, blocks, proj, PRESETS, stageFrame, buildShareLink, loadFromHash, serializeProject, get selected() { return state.selected; } };
}
if (devParams.has('validate')) window.__validateProps();

// 공유 링크(#p=/#u=)로 열렸으면 그 작품을 불러오고 시작 화면을 건너뛴다
loadFromHash().then(ok => { if (ok) { welcome.classList.add('hidden'); toast('🔗 공유된 작품을 불러왔어요!'); } });
