// 스모그 머신 — 무대에 뿌연 안개(헤이즈)를 뿜는 파티클 효과
// 놓인 스모그 머신 소품마다 노즐에서 연기가 뿜어져 나오고, 공연 탭에서 켜기/농도를 조절한다.
// 파티클은 하나의 THREE.Points 로 모아 그려 성능 부담을 낮췄다.
import * as THREE from 'three';

// 부드러운 원형 연기 텍스처 (외부 이미지 없이 코드로 생성)
function makePuffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.42)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const VERT = `
attribute float size;
attribute float alpha;
varying float vAlpha;
void main() {
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (320.0 / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform sampler2D map;
uniform float uOpacity;
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  float a = t.a * vAlpha * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`;

export function createSmokeSystem(scene, { max = 500 } = {}) {
  const pos = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const alpha = new Float32Array(max);
  // CPU 쪽 파티클 상태
  const vel = new Float32Array(max * 3);
  const age = new Float32Array(max);
  const life = new Float32Array(max);
  const grow = new Float32Array(max);
  let alive = 0;               // 살아있는 파티클은 앞쪽에 몰아 둔다 (swap-remove)
  let emitCarry = 0;           // 프레임당 소수점 방출량 누적

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  geo.setDrawRange(0, 0);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: makePuffTexture() },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(0xe8ecf4) },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;   // 파티클이 넓게 퍼지므로 컬링하지 않음
  points.renderOrder = 3;
  points.raycast = () => {};      // 클릭 선택 방해 금지
  scene.add(points);

  function spawn(x, y, z, dirX, dirZ, power) {
    if (alive >= max) return;
    const i = alive++;
    const spread = 0.35;
    pos[i * 3] = x + (Math.random() - 0.5) * 0.3;
    pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.1;
    pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
    // 노즐 방향으로 뿜고 살짝 퍼지며, 아주 천천히 떠오른다
    vel[i * 3] = dirX * (0.7 + Math.random() * 0.7) * power + (Math.random() - 0.5) * spread;
    vel[i * 3 + 1] = 0.12 + Math.random() * 0.22;
    vel[i * 3 + 2] = dirZ * (0.7 + Math.random() * 0.7) * power + (Math.random() - 0.5) * spread;
    age[i] = 0;
    life[i] = 4.5 + Math.random() * 3.5;
    size[i] = 26 + Math.random() * 26;
    grow[i] = 14 + Math.random() * 16;
    alpha[i] = 0;
  }

  function kill(i) {
    const last = --alive;
    if (i !== last) {
      for (let k = 0; k < 3; k++) { pos[i * 3 + k] = pos[last * 3 + k]; vel[i * 3 + k] = vel[last * 3 + k]; }
      age[i] = age[last]; life[i] = life[last]; size[i] = size[last]; grow[i] = grow[last]; alpha[i] = alpha[last];
    }
  }

  return {
    points,
    get count() { return alive; },

    // machines: [{ x, y, z, rot }] — 노즐 위치와 방향(rot: y축 회전)
    // opts: { on, density(0~1), burst(이번 프레임 추가 분사량) }
    update(dt, machines, { on = true, density = 0.6, burst = 0 } = {}) {
      // 1) 방출
      if (on && machines.length) {
        const perMachine = (5 + density * 26) * dt + burst;
        for (const m of machines) {
          emitCarry += perMachine;
          const n = Math.floor(emitCarry);
          emitCarry -= n;
          const dx = Math.sin(m.rot ?? 0), dz = Math.cos(m.rot ?? 0);
          for (let k = 0; k < n; k++) spawn(m.x, m.y, m.z, dx, dz, 0.6 + density * 0.9);
        }
      }
      // 2) 갱신
      for (let i = alive - 1; i >= 0; i--) {
        age[i] += dt;
        if (age[i] >= life[i]) { kill(i); continue; }
        const u = age[i] / life[i];
        // 공기 저항으로 점점 느려지고, 바닥에 깔리듯 퍼진다
        const drag = Math.max(0, 1 - dt * 0.85);
        vel[i * 3] *= drag; vel[i * 3 + 2] *= drag;
        vel[i * 3 + 1] = vel[i * 3 + 1] * (1 - dt * 0.5) + 0.02 * dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.05) pos[i * 3 + 1] = 0.05; // 바닥 아래로 내려가지 않게
        size[i] += grow[i] * dt;
        // 서서히 나타났다가 천천히 사라짐
        alpha[i] = Math.min(1, u * 6) * (1 - u) * (1 - u) * (0.45 + density * 0.5);
      }
      geo.setDrawRange(0, alive);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
      geo.attributes.alpha.needsUpdate = true;
      points.visible = alive > 0;
    },

    // 공연 모드에서는 조명 빛줄기와 어우러지도록 살짝 더 진하게
    setPerform(perform) { mat.uniforms.uOpacity.value = perform ? 1.15 : 0.85; },

    clear() { alive = 0; geo.setDrawRange(0, 0); points.visible = false; },

    dispose() { scene.remove(points); geo.dispose(); mat.dispose(); },
  };
}
