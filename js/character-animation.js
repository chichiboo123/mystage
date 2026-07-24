// 인물 자세·움직임 — props.js person()의 골격(rig)을 시간값으로 구동한다.
// rig = { core, neck, shoulderL, shoulderR, hipL, hipR } (모두 관절 그룹)
// 정적 '자세'와 반복 '움직임'을 구분해 제공한다. 과장되지 않게 진폭을 낮게 유지한다.

export const POSES = [
  { id: 'stand', name: '서 있기', emoji: '🧍', animated: false },
  { id: 'walk',  name: '걷기',   emoji: '🚶', animated: true  },
  { id: 'run',   name: '달리기', emoji: '🏃', animated: true  },
  { id: 'wave',  name: '손 흔들기', emoji: '👋', animated: true },
  { id: 'raise', name: '양팔 들기', emoji: '🙌', animated: false },
  { id: 'dance', name: '춤추기', emoji: '💃', animated: true  },
  { id: 'sit',   name: '앉기',   emoji: '🪑', animated: false },
  { id: 'bow',   name: '인사하기', emoji: '🙇', animated: false },
  { id: 'sing',  name: '노래하기', emoji: '🎤', animated: true },
  { id: 'play',  name: '악기 연주', emoji: '🎸', animated: true },
];
const POSE_MAP = Object.fromEntries(POSES.map(p => [p.id, p]));

export function isAnimatedPose(id) { return !!POSE_MAP[id]?.animated; }
export function poseName(id) { return POSE_MAP[id]?.name ?? '서 있기'; }
export const DEFAULT_POSE = 'stand';

function reset(rig) {
  rig.core.rotation.set(0, 0, 0); rig.core.position.y = 0.6;
  rig.neck.rotation.set(0, 0, 0);
  rig.shoulderL.rotation.set(0, 0, 0); rig.shoulderR.rotation.set(0, 0, 0);
  rig.hipL.rotation.set(0, 0, 0); rig.hipR.rotation.set(0, 0, 0);
}

// group: person 루트 그룹. poseId: 자세. t: 경과 시간(초). 없으면 정적 자세만.
export function applyPose(group, poseId, t = 0) {
  const rig = group?.userData?.rig;
  if (!rig) return;
  reset(rig);
  const ph = t + (group.userData.animPhase || 0);

  switch (poseId) {
    case 'walk': {
      const s = Math.sin(ph * 3.2);
      rig.hipL.rotation.x = s * 0.5; rig.hipR.rotation.x = -s * 0.5;
      rig.shoulderR.rotation.x = s * 0.45; rig.shoulderL.rotation.x = -s * 0.45;
      rig.core.position.y = 0.6 + Math.abs(Math.sin(ph * 3.2)) * 0.02;
      break;
    }
    case 'run': {
      const s = Math.sin(ph * 5.0);
      rig.core.rotation.x = 0.22;
      rig.hipL.rotation.x = s * 0.85; rig.hipR.rotation.x = -s * 0.85;
      rig.shoulderR.rotation.x = s * 0.75; rig.shoulderL.rotation.x = -s * 0.75;
      rig.core.position.y = 0.6 + Math.abs(Math.sin(ph * 5.0)) * 0.05;
      break;
    }
    case 'wave': {
      rig.shoulderR.rotation.z = 2.5 + Math.sin(ph * 6) * 0.25; // 오른팔 위로 흔들기
      rig.shoulderL.rotation.z = 0.1;
      break;
    }
    case 'raise': {
      rig.shoulderR.rotation.z = 2.85; rig.shoulderL.rotation.z = -2.85; // 양팔 위로
      break;
    }
    case 'dance': {
      const s = Math.sin(ph * 2.6);
      rig.core.rotation.z = s * 0.12;
      rig.shoulderR.rotation.z = 1.9 + s * 0.7;
      rig.shoulderL.rotation.z = -1.9 + s * 0.7;
      rig.hipL.rotation.x = s * 0.15; rig.hipR.rotation.x = -s * 0.15;
      rig.core.position.y = 0.6 + Math.abs(s) * 0.03;
      break;
    }
    case 'sit': {
      rig.core.position.y = 0.32;
      rig.hipL.rotation.x = -1.45; rig.hipR.rotation.x = -1.45; // 허벅지 앞으로
      rig.shoulderL.rotation.x = 0.25; rig.shoulderR.rotation.x = 0.25;
      break;
    }
    case 'bow': {
      rig.core.rotation.x = 0.85;   // 상체 앞으로 숙이기
      rig.shoulderL.rotation.x = 0.4; rig.shoulderR.rotation.x = 0.4;
      break;
    }
    case 'sing': {
      rig.shoulderR.rotation.z = 1.4; rig.shoulderR.rotation.x = 0.5; // 한 손 마이크 자세
      rig.core.rotation.z = Math.sin(ph * 2.4) * 0.07;
      break;
    }
    case 'play': {
      rig.shoulderL.rotation.x = 1.05 + Math.sin(ph * 4) * 0.08;
      rig.shoulderR.rotation.x = 1.05 - Math.sin(ph * 4) * 0.08;
      rig.shoulderL.rotation.z = 0.25; rig.shoulderR.rotation.z = -0.25;
      break;
    }
    default: // stand
      rig.shoulderL.rotation.z = 0.06; rig.shoulderR.rotation.z = -0.06;
      break;
  }
}
