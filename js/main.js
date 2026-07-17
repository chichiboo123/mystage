// ============================================================
// My Stage 🌟 — 어린이·청소년을 위한 3D 무대 디자인 앱
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBlockTypes } from './blocks.js';
import { PROP_CATEGORIES, PROP_INFO, buildProp } from './props.js';
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
  lightType: 'spot', lightMode: 'preset',
  propCat: 'people', propType: 'actor', propRot: 0, propVariant: 0,
  activeImage: null,
  perform: false, zones: false, seats: true, house: 0.7,
  selected: null, retargeting: false, dirty: false,
  cueMul: 1, cueTransition: null,
};

const proj = { preset: 'proscenium', house: 0.7, active: 0, scenes: [] };

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
let envLightCfg = { bg: 0x17181d, hemiSky: 0xbfd4ff };

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
const envGroup = new THREE.Group();
const blockGroup = new THREE.Group();
const propGroup = new THREE.Group();
const lightGroup = new THREE.Group();
const imageGroup = new THREE.Group();
const seatGroup = new THREE.Group();
scene.add(envGroup, blockGroup, propGroup, lightGroup, imageGroup, seatGroup);

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

function addBlock(x, y, z, type, shape = 'cube', record = false) {
  if (!inBounds(x, y, z) || blocks.has(keyOf(x, y, z)) || !BLOCKS[type]) return false;
  const mesh = new THREE.Mesh(shape === 'slab' ? slabGeo : cubeGeo, BLOCKS[type].mat);
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  mesh.castShadow = true; mesh.receiveShadow = true;
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
// 야자수 (바닷가 테마)
function makePalm(x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.12 - i * 0.015, 0.15 - i * 0.015, 0.8, 8), envMat('#8a6a3a'));
    seg.position.set(i * 0.12, 0.4 + i * 0.75, 0);
    seg.rotation.z = -0.1;
    g.add(seg);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.4), envMat('#2f7d3a'));
    leaf.position.set(0.45 + Math.cos(a) * 0.8, 3.3 + Math.sin(i) * 0.1, Math.sin(a) * 0.8);
    leaf.lookAt(0.45, 3.0, 0);
    leaf.rotation.z += 0.35;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  envGroup.add(g);
}
// 별하늘 (우주 테마)
function makeStars() {
  const n = 900;
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
function buildSeats(list) {
  seatGroup.clear();
  if (!list.length) return;
  const seatG = new THREE.BoxGeometry(0.75, 0.14, 0.7); seatG.translate(0, 0.42, 0);
  // 등받이는 -Z 쪽 — 의자가 로컬 +Z(무대 반대편의 반대, 즉 회전값 기준 정면)를 바라보게 한다
  const backG = new THREE.BoxGeometry(0.75, 0.62, 0.12); backG.translate(0, 0.75, -0.3);
  const legG = new THREE.BoxGeometry(0.6, 0.36, 0.55); legG.translate(0, 0.18, 0);
  const merged = mergeGeometries([seatG, backG, legG]);
  const inst = new THREE.InstancedMesh(merged, envMat('#7e2432', { roughness: 0.8 }), list.length);
  const dummy = new THREE.Object3D();
  list.forEach((s, i) => { dummy.position.set(s.x, s.y, s.z); dummy.rotation.set(0, s.rot, 0); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix); });
  inst.castShadow = true; inst.receiveShadow = true; seatGroup.add(inst);
}
function platform(x0, x1, z0, z1, topType = 'wood', baseType = 'darkwood', h = 2) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = 0; y < h; y++)
    addBlock(x, y, z, y === h - 1 ? topType : baseType);
}

