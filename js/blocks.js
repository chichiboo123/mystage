// 블록 종류 정의 — 마인크래프트 느낌의 16x16 픽셀 텍스처를 코드로 생성한다.
import * as THREE from 'three';

const SIZE = 16;

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

function makeCanvas(draw) {
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  draw(c.getContext('2d'));
  return c;
}

// 픽셀마다 밝기를 살짝 다르게 — 마인크래프트 특유의 노이즈 질감
function noisyFill(ctx, base, amount = 0.12) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const f = 1 - amount / 2 + Math.random() * amount;
      ctx.fillStyle = shade(base, f);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

const patterns = {
  solid: (base, noise = 0.12) => makeCanvas(ctx => noisyFill(ctx, base, noise)),

  planks: (base) => makeCanvas(ctx => {
    noisyFill(ctx, base, 0.16);
    ctx.fillStyle = shade(base, 0.6);
    for (let y = 3; y < SIZE; y += 4) ctx.fillRect(0, y, SIZE, 1); // 널빤지 이음새
    ctx.fillRect(4, 0, 1, 4); ctx.fillRect(11, 4, 1, 4);
    ctx.fillRect(2, 8, 1, 4); ctx.fillRect(9, 12, 1, 4);
  }),

  bricks: (base) => makeCanvas(ctx => {
    noisyFill(ctx, base, 0.14);
    ctx.fillStyle = shade(base, 0.55);
    for (let y = 3; y < SIZE; y += 4) ctx.fillRect(0, y, SIZE, 1);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 === 0 ? 3 : 8;
      ctx.fillRect(off, row * 4, 1, 3);
      ctx.fillRect((off + 8) % SIZE, row * 4, 1, 3);
    }
  }),

  curtain: (base) => makeCanvas(ctx => {
    // 세로 주름 — 밝고 어두운 줄무늬
    for (let x = 0; x < SIZE; x++) {
      const wave = 0.72 + 0.42 * Math.abs(Math.sin(x * 1.1));
      for (let y = 0; y < SIZE; y++) {
        ctx.fillStyle = shade(base, wave * (0.95 + Math.random() * 0.1));
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }),

  led: (base) => makeCanvas(ctx => {
    noisyFill(ctx, base, 0.05);
    ctx.fillStyle = shade(base, 1.35);
    ctx.fillRect(2, 2, SIZE - 4, SIZE - 4);
  }),
};

function makeTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// [id, 이름, 패턴, 색, 옵션]
const DEFS = [
  ['wood',       '나무 무대 바닥', 'planks',  '#b8874f'],
  ['darkwood',   '어두운 나무',    'planks',  '#6b4a2b'],
  ['blackdeck',  '검은 무대 단',   'solid',   '#26282e', { noise: 0.06 }],
  ['curtainRed', '빨간 커튼',      'curtain', '#a41f2f'],
  ['curtainBlue','파란 커튼',      'curtain', '#24437c'],
  ['curtainGold','금색 커튼',      'curtain', '#c9a23a'],
  ['brick',      '벽돌',           'bricks',  '#9c5040'],
  ['stone',      '돌',             'solid',   '#8f9099'],
  ['white',      '흰색 패널',      'solid',   '#e8e8ee', { noise: 0.05 }],
  ['glass',      '유리',           'solid',   '#bfe3ef', { glass: true, noise: 0.04 }],
  ['metal',      '철제 트러스',    'solid',   '#a9b2bd', { metal: true, noise: 0.08 }],
  ['grass',      '잔디',           'solid',   '#4f9e3f', { noise: 0.2 }],
  ['red',        '빨강 블록',      'solid',   '#d94040'],
  ['orange',     '주황 블록',      'solid',   '#e78a2e'],
  ['yellow',     '노랑 블록',      'solid',   '#ecc94b'],
  ['green',      '초록 블록',      'solid',   '#48a860'],
  ['blue',       '파랑 블록',      'solid',   '#4a7fd4'],
  ['purple',     '보라 블록',      'solid',   '#8e5bc9'],
  ['pink',       '분홍 블록',      'solid',   '#e883b0'],
  ['ledWhite',   'LED 패널 (빛남)', 'led',     '#f4f4ff', { emissive: '#ffffff' }],
  ['ledBlue',    'LED 파랑 (빛남)', 'led',     '#7fd4ff', { emissive: '#57b9ff' }],
  ['ledPink',    'LED 분홍 (빛남)', 'led',     '#ff9fd0', { emissive: '#ff6fb5' }],
];

export function createBlockTypes() {
  const types = {};
  const order = [];
  for (const [id, name, pattern, color, opts = {}] of DEFS) {
    const canvas = patterns[pattern](color, opts.noise);
    const params = { map: makeTexture(canvas), roughness: 0.92, metalness: 0 };
    if (opts.glass) Object.assign(params, { transparent: true, opacity: 0.45, roughness: 0.15 });
    if (opts.metal) Object.assign(params, { metalness: 0.6, roughness: 0.35 });
    if (opts.emissive) Object.assign(params, {
      emissive: new THREE.Color(opts.emissive), emissiveIntensity: 1.1,
    });
    types[id] = { id, name, mat: new THREE.MeshStandardMaterial(params), thumb: canvas.toDataURL() };
    order.push(id);
  }
  return { types, order };
}
