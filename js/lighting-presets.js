// 조명 세트(프리셋) — 자주 쓰는 조명 배치를 미리 만들어 둔다.
// build(frame) 는 createLight 에 넘길 수 있는 조명 설정 배열을 돌려준다.
// frame = { cx, cz, cy, w, d, gridY, backZ, frontZ, fohZ }
//  cx,cz : 무대 중심 / cy : 무대 바닥 높이 / gridY : 배튼(천장 봉) 높이
//  backZ : 무대 뒤쪽 z / frontZ : 무대 앞쪽 z / fohZ : 객석 쪽(프론트 오브 하우스) z

function L(type, pos, target, color, intensity, angle) {
  return { type, color, intensity, angle, on: true, pos, target };
}
// 천장에서 특정 지점을 비추는 조명
function top(fr, dx, dz, color, intensity = 5, angle = 24, type = 'spot') {
  return L(type, [fr.cx + dx, fr.gridY, fr.cz + dz + 1], [fr.cx + dx, fr.cy, fr.cz + dz], color, intensity, angle);
}
// 바닥에서 위로 쏘는 업라이트
function up(fr, dx, dz, color, intensity = 4, angle = 34) {
  return L('floor', [fr.cx + dx, fr.cy + 0.15, fr.cz + dz], [fr.cx + dx, fr.cy + 6, fr.cz + dz], color, intensity, angle);
}
// 객석 쪽(프론트)에서 무대를 비추는 조명
function foh(fr, dx, color, intensity = 5, angle = 20, type = 'spot') {
  return L(type, [fr.cx + dx, fr.gridY - 0.5, fr.fohZ], [fr.cx + dx, fr.cy + 1, fr.cz], color, intensity, angle);
}
// 뒤에서 앞으로 쏘는 백라이트
function back(fr, dx, color, intensity = 5, angle = 26) {
  return L('spot', [fr.cx + dx, fr.gridY, fr.backZ - 0.5], [fr.cx + dx, fr.cy + 1, fr.cz], color, intensity, angle);
}

const WARM = '#ffd9a0', COOL = '#bcd4ff', WHITE = '#fff6e6', AMBER = '#ffb347';