// ---------------- 무대 프리셋 ----------------
function outdoorPreset(theme) {
  const cfg = {
    forest: { name: '야외 무대 · 숲속', emoji: '🌲', desc: '나무가 우거진 숲속 축제 무대', env: { bg: 0x87b8e8, hemiSky: 0xbfe0ff } },
    sea:    { name: '야외 무대 · 바닷가', emoji: '🌊', desc: '파도가 반짝이는 바닷가 무대', env: { bg: 0x8fd2ee, hemiSky: 0xd6f2ff } },
    space:  { name: '야외 무대 · 우주', emoji: '🚀', desc: '별이 쏟아지는 우주 기지 무대', env: { bg: 0x070811, hemiSky: 0x5a6a9a } },
  }[theme];
  return {
    name: cfg.name, emoji: cfg.emoji, desc: cfg.desc,
    stageBounds: { x0: -8, x1: 9, z0: -12, z1: -1, y: 2 }, stageCenter: new THREE.Vector3(0.5, 2, -6.5),
    gridY: 8.6, env: cfg.env,
    build() {
      if (theme === 'forest') {
        const grassTex = BLOCKS.grass.mat.map.clone(); grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(60, 60); grassTex.needsUpdate = true;
        makeFloor('#4f9e3f', grassTex);
        for (const [x, z] of [[-9, -13], [10, -13], [-9, 0], [10, 0]]) envBox(0.5, 8.5, 0.5, '#6b4a2b', x + 0.5, 4.25, z + 0.5);
        const roof = envBox(22, 0.5, 16, '#8a5a30', 0.5, 8.8, -6); roof.rotation.x = 0.06;
        const back = makeCurtain(19, 6.4, '#f2ead8'); back.position.set(0.5, 5.1, -12.6); envGroup.add(back);
        for (const [x, z] of [[-18, -8], [-15, 8], [17, -10], [19, 6], [-20, 16], [21, 18], [12, 20], [-11, 22]]) {
          const t = buildProp('tree'); t.position.set(x, 0, z); t.rotation.y = Math.random() * 6.28; envGroup.add(t);
        }
      } else if (theme === 'sea') {
        makeFloor('#ecd9a8'); // 모래사장
        // 무대 뒤로 펼쳐진 바다
        const water = new THREE.Mesh(new THREE.PlaneGeometry(200, 56), new THREE.MeshStandardMaterial({ color: 0x1f7ab8, roughness: 0.22, metalness: 0.25 }));
        water.rotation.x = -Math.PI / 2; water.position.set(0, 0.02, -44); water.receiveShadow = true; envGroup.add(water);
        const foam = new THREE.Mesh(new THREE.PlaneGeometry(200, 1.6), new THREE.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, opacity: 0.7 }));
        foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.03, -16.2); envGroup.add(foam);
        for (const [x, z] of [[-9, -13], [10, -13], [-9, 0], [10, 0]]) envBox(0.5, 8.5, 0.5, '#d9c08a', x + 0.5, 4.25, z + 0.5);
        const roof = envBox(22, 0.4, 16, '#f2ead8', 0.5, 8.8, -6); roof.rotation.x = 0.06;
        const back = makeCurtain(19, 6.4, '#bfe4f2'); back.position.set(0.5, 5.1, -12.6); envGroup.add(back);
        for (const [x, z] of [[-16, -6], [18, -4], [-19, 12], [20, 14], [-13, 20]]) makePalm(x, z);
        const rock = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), envMat('#9a9a9a', { flatShading: true }));
        rock.scale.set(1, 0.55, 0.8); rock.position.set(14, 0.3, 18); rock.castShadow = true; envGroup.add(rock);
      } else {
        // 우주: 달 표면 + 별 + 행성
        makeFloor('#5a5d68');
        for (const [cx, cz, r] of [[-12, 10, 2.4], [15, 16, 3.2], [8, -18, 1.8], [-18, -14, 2.8], [-6, 22, 1.5]]) {
          const crater = new THREE.Mesh(new THREE.CircleGeometry(r, 20), envMat('#43454f'));
          crater.rotation.x = -Math.PI / 2; crater.position.set(cx, 0.005, cz); crater.receiveShadow = true; envGroup.add(crater);
          const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 6, 22), envMat('#6a6d78'));
          rim.rotation.x = Math.PI / 2; rim.position.set(cx, 0.08, cz); envGroup.add(rim);
        }
        makeStars();
        const earth = new THREE.Mesh(new THREE.SphereGeometry(4.2, 24, 18), envMat('#3a7fd0', { emissive: 0x1a3f70, emissiveIntensity: 0.5, roughness: 0.6 }));
        earth.position.set(-26, 20, -42); envGroup.add(earth);
        const land = new THREE.Mesh(new THREE.SphereGeometry(4.24, 12, 9), envMat('#4fae5f', { transparent: true, opacity: 0.6, emissive: 0x2a6a35, emissiveIntensity: 0.4 }));
        land.position.copy(earth.position); land.rotation.y = 1.2; envGroup.add(land);
        const saturn = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 14), envMat('#d8a860', { emissive: 0x6a4a20, emissiveIntensity: 0.4 }));
        saturn.position.set(24, 15, -36); envGroup.add(saturn);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.5, 6, 30), envMat('#e8cf9a', { emissive: 0x7a6030, emissiveIntensity: 0.35 }));
        ring.position.copy(saturn.position); ring.rotation.x = Math.PI / 2.4; ring.scale.z = 0.25; envGroup.add(ring);
        for (const [x, z] of [[-9, -13], [10, -13], [-9, 0], [10, 0]]) envBox(0.5, 8.5, 0.5, '#8a929e', x + 0.5, 4.25, z + 0.5, { metalness: 0.6, roughness: 0.35 });
        makeBatten(-9, 10, 8.5, -12.5); makeBatten(-9, 10, 8.5, -0.5);
      }
      makeBatten(-8, 9, 8.2, -3); makeBatten(-8, 9, 8.2, -9);
    },
    starter() {
      const top = theme === 'space' ? 'metal' : 'wood';
      const base = theme === 'space' ? 'stone' : 'darkwood';
      platform(-8, 9, -12, -1, top, base);
      for (const x of [-1, 0, 1, 2]) { addBlock(x, 0, 0, base); addBlock(x, 1, 0, top, 'slab'); }
    },
    seats() {
      const list = [];
      for (let row = 0; row < 6; row++) for (let x = -8; x <= 8; x += 1.7) { if (Math.abs(x) < 0.9) continue; list.push({ x: x + 0.5, y: 0, z: 3 + row * 2, rot: Math.PI }); }
      return list;
    },
  };
}

