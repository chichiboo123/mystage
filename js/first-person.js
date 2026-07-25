// 일인칭 모드 — 무대 위를 걸어 다니는 사람의 눈높이에서 둘러본다.
// 방향키(또는 WASD)로 이동, 스페이스바로 점프, 화면을 끌면 고개를 돌린다.
// 태블릿·스마트폰에서는 화면 왼쪽 아래의 조이스틱과 점프 버튼을 쓴다.
import * as THREE from 'three';

const EYE = 1.5;        // 눈높이 (사람 모델 머리 안쪽)
const STEP_UP = 0.65;   // 이 높이까지는 자동으로 걸어 올라감 (반블록·계단)
const BODY = 1.7;       // 머리까지 필요한 공간
const GRAVITY = 22;
const JUMP_V = 8.1;     // 블록 한 칸(1.0)은 넉넉히 뛰어올라 갈 수 있는 높이
const WALK = 4.2;
const RUN = 6.6;
const PITCH_LIMIT = Math.PI / 2 - 0.05;

export function createFirstPerson({ scene, camera, blocks, buildAvatar, applyPose, worldBounds }) {
  const avatar = new THREE.Group();
  avatar.visible = false;
  scene.add(avatar);
  let body = null;

  const pos = new THREE.Vector3(0.5, 0, 6);  // 발 위치
  let yaw = 0, pitch = 0, velY = 0, onGround = true;
  let active = false;
  let bobT = 0;

  const keys = new Set();
  const stick = { x: 0, y: 0 };   // 모바일 조이스틱 (-1~1)
  let jumpQueued = false;

  // ---------- 블록 충돌 ----------
  const topOf = (y, b) => y + (b.shape === 'slab' ? 0.5 : 1);
  // (cx,cz) 기둥에서 ceilY 이하의 가장 높은 블록 윗면 (없으면 바닥 0)
  function groundAt(cx, cz, ceilY) {
    const start = Math.min(Math.floor(ceilY), (worldBounds?.maxY ?? 16) - 1);
    for (let y = start; y >= 0; y--) {
      const b = blocks.get(`${cx},${y},${cz}`);
      if (!b) continue;
      const top = topOf(y, b);
      if (top <= ceilY + 1e-6) return top;
    }
    return 0;
  }
  // 그 자리에 설 수 있으면 발 높이를, 없으면 null
  function standHeight(x, z, feetY) {
    const cx = Math.floor(x), cz = Math.floor(z);
    const g = groundAt(cx, cz, feetY + STEP_UP);
    if (g - feetY > STEP_UP) return null;                 // 너무 높은 벽
    for (let y = Math.floor(g); y <= Math.floor(g + BODY); y++) {
      const b = blocks.get(`${cx},${y},${cz}`);
      if (!b) continue;
      const bTop = topOf(y, b);
      if (bTop > g + 0.12 && y < g + BODY) return null;   // 몸통이 블록과 겹침
    }
    return g;
  }

  // ---------- 조작 ----------
  function onKeyDown(e) {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(k)) e.preventDefault();
    if (k === ' ') jumpQueued = true;
    keys.add(k);
  }
  function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }

  function look(dx, dy) {
    yaw -= dx * 0.0042;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch - dy * 0.0042));
  }

  // ---------- 갱신 ----------
  function update(dt, t) {
    if (!active) return;

    // 입력 → 진행 방향 (카메라가 보는 쪽 기준)
    let fwd = 0, side = 0;
    if (keys.has('arrowup') || keys.has('w')) fwd += 1;
    if (keys.has('arrowdown') || keys.has('s')) fwd -= 1;
    if (keys.has('arrowleft') || keys.has('a')) side -= 1;
    if (keys.has('arrowright') || keys.has('d')) side += 1;
    fwd += stick.y; side += stick.x;
    const mag = Math.hypot(fwd, side);
    if (mag > 1) { fwd /= mag; side /= mag; }

    const speed = (keys.has('shift') ? RUN : WALK);
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    // yaw=0 일 때 -Z 를 바라본다
    const dx = (-sin * fwd + cos * side) * speed * dt;
    const dz = (-cos * fwd - sin * side) * speed * dt;
    const moving = Math.hypot(fwd, side) > 0.05;

    // 수평 이동 (막히면 벽을 따라 미끄러지도록 축을 나눠 시도)
    if (dx || dz) {
      const tryMove = (nx, nz) => {
        const g = standHeight(nx, nz, pos.y);
        if (g === null) return false;
        pos.x = nx; pos.z = nz;
        if (onGround && g > pos.y) pos.y = g;   // 낮은 턱은 걸어 올라감
        return true;
      };
      if (!tryMove(pos.x + dx, pos.z + dz)) { tryMove(pos.x + dx, pos.z); tryMove(pos.x, pos.z + dz); }
      // 세계 밖으로 나가지 않게
      if (worldBounds) {
        pos.x = Math.min(worldBounds.maxX - 1, Math.max(worldBounds.minX + 1, pos.x));
        pos.z = Math.min(worldBounds.maxZ - 1, Math.max(worldBounds.minZ + 1, pos.z));
      }
    }

    // 점프·중력
    if (jumpQueued) { jumpQueued = false; if (onGround) { velY = JUMP_V; onGround = false; } }
    const prevY = pos.y;
    velY -= GRAVITY * dt;
    pos.y += velY * dt;
    // 떨어지기 직전 높이까지를 기준으로 바닥을 찾는다.
    // (내려간 뒤의 높이로만 찾으면 한 프레임 사이에 블록을 뚫고 지나간다)
    const ground = groundAt(Math.floor(pos.x), Math.floor(pos.z), Math.max(prevY, pos.y) + 0.02);
    if (pos.y <= ground) { pos.y = ground; velY = 0; onGround = true; }
    else onGround = false;

    // 아바타 배치·걷기 동작
    avatar.position.set(pos.x, pos.y, pos.z);
    avatar.rotation.y = yaw + Math.PI;   // 모델은 +Z 를 향하므로 시선 반대로
    if (body) applyPose(body, !onGround ? 'raise' : moving ? 'walk' : 'stand', t);

    // 카메라: 눈높이 + 걸을 때 살짝 흔들림
    if (moving && onGround) bobT += dt * (speed * 1.6);
    const bob = moving && onGround ? Math.sin(bobT * 2) * 0.035 : 0;
    camera.position.set(pos.x, pos.y + EYE + bob, pos.z);
    const dir = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    camera.lookAt(camera.position.clone().add(dir));
  }

  return {
    avatar,
    isActive: () => active,
    getState: () => ({ x: pos.x, y: pos.y, z: pos.z, yaw, pitch }),

    // 시작 지점: 무대 앞쪽(객석 방향)에서 무대를 바라보게
    enter({ x = 0.5, z = 8, cfg = null, facing = 0 } = {}) {
      if (!active) {
        if (body) avatar.remove(body);
        body = buildAvatar(cfg);
        // 카메라가 머리 안쪽에 있으므로 머리·머리카락·모자를 숨긴다.
        // (숨기지 않으면 머리카락 블록이 화면 위쪽을 검게 가린다)
        const neck = body.userData?.rig?.neck;
        if (neck) neck.visible = false;
        avatar.add(body);
      }
      pos.set(x, 0, z);
      pos.y = groundAt(Math.floor(x), Math.floor(z), (worldBounds?.maxY ?? 16) - 1);
      yaw = facing; pitch = -0.05; velY = 0; onGround = true;  // yaw=0 → -Z(윗무대), PI → +Z(객석)
      avatar.visible = true;
      active = true;
      keys.clear(); stick.x = stick.y = 0; jumpQueued = false;
      window.addEventListener('keydown', onKeyDown, { passive: false });
      window.addEventListener('keyup', onKeyUp);
    },

    exit() {
      active = false;
      avatar.visible = false;
      keys.clear(); stick.x = stick.y = 0;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },

    look,
    jump() { jumpQueued = true; },
    setStick(x, y) { stick.x = x; stick.y = y; },
    update,
  };
}