export const LIGHT_PRESETS = [
  { id: 'general', emoji: '🌤️', name: '기본 무대 조명', desc: '따뜻한 색과 차가운 색을 앞에서 골고루 — 가장 무난한 기본 세트',
    build: fr => [foh(fr, -fr.w * 0.22, WARM, 5, 26), foh(fr, fr.w * 0.22, COOL, 5, 26), top(fr, 0, -fr.d * 0.2, WHITE, 3.5, 40, 'wash')] },

  { id: 'mccandless', emoji: '🎯', name: '매캔들리스', desc: '왼쪽 따뜻한 빛 + 오른쪽 차가운 빛 45°로 얼굴을 입체감 있게',
    build: fr => [foh(fr, -fr.w * 0.3, WARM, 6, 22), foh(fr, fr.w * 0.3, COOL, 6, 22)] },

  { id: 'solo', emoji: '🔦', name: '독백 스포트', desc: '무대 중앙에 하얀 스포트 하나 — 주인공의 독백 장면',
    build: fr => [top(fr, 0, 0, WHITE, 8, 15), back(fr, 0, COOL, 2.5, 30)] },

  { id: 'warm_day', emoji: '☀️', name: '따뜻한 낮', desc: '노란 햇살이 가득한 밝고 포근한 장면',
    build: fr => [foh(fr, -fr.w * 0.2, WARM, 5, 30), foh(fr, fr.w * 0.2, AMBER, 5, 30), top(fr, 0, 0, '#fff0c0', 4, 45, 'wash')] },

  { id: 'cool_night', emoji: '🌙', name: '차가운 밤', desc: '푸른 달빛이 내려앉은 고요한 밤',
    build: fr => [top(fr, -fr.w * 0.15, -fr.d * 0.1, '#7fa8ff', 4, 40, 'wash'), top(fr, fr.w * 0.15, 0, '#5a7fd0', 4, 40, 'wash'), back(fr, 0, '#a0c0ff', 4, 24)] },

  { id: 'sunset', emoji: '🌇', name: '노을', desc: '주황빛에서 보랏빛으로 물드는 저녁 하늘',
    build: fr => [foh(fr, -fr.w * 0.28, '#ff8a3c', 5, 34), foh(fr, fr.w * 0.28, '#c86fd0', 4.5, 34), back(fr, 0, '#ff6a4a', 4, 30)] },

  { id: 'romantic', emoji: '💗', name: '로맨틱', desc: '부드러운 분홍과 호박색 — 따뜻하고 다정한 장면',
    build: fr => [foh(fr, -fr.w * 0.22, '#ff9ec4', 4.5, 28), foh(fr, fr.w * 0.22, '#ffcf9a', 4.5, 28), up(fr, 0, fr.d * 0.2, '#ff7fb0', 3, 40)] },

  { id: 'mystery', emoji: '🕵️', name: '미스터리', desc: '바닥에서 올라오는 초록·파랑 빛으로 으스스하게',
    build: fr => [up(fr, -fr.w * 0.2, 0, '#3fd07a', 4.5, 34), up(fr, fr.w * 0.2, 0, '#4a8fff', 4.5, 34), back(fr, 0, '#2a3a5a', 3, 30)] },

  { id: 'concert', emoji: '🎸', name: '콘서트', desc: '무빙 라이트가 돌고 색색의 빛이 번쩍이는 무대',
    build: fr => [top(fr, -fr.w * 0.3, 0, '#ff3b6b', 5, 18, 'moving'), top(fr, fr.w * 0.3, 0, '#3b8bff', 5, 18, 'moving'),
      top(fr, 0, -fr.d * 0.2, '#b03bff', 5, 18, 'moving'), foh(fr, 0, WHITE, 4, 24), up(fr, 0, fr.d * 0.2, '#ffd54a', 3, 40)] },

  { id: 'disco', emoji: '🪩', name: '디스코 파티', desc: '알록달록 무빙 라이트가 사방에서 춤춰요',
    build: fr => [top(fr, -fr.w * 0.28, -fr.d * 0.1, '#ff2e8f', 5, 16, 'moving'), top(fr, fr.w * 0.28, -fr.d * 0.1, '#2eff8f', 5, 16, 'moving'),
      top(fr, -fr.w * 0.28, fr.d * 0.15, '#2e8fff', 5, 16, 'moving'), top(fr, fr.w * 0.28, fr.d * 0.15, '#ffd52e', 5, 16, 'moving')] },

  { id: 'winter', emoji: '❄️', name: '겨울', desc: '차갑고 새하얀 눈의 세계',
    build: fr => [foh(fr, -fr.w * 0.2, '#cfe4ff', 5, 32), foh(fr, fr.w * 0.2, '#eaf2ff', 5, 32), up(fr, 0, 0, '#a8c8ff', 3, 44)] },

  { id: 'spring', emoji: '🌸', name: '봄·자연', desc: '연둣빛과 노란 햇살이 싱그러운 숲',
    build: fr => [foh(fr, -fr.w * 0.22, '#c8f088', 4.5, 32), foh(fr, fr.w * 0.22, '#fff0a0', 4.5, 32), top(fr, 0, -fr.d * 0.2, '#eaffc0', 3.5, 44, 'wash')] },

  { id: 'silhouette', emoji: '🌫️', name: '실루엣', desc: '뒤에서만 비춰 배우의 그림자를 극적으로',
    build: fr => [back(fr, -fr.w * 0.2, '#9ab0ff', 7, 30), back(fr, fr.w * 0.2, '#9ab0ff', 7, 30)] },

  { id: 'campfire', emoji: '🔥', name: '모닥불', desc: '바닥에서 타오르는 주황 불빛',
    build: fr => [up(fr, 0, 0, '#ff7a1a', 5, 38), up(fr, -fr.w * 0.15, fr.d * 0.1, '#ffb02e', 3.5, 34), up(fr, fr.w * 0.15, fr.d * 0.1, '#ff5a00', 3.5, 34)] },

  { id: 'fantasy', emoji: '🧚', name: '판타지', desc: '보라와 청록의 신비로운 마법 세계',
    build: fr => [top(fr, -fr.w * 0.2, 0, '#a24bff', 4.5, 30), top(fr, fr.w * 0.2, 0, '#2ee6d0', 4.5, 30), up(fr, 0, fr.d * 0.15, '#7a3bff', 3, 40), back(fr, 0, '#c86fff', 4, 26)] },

  { id: 'rainbow', emoji: '🌈', name: '무지개', desc: '빨주노초파보 여섯 빛깔이 나란히',
    build: fr => { const cols = ['#ff3b3b', '#ff9d3b', '#ffe14d', '#5ad06a', '#4aa3ff', '#b06aff']; return cols.map((c, i) => foh(fr, (-2.5 + i) * (fr.w / 6), c, 4, 18)); } },
];