const PRESETS = {
  proscenium: {
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
      for (const x of [-2, -1, 1, 2, 0]) { addBlock(x, 0, -1, 'darkwood'); addBlock(x, 1, -1, 'wood', 'slab'); }
    },
    seats() {
      const list = [];
      for (let row = 0; row < 8; row++) for (let x = -9; x <= 9; x += 1.5) { if (Math.abs(x) < 1) continue; list.push({ x: x + 0.5, y: 0, z: 3.5 + row * 1.8, rot: Math.PI }); }
      return list;
    },
  },
  thrust: {
    name: '돌출 무대', emoji: '📐', desc: '객석 속으로 쑥! 관객이 3면을 둘러싸요',
    stageBounds: { x0: -6, x1: 7, z0: -14, z1: 7, y: 2 }, stageCenter: new THREE.Vector3(0.5, 2, -2),
    gridY: 9.5, env: { bg: 0x15161b, hemiSky: 0xbfd4ff },
    build() {
      makeRoom(66, 18, '#1b1c22'); makeFloor('#2a2b31');
      const cyc = new THREE.Mesh(new THREE.PlaneGeometry(18, 8.5), envMat('#d8e8f8')); cyc.position.set(0.5, 6.2, -15.4); cyc.receiveShadow = true; envGroup.add(cyc);
      const cl = makeCurtain(3.6, 6.8, '#24437c'); cl.position.set(-6.8, 5.4, -14.6); envGroup.add(cl);
      const cr = makeCurtain(3.6, 6.8, '#24437c'); cr.position.set(7.8, 5.4, -14.6); envGroup.add(cr);
      for (const z of [-10, -4, 2]) makeBatten(-10, 11, 9.5, z); makeBatten(-10, 11, 9.5, 6);
    },
    starter() { platform(-9, 9, -14, -7, 'wood', 'darkwood'); platform(-5, 6, -7, 6, 'wood', 'darkwood'); },
    seats() {
      const list = [];
      for (let row = 0; row < 4; row++) {
        const off = 7.5 + row * 1.8;
        for (let z = -6; z <= 6; z += 1.6) { list.push({ x: -off + 0.5, y: 0, z, rot: Math.PI / 2 }); list.push({ x: off + 0.5, y: 0, z, rot: -Math.PI / 2 }); }
        for (let x = -6; x <= 6; x += 1.6) { if (Math.abs(x) < 0.8) continue; list.push({ x: x + 0.5, y: 0, z: 8.5 + row * 1.8, rot: Math.PI }); }
      }
      return list;
    },
  },
  arena: {
    name: '원형 무대', emoji: '⭕', desc: '360도 관객이 둘러싸는 무대',
    stageBounds: { x0: -7, x1: 8, z0: -11, z1: 4, y: 1 }, stageCenter: new THREE.Vector3(0.5, 1, -3.5),
    gridY: 10, env: { bg: 0x141419, hemiSky: 0xcfd8ff },
    build() {
      makeRoom(64, 17, '#191a20'); makeFloor('#26272d');
      makeBatten(-10, 11, 10, -3.5);
      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 21, 8), envMat('#111318', { metalness: 0.5 })); b2.rotation.x = Math.PI / 2; b2.position.set(0.5, 10, -3.5); envGroup.add(b2);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 0.09, 8, 40), envMat('#111318', { metalness: 0.5 })); ring.rotation.x = Math.PI / 2; ring.position.set(0.5, 9.2, -3.5); envGroup.add(ring);
    },
    starter() {
      for (let x = -8; x <= 9; x++) for (let z = -12; z <= 5; z++) { const dx = x + 0.5 - 0.5, dz = z + 0.5 - (-3.5); if (Math.hypot(dx, dz) <= 7.2) addBlock(x, 0, z, 'wood'); }
    },
    seats() {
      const list = []; const cx = 0.5, cz = -3.5;
      for (let ring = 0; ring < 3; ring++) { const r = 10 + ring * 1.9; const n = Math.round(r * 3.4); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; list.push({ x: cx + Math.cos(a) * r, y: 0, z: cz + Math.sin(a) * r, rot: -a - Math.PI / 2 }); } }
      return list;
    },
  },
  blackbox: {
    name: '블랙박스', emoji: '⬛', desc: '텅 빈 검은 방 — 상상력이 곧 무대!',
    stageBounds: { x0: -8, x1: 9, z0: -10, z1: 3, y: 0 }, stageCenter: new THREE.Vector3(0.5, 0, -3.5),
    gridY: 8.6, env: { bg: 0x0d0d10, hemiSky: 0x9aa4c0 },
    build() {
      makeRoom(44, 13, '#101014'); makeFloor('#1a1a1e');
      for (const z of [-10, -5, 0, 5]) makeBatten(-12, 13, 8.6, z);
      for (const x of [-9, -3, 3, 9]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 20, 8), envMat('#111318', { metalness: 0.5 })); b.rotation.x = Math.PI / 2; b.position.set(x + 0.5, 8.6, -2.5); envGroup.add(b); }
    },
    starter() { addPropRaw('chair', -3.5, 0, 4.5, Math.PI, 1); addPropRaw('chair', -1.5, 0, 4.8, Math.PI, 2); addPropRaw('chair', 0.8, 0, 4.6, Math.PI, 3); addPropRaw('chair', 2.8, 0, 4.9, Math.PI, 4); },
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
  envGroup.clear(); seatGroup.clear();
  const p = PRESETS[id];
  envLightCfg = { ...envLightCfg, ...p.env };
  hemi.color.set(p.env.hemiSky);
  p.build();
  buildSeats(p.seats());
  seatGroup.visible = state.seats;
  buildZoneOverlay();
  applyHouseLights();
  document.getElementById('stageSelect').value = id;
}
function layStarter(id) { PRESETS[id].starter(); }

// ---------------- 무대 구역 오버레이 ----------------
let zoneMesh = null;
function buildZoneOverlay() {
  if (zoneMesh) { scene.remove(zoneMesh); zoneMesh = null; }
  const b = PRESETS[proj.preset]?.stageBounds; if (!b) return;
  const w = b.x1 - b.x0, d = b.z1 - b.z0;
  const c = document.createElement('canvas'); const S = 64; c.width = w * S; c.height = d * S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(20,22,30,0.35)'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(255,213,74,0.9)'; ctx.lineWidth = 4;
  const cw = c.width / 3, ch = c.height / 3;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cw * i, 0); ctx.lineTo(cw * i, c.height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, ch * i); ctx.lineTo(c.width, ch * i); ctx.stroke(); }
  ctx.strokeRect(2, 2, c.width - 4, c.height - 4);
  const rows = [['업 하수', '업 센터', '업 상수'], ['중앙 하수', '★ 무대 중앙', '중앙 상수'], ['다운 하수', '다운 센터', '다운 상수']];
  ctx.fillStyle = '#ffe89a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${S * 0.42}px sans-serif`;
  for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) ctx.fillText(rows[r][col], cw * col + cw / 2, ch * r + ch / 2);
  ctx.font = `bold ${S * 0.34}px sans-serif`; ctx.fillStyle = '#9fd8ff';
  ctx.fillText('▲ 업스테이지 (무대 뒤쪽)', c.width / 2, S * 0.35);
  ctx.fillText('▼ 다운스테이지 (객석 쪽)', c.width / 2, c.height - S * 0.35);
  ctx.save(); ctx.translate(S * 0.35, c.height / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('하수 (객석에서 왼쪽)', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(c.width - S * 0.35, c.height / 2); ctx.rotate(Math.PI / 2); ctx.fillText('상수 (객석에서 오른쪽)', 0, 0); ctx.restore();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  zoneMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  zoneMesh.rotation.x = -Math.PI / 2; zoneMesh.position.set((b.x0 + b.x1) / 2, b.y + 0.03, (b.z0 + b.z1) / 2);
  zoneMesh.visible = state.zones; zoneMesh.renderOrder = 5; scene.add(zoneMesh);
}

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
    pos: new THREE.Vector3().fromArray(data.pos), target: new THREE.Vector3().fromArray(data.target), phase: Math.random() * Math.PI * 2,
  };
  lightSeq = Math.max(lightSeq, Lg.id + 1);
  const group = new THREE.Group(); group.position.copy(Lg.pos);
  const body = new THREE.Mesh(fixtureBodyGeo, new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.5, metalness: 0.4 })); body.castShadow = true;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.13, 10), new THREE.MeshBasicMaterial({ color: Lg.color })); lens.position.z = 0.29; body.add(lens);
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.07), new THREE.MeshStandardMaterial({ color: 0x111318, metalness: 0.5 })); clamp.position.y = 0.4;
  group.add(body, clamp);
  group.traverse(o => { o.userData = { kind: 'fixture', lightId: Lg.id }; });
  const spot = new THREE.SpotLight(Lg.color, Lg.intensity, 60, THREE.MathUtils.degToRad(Lg.angle), 0.35, 0);
  spot.position.set(0, 0, 0);
  if (shadowLightCount() < MAX_SHADOW_LIGHTS) { spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.002; }
  group.add(spot);
  const targetObj = new THREE.Object3D(); scene.add(targetObj); targetObj.position.copy(Lg.target); spot.target = targetObj;
  const cone = new THREE.Mesh(makeConeGeo(Lg), new THREE.MeshBasicMaterial({ color: Lg.color, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.userData = { kind: 'beam' }; cone.raycast = () => {}; group.add(cone);
  Object.assign(Lg, { group, body, lens, spot, cone, targetObj });
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
  Lg.body.lookAt(Lg.pos.clone().add(_dir));
  Lg.cone.quaternion.setFromUnitVectors(_down, _dir);
}
// 빔이 길수록(팔로우 스팟 등) 은은하게 — 화면을 덮는 거대한 콘을 막는다
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
const serializeLight = (Lg) => ({ id: Lg.id, type: Lg.type, color: Lg.color, intensity: Lg.intensity, angle: Lg.angle, on: Lg.on, pos: Lg.pos.toArray(), target: Lg.target.toArray() });

function placeLightAt(point) {
  const type = state.lightType;
  const center = PRESETS[proj.preset]?.stageCenter ?? new THREE.Vector3(0, 2, -6);
  let pos, target = point.clone();
  if (type === 'follow') { pos = new THREE.Vector3(point.x > 0.5 ? 7 : -6, 9.5, 15); }
  else if (type === 'floor') {
    pos = point.clone().add(new THREE.Vector3(0, 0.15, 0));
    const toCenter = new THREE.Vector3().subVectors(center, point).setY(0);
    if (toCenter.lengthSq() < 0.5) toCenter.set(0, 0, -1); toCenter.normalize();
    target = pos.clone().add(toCenter.multiplyScalar(2.5)).add(new THREE.Vector3(0, 6, 0));
  } else { pos = new THREE.Vector3(point.x, 10.2, point.z + (type === 'wash' ? 3 : 1.2)); }
  const Lg = createLight({ type, pos: pos.toArray(), target: target.toArray() });
  if (Lg) { toast(`${LIGHT_TYPES[type].emoji} ${LIGHT_TYPES[type].name}을(를) 달았어요!`); blip(660); selectElement('light', Lg); markDirty(); }
}

// 조명 세트 — confirm 없이 적용하고, 되돌리기로 복구 가능하게
function applyLightPreset(preset) {
  const prev = lights.map(serializeLight);
  for (const Lg of [...lights]) deleteLight(Lg, false);
  const fr = stageFrame();
  for (const cfg of preset.build(fr)) createLight(cfg, false);
  pushUndo({ undo: () => { for (const Lg of [...lights]) deleteLight(Lg, false); for (const d of prev) createLight(d, false); renderElementList(); } });
  markDirty(); renderElementList();
  toast(`${preset.emoji} ${preset.name} 조명을 켰어요! (되돌리기 가능)`);
  blip(720);
}

// ---------------- 소품 ----------------
function addPropRaw(type, x, y, z, rot = 0, variant = 0, record = false) {
  const P = { id: uid(), type, rot, variant, pos: new THREE.Vector3(x, y, z), group: buildProp(type, variant) };
  P.group.position.copy(P.pos); P.group.rotation.y = rot;
  P.group.traverse(o => { o.userData = { kind: 'prop', propId: P.id }; });
  propGroup.add(P.group); props.push(P);
  if (record) pushUndo({ undo: () => deleteProp(P, false) });
  return P;
}
function deleteProp(P, record = true) {
  const i = props.indexOf(P); if (i < 0) return;
  props.splice(i, 1); propGroup.remove(P.group);
  if (state.selected && state.selected.ref === P) clearSelection();
  if (record) { const d = { type: P.type, x: P.pos.x, y: P.pos.y, z: P.pos.z, rot: P.rot, variant: P.variant }; pushUndo({ undo: () => addPropRaw(d.type, d.x, d.y, d.z, d.rot, d.variant) }); }
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
  const I = { id: uid(), src: data.src, aspect: data.aspect, scale: data.scale ?? 1, rot: data.rot ?? 0, pos: new THREE.Vector3(data.x, data.y, data.z), group: null, tex: data.tex };
  const build = (tex, aspect) => {
    I.tex = tex; I.aspect = aspect;
    I.group = buildStandee(tex, aspect, I.scale);
    I.group.position.copy(I.pos); I.group.rotation.y = I.rot;
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
  I.group.position.copy(I.pos); I.group.rotation.y = I.rot;
  I.group.traverse(o => { o.userData = { kind: 'image', imageId: I.id }; });
  imageGroup.add(I.group);
}
function deleteImage(I, record = true) {
  const i = images.indexOf(I); if (i < 0) return;
  images.splice(i, 1); if (I.group) imageGroup.remove(I.group);
  if (state.selected && state.selected.ref === I) clearSelection();
  if (record) { const d = { src: I.src, aspect: I.aspect, scale: I.scale, rot: I.rot, x: I.pos.x, y: I.pos.y, z: I.pos.z, tex: I.tex }; pushUndo({ undo: () => addImageRaw(d, false) }); }
}

// ---------------- 선택 & 클릭 삭제 ----------------
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
  if (s) { if (s.kind === 'light') fixtureHL(s.ref, false); else setHL(s.ref.group, false); }
  state.selected = null; state.retargeting = false;
  hidePanel('lightPanel'); hidePanel('imgEditPanel');
  renderElementList();
}
function selectElement(kind, ref) {
  if (state.selected && state.selected.ref === ref) { deleteSelected(); return; }
  clearSelection();
  state.selected = { kind, ref };
  if (kind === 'light') { fixtureHL(ref, true); openLightPanel(ref); }
  else { setHL(ref.group, true); if (kind === 'image') openImgPanel(ref); }
  renderElementList();
  setHint('한 번 더 클릭하면 삭제돼요');
}
function deleteSelected() {
  const s = state.selected; if (!s) return;
  if (s.kind === 'light') { deleteLight(s.ref); toast('조명을 뗐어요'); }
  else if (s.kind === 'prop') { deleteProp(s.ref); toast('소품을 치웠어요'); }
  else if (s.kind === 'image') { deleteImage(s.ref); toast('이미지를 뺐어요'); }
  blip(320); markDirty(); renderElementList();
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
const ghost = new THREE.Mesh(cubeGeo, ghostMatAdd);
ghost.visible = false; ghost.raycast = () => {}; scene.add(ghost);

let propGhost = null;
function refreshPropGhost() {
  if (propGhost) { scene.remove(propGhost); propGhost = null; }
  if (state.mode !== 'prop' || state.propCat === 'images') return;
  propGhost = buildProp(state.propType, state.propVariant);
  propGhost.traverse(o => {
    if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => { m.transparent = true; m.opacity = 0.5; m.depthWrite = false; }); o.castShadow = false; }
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
      if (!blocks.has(keyOf(c.x, c.y, c.z))) return;
      ghost.material = ghostMatErase;
      ghost.geometry = blocks.get(keyOf(c.x, c.y, c.z)).shape === 'slab' ? slabGeo : cubeGeo;
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
  if (state.retargeting && state.selected?.kind === 'light') {
    const hit = pick(ev, [...blockGroup.children, groundPlane]);
    if (hit) { state.selected.ref.target.copy(hit.point); updateLightVisual(state.selected.ref); state.retargeting = false; toast('🎯 조명이 새 위치를 비춰요!'); updateHint(); markDirty(); }
    return;
  }
  if (state.mode === 'block') {
    if (state.blockShape === 'erase') {
      const hit = pick(ev, blockGroup.children); if (!hit) return;
      const c = cellFromHit(hit, true);
      if (removeBlock(c.x, c.y, c.z, true)) { blip(320); markDirty(); }
      return;
    }
    const hit = pick(ev, [...blockGroup.children, groundPlane]); if (!hit) return;
    const c = cellFromHit(hit);
    if (addBlock(c.x, c.y, c.z, state.blockType, state.blockShape, true)) { blip(540); markDirty(); }
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
    const P = addPropRaw(state.propType, snapHalf(hit.point.x), snapHalf(hit.point.y), snapHalf(hit.point.z), state.propRot, state.propVariant, true);
    if (P) { blip(540); markDirty(); renderElementList(); if (state.propType === 'actor' || state.propType === 'ball') state.propVariant = (state.propVariant + 1) % 8; refreshPropGhost(); }
  } else if (isSelectMode()) {
    const hit = pick(ev, selectTargets());
    if (!hit) { clearSelection(); updateHint(); return; }
    const ud = hit.object.userData;
    if (ud.kind === 'fixture') { const Lg = lights.find(l => l.id === ud.lightId); if (Lg) selectElement('light', Lg); }
    else if (ud.kind === 'prop') { const P = props.find(p => p.id === ud.propId); if (P) selectElement('prop', P); }
    else if (ud.kind === 'image') { const I = images.find(im => im.id === ud.imageId); if (I) selectElement('image', I); }
  }
}
function onRightClick(ev) {
  if (state.retargeting) { state.retargeting = false; updateHint(); return; }
  const hit = pick(ev, [...selectTargets(), ...blockGroup.children, groundPlane]); if (!hit) return;
  const ud = hit.object.userData;
  if (ud.kind === 'fixture') { const Lg = lights.find(l => l.id === ud.lightId); if (Lg) { deleteLight(Lg); toast('조명을 뗐어요'); blip(320); markDirty(); } }
  else if (ud.kind === 'prop') { const P = props.find(p => p.id === ud.propId); if (P) { deleteProp(P); blip(320); markDirty(); } }
  else if (ud.kind === 'image') { const I = images.find(im => im.id === ud.imageId); if (I) { deleteImage(I); blip(320); markDirty(); } }
  else if (ud.kind === 'block' && !isSelectMode()) { const c = cellFromHit(hit, true); if (removeBlock(c.x, c.y, c.z, true)) { blip(320); markDirty(); } }
  renderElementList();
}

let downInfo = null;
canvas.addEventListener('pointerdown', ev => { downInfo = { x: ev.clientX, y: ev.clientY, button: ev.button, shift: ev.shiftKey }; });
canvas.addEventListener('pointerup', ev => {
  if (!downInfo) return;
  const moved = Math.hypot(ev.clientX - downInfo.x, ev.clientY - downInfo.y);
  const info = downInfo; downInfo = null;
  if (moved > 6) return;
  if (info.button === 0 && !info.shift) onLeftClick(ev);
  else if (info.button === 2 || (info.button === 0 && info.shift)) onRightClick(ev);
});
canvas.addEventListener('pointermove', onHover);
canvas.addEventListener('contextmenu', ev => ev.preventDefault());

// ---------------- 스위치 유틸 ----------------
function setSwitch(el, on) { el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on)); }

// ---------------- 조명 설정 패널 ----------------
const lp = {
  power: document.getElementById('lpPower'), colors: document.getElementById('lpColors'), custom: document.getElementById('lpCustomColor'),
  intensity: document.getElementById('lpIntensity'), intVal: document.getElementById('lpIntVal'), angle: document.getElementById('lpAngle'), angVal: document.getElementById('lpAngVal'),
};
GEL_COLORS.forEach(c => {
  const b = document.createElement('button'); b.className = 'gel'; b.style.background = c; b.title = c;
  b.addEventListener('click', () => { if (state.selected?.kind !== 'light') return; const Lg = state.selected.ref; Lg.color = c; updateLightVisual(Lg); refreshGel(); markDirty(); });
  lp.colors.appendChild(b);
});
function refreshGel() { const cur = state.selected?.kind === 'light' ? state.selected.ref.color : null; [...lp.colors.children].forEach((b, i) => b.classList.toggle('active', GEL_COLORS[i] === cur)); }
function openLightPanel(Lg) {
  document.getElementById('lpTitle').textContent = `${LIGHT_TYPES[Lg.type].emoji} ${LIGHT_TYPES[Lg.type].name}`;
  setSwitch(lp.power, Lg.on);
  lp.intensity.value = Lg.intensity; lp.intVal.textContent = Lg.intensity;
  lp.angle.value = Lg.angle; lp.angVal.textContent = `${Lg.angle}°`; lp.custom.value = Lg.color;
  refreshGel(); showPanel('lightPanel'); blip(760);
}
function sel(kind) { return state.selected?.kind === kind ? state.selected.ref : null; }
lp.power.addEventListener('click', () => { const Lg = sel('light'); if (!Lg) return; Lg.on = !Lg.on; setSwitch(lp.power, Lg.on); updateLightVisual(Lg); markDirty(); });
lp.custom.addEventListener('input', () => { const Lg = sel('light'); if (!Lg) return; Lg.color = lp.custom.value; updateLightVisual(Lg); refreshGel(); markDirty(); });
lp.intensity.addEventListener('input', () => { const Lg = sel('light'); if (!Lg) return; Lg.intensity = +lp.intensity.value; lp.intVal.textContent = Lg.intensity; updateLightVisual(Lg); markDirty(); });
lp.angle.addEventListener('input', () => { const Lg = sel('light'); if (!Lg) return; Lg.angle = +lp.angle.value; lp.angVal.textContent = `${Lg.angle}°`; updateLightVisual(Lg); markDirty(); });
document.getElementById('lpAim').addEventListener('click', () => { if (!sel('light')) return; state.retargeting = true; setHint('🎯 조명이 비출 곳을 클릭하세요! (오른쪽 클릭 = 취소)'); });
document.getElementById('lpDelete').addEventListener('click', () => { const Lg = sel('light'); if (Lg) { deleteLight(Lg); toast('조명을 뗐어요'); markDirty(); renderElementList(); } });

// ---------------- 이미지 편집 패널 ----------------
const ie = { size: document.getElementById('ieSize'), sizeVal: document.getElementById('ieSizeVal') };
function openImgPanel(I) { ie.size.value = I.scale; ie.sizeVal.textContent = `${I.scale.toFixed(1)}배`; showPanel('imgEditPanel'); }
ie.size.addEventListener('input', () => { const I = sel('image'); if (!I) return; I.scale = +ie.size.value; ie.sizeVal.textContent = `${I.scale.toFixed(1)}배`; rebuildImage(I); setHL(I.group, true); markDirty(); });
document.getElementById('ieRotate').addEventListener('click', () => { const I = sel('image'); if (!I) return; I.rot = (I.rot + Math.PI / 2) % (Math.PI * 2); I.group.rotation.y = I.rot; markDirty(); });
document.getElementById('ieDelete').addEventListener('click', () => { const I = sel('image'); if (I) { deleteImage(I); markDirty(); renderElementList(); } });

function showPanel(id) { document.getElementById(id).classList.remove('hidden'); }
function hidePanel(id) { document.getElementById(id).classList.add('hidden'); }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => {
  const id = b.dataset.close; hidePanel(id);
  if (id === 'lightPanel' || id === 'imgEditPanel') clearSelection();
}));

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
    const b = document.createElement('button'); b.className = 'preset-btn';
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
}
function selectCategory(catId) {
  state.propCat = catId;
  document.querySelectorAll('#propCats .cat-chip').forEach(c => c.classList.toggle('active', c.dataset.cat === catId));
  const isImg = catId === 'images';
  document.getElementById('propGrid').classList.toggle('hidden', isImg);
  document.getElementById('imagePanel').classList.toggle('hidden', !isImg);
  if (!isImg) renderPropGrid();
  refreshPropGhost();
}
function renderPropGrid() {
  const grid = document.getElementById('propGrid'); grid.innerHTML = '';
  const cat = PROP_CATEGORIES.find(c => c.id === state.propCat); if (!cat) return;
  cat.items.forEach(def => {
    const b = document.createElement('button'); b.className = 'pcard' + (def.id === state.propType ? ' active' : '');
    b.innerHTML = `<span class="ic">${def.emoji}</span><span><div class="nm">${def.name}</div><div class="ds">${def.desc}</div></span>`;
    b.addEventListener('click', () => { state.propType = def.id; grid.querySelectorAll('.pcard').forEach(c => c.classList.remove('active')); b.classList.add('active'); refreshPropGhost(); setHint(`${def.emoji} ${def.name} — 무대를 클릭해서 놓아요 (R = 방향)`); });
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
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  document.querySelectorAll('.pal-page').forEach(p => p.classList.toggle('hidden', p.dataset.mode !== mode));
  ghost.visible = false; refreshPropGhost();
  if (mode === 'block' || mode === 'prop') clearSelection();
  updateHint();
}
const HINTS = {
  view: '👀 드래그 = 둘러보기 · 휠 = 확대 · 놓은 것을 클릭하면 선택돼요',
  block: '🧱 클릭 = 블록 놓기 · 드래그 = 시점 돌리기',
  prop: '🪑 소품을 고르고 무대를 클릭하세요 · R = 방향 돌리기',
  light: '💡 세트 버튼 하나면 조명 완성! 직접 달기로 바꿀 수도 있어요',
  perform: '🎬 큐와 음악을 준비하고, 공연 모드를 켜 보세요!',
};
function setHint(t) { document.getElementById('hintText').textContent = t; }
function updateHint() { setHint(HINTS[state.mode]); }

// ---------------- 장면(Scene) 관리 ----------------
function freshScene(name) { return { name, blocks: [], lights: [], props: [], images: [], cues: [] }; }
function serializeScene() {
  return {
    name: proj.scenes[proj.active].name,
    blocks: [...blocks.entries()].map(([k, b]) => { const [x, y, z] = k.split(',').map(Number); return [x, y, z, b.type, b.shape === 'slab' ? 1 : 0]; }),
    lights: lights.map(serializeLight),
    props: props.map(p => ({ type: p.type, x: p.pos.x, y: p.pos.y, z: p.pos.z, rot: p.rot, variant: p.variant })),
    images: images.map(im => ({ src: im.src, aspect: im.aspect, scale: im.scale, rot: im.rot, x: im.pos.x, y: im.pos.y, z: im.pos.z })),
    cues: cues.map(c => ({ name: c.name, lights: c.lights })),
  };
}
function snapshot() { proj.scenes[proj.active] = serializeScene(); }
function clearLive() {
  for (const b of blocks.values()) blockGroup.remove(b.mesh); blocks.clear();
  for (const Lg of [...lights]) { lightGroup.remove(Lg.group); scene.remove(Lg.targetObj); } lights.length = 0;
  for (const P of [...props]) propGroup.remove(P.group); props.length = 0;
  for (const I of [...images]) if (I.group) imageGroup.remove(I.group); images.length = 0;
  undoStack.length = 0; state.selected = null; hidePanel('lightPanel'); hidePanel('imgEditPanel');
}
function hydrateScene(s) {
  clearLive();
  for (const [x, y, z, type, slab] of s.blocks ?? []) addBlock(x, y, z, type, slab ? 'slab' : 'cube');
  for (const l of s.lights ?? []) createLight(l, false);
  for (const p of s.props ?? []) addPropRaw(p.type, p.x, p.y, p.z, p.rot, p.variant);
  for (const im of s.images ?? []) addImageRaw({ src: im.src, aspect: im.aspect, scale: im.scale, rot: im.rot, x: im.x, y: im.y, z: im.z });
  cues = (s.cues ?? []).map(c => ({ name: c.name, lights: c.lights }));
  cueSeq = cues.length + 1;
  cueActive = -1;
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

// ---------------- 요소 목록 ----------------
function renderElementList() {
  const box = document.getElementById('elementList'); box.innerHTML = '';
  const section = (title) => { const h = document.createElement('div'); h.className = 'el-group-title'; h.textContent = title; box.appendChild(h); };
  const row = (icon, name, onSel, onDel, selected) => {
    const r = document.createElement('div'); r.className = 'el-row' + (selected ? ' sel' : '');
    r.innerHTML = `<span class="eic">${icon}</span><span class="enm">${name}</span>`;
    const d = document.createElement('button'); d.className = 'edel'; d.innerHTML = '<span class="material-icons-outlined">delete</span>'; d.title = '삭제';
    d.addEventListener('click', e => { e.stopPropagation(); onDel(); });
    r.appendChild(d); r.addEventListener('click', onSel); box.appendChild(r);
  };
  const empty = () => { const e = document.createElement('div'); e.className = 'el-empty'; e.textContent = '아직 없어요'; box.appendChild(e); };
  section(`💡 조명 (${lights.length})`);
  if (!lights.length) empty();
  lights.forEach((Lg, i) => row(LIGHT_TYPES[Lg.type].emoji, `${LIGHT_TYPES[Lg.type].name} ${i + 1}${Lg.on ? '' : ' (꺼짐)'}`, () => selectElement('light', Lg), () => { deleteLight(Lg); markDirty(); renderElementList(); }, state.selected?.ref === Lg));
  section(`🪑 소품 (${props.length})`);
  if (!props.length) empty();
  props.forEach(P => row(PROP_INFO[P.type]?.emoji ?? '🔷', PROP_INFO[P.type]?.name ?? P.type, () => selectElement('prop', P), () => { deleteProp(P); markDirty(); renderElementList(); }, state.selected?.ref === P));
  section(`🖼️ 이미지 (${images.length})`);
  if (!images.length) empty();
  images.forEach((I, i) => row('🖼️', `내 이미지 ${i + 1}`, () => selectElement('image', I), () => { deleteImage(I); markDirty(); renderElementList(); }, state.selected?.ref === I));
  section(`🧱 블록 (${blocks.size})`);
  const clr = document.createElement('div'); clr.className = 'el-row';
  clr.innerHTML = `<span class="eic">🧱</span><span class="enm">블록 모두 지우기</span>`;
  const cd = document.createElement('button'); cd.className = 'edel'; cd.innerHTML = '<span class="material-icons-outlined">delete</span>';
  cd.addEventListener('click', e => { e.stopPropagation(); if (blocks.size && confirm('이 장면의 블록을 모두 지울까요?')) { for (const [k] of [...blocks]) { const [x, y, z] = k.split(',').map(Number); removeBlock(x, y, z); } markDirty(); renderElementList(); } });
  clr.appendChild(cd); box.appendChild(clr);
}

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

// ---------------- 음악 ----------------
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

// 저장·공유 메뉴
const saveMenu = document.getElementById('saveMenu');
document.getElementById('btnSaveMenu').addEventListener('click', ev => { ev.stopPropagation(); saveMenu.classList.toggle('hidden'); });
document.addEventListener('click', ev => { if (!ev.target.closest('.menu-wrap')) saveMenu.classList.add('hidden'); });
saveMenu.addEventListener('click', () => saveMenu.classList.add('hidden'));

document.getElementById('houseSlider').addEventListener('input', ev => { state.house = ev.target.value / 100; proj.house = state.house; applyHouseLights(); });

// 화면 옵션 스위치
document.getElementById('tgZones').addEventListener('click', function () {
  state.zones = !state.zones; setSwitch(this, state.zones);
  if (zoneMesh) zoneMesh.visible = state.zones;
  if (state.zones) toast('📍 무대 구역 이름이 보여요 — 배움터에서 자세히!');
});
document.getElementById('tgSeats').addEventListener('click', function () {
  state.seats = !state.seats; setSwitch(this, state.seats);
  seatGroup.visible = state.seats;
});

// 공연 모드
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
  if (!confirm(`무대를 "${PRESETS[id].name}"(으)로 바꿀까요?\n만든 블록·소품은 그대로 남아요.`)) { ev.target.value = proj.preset; return; }
  proj.preset = id; buildEnvironment(id); markDirty(); toast(`${PRESETS[id].emoji} ${PRESETS[id].name}로 바꿨어요!`);
});

document.getElementById('btnShot').addEventListener('click', () => {
  renderer.render(scene, camera);
  const a = document.createElement('a'); a.href = renderer.domElement.toDataURL('image/png'); a.download = `my-stage-${Date.now()}.png`; a.click();
  toast('📸 찰칵! 사진을 저장했어요');
});

// ---------------- 저장 / 불러오기 ----------------
function serializeProject() { snapshot(); return { v: 2, preset: proj.preset, house: proj.house, active: proj.active, scenes: proj.scenes, music: music.getState() }; }
function restoreProject(data) {
  if (!data) return false;
  if (data.preset === 'outdoor') data.preset = 'outdoor_forest'; // 이전 버전 호환
  if (!PRESETS[data.preset]) return false;
  proj.preset = data.preset; proj.house = data.house ?? 0.7; state.house = proj.house;
  document.getElementById('houseSlider').value = proj.house * 100;
  proj.scenes = (data.scenes && data.scenes.length) ? data.scenes : [freshScene('1장')];
  proj.active = Math.min(data.active ?? 0, proj.scenes.length - 1);
  buildEnvironment(proj.preset);
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
let camTween = null;
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  const v = VIEWS[b.dataset.view];
  camTween = { t: 0, fromP: camera.position.clone(), toP: new THREE.Vector3(...v.pos), fromT: controls.target.clone(), toT: new THREE.Vector3(...v.tgt) };
}));

// ---------------- 키보드 ----------------
window.addEventListener('keydown', ev => {
  if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.target.tagName === 'TEXTAREA') return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo(); return; }
  switch (ev.key) {
    case '1': setMode('view'); break; case '2': setMode('block'); break; case '3': setMode('prop'); break; case '4': setMode('light'); break; case '5': setMode('perform'); break;
    case 'r': case 'R':
      if (state.mode === 'prop') { state.propRot = (state.propRot + Math.PI / 2) % (Math.PI * 2); if (propGhost) propGhost.rotation.y = state.propRot; }
      if (state.selected?.kind === 'image') { const I = state.selected.ref; I.rot = (I.rot + Math.PI / 2) % (Math.PI * 2); I.group.rotation.y = I.rot; markDirty(); }
      break;
    case 'Delete': case 'Backspace': if (state.selected) { ev.preventDefault(); deleteSelected(); } break;
    case 'Escape': clearSelection(); updateHint(); break;
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
buildBlockPalette(); buildLightPalette(); buildPresetGrid(); buildPropUI(); renderImgGrid();
updateHint();
newProject('proscenium');
resize(); animate();
