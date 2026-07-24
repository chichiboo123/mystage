// 인물 꾸미기 — 색상 · 의상 · 표정 · 액세서리 선택지와 UI(아코디언)
// 순수 데이터 + DOM UI만 담당한다. 3D 모델 생성은 props.js의 person()이 해석한다.

// 초등학생이 구별하기 쉬운 14색 팔레트 (흰색·검은색 포함)
export const PALETTE = [
  { id: '#ffffff', name: '흰색' },
  { id: '#1a1a1a', name: '검은색' },
  { id: '#9098a4', name: '회색' },
  { id: '#8a5a30', name: '갈색' },
  { id: '#d94040', name: '빨강' },
  { id: '#e78a2e', name: '주황' },
  { id: '#ecc94b', name: '노랑' },
  { id: '#48a860', name: '초록' },
  { id: '#3bc4a0', name: '민트' },
  { id: '#7fd4ff', name: '하늘색' },
  { id: '#4a7fd4', name: '파랑' },
  { id: '#26346b', name: '남색' },
  { id: '#8e5bc9', name: '보라' },
  { id: '#e883b0', name: '분홍' },
];
const PALETTE_COLORS = PALETTE.map(c => c.id);

export const ACTOR_OPTIONS = {
  skin: ['#f5d3b3', '#e8b88f', '#c68d5e', '#8d5a3b', '#5e3a22', '#f0c8a0'],
  hair: PALETTE_COLORS,
  hairStyle: [
    { id: 'short', name: '짧은 머리' }, { id: 'long', name: '긴 머리' },
    { id: 'ponytail', name: '묶은 머리' }, { id: 'bun', name: '동그란 머리' },
    { id: 'none', name: '민머리' },
  ],
  shirt: PALETTE_COLORS,
  pants: PALETTE_COLORS,
  hatColor: PALETTE_COLORS,
  outfit: [
    { id: 'tshirt', name: '티셔츠', emoji: '👕' }, { id: 'shirt', name: '셔츠', emoji: '👔' },
    { id: 'jacket', name: '재킷', emoji: '🧥' }, { id: 'dress', name: '드레스', emoji: '👗' },
    { id: 'hoodie', name: '후드', emoji: '🧵' }, { id: 'uniform', name: '교복', emoji: '🎒' },
    { id: 'stage', name: '공연복', emoji: '✨' }, { id: 'royal', name: '왕/여왕', emoji: '👑' },
    { id: 'sporty', name: '운동복', emoji: '🏃' },
  ],
  hat: [
    { id: 'none', name: '없음', emoji: '🚫' }, { id: 'cap', name: '야구모자', emoji: '🧢' },
    { id: 'crown', name: '왕관', emoji: '👑' }, { id: 'fedora', name: '챙모자', emoji: '🎩' },
    { id: 'headband', name: '머리띠', emoji: '💫' }, { id: 'ribbon', name: '리본', emoji: '🎀' },
    { id: 'beanie', name: '비니', emoji: '🧶' },
  ],
  glasses: [
    { id: 'none', name: '없음', emoji: '🚫' }, { id: 'glasses', name: '안경', emoji: '👓' },
    { id: 'sunglasses', name: '선글라스', emoji: '🕶️' },
  ],
  item: [
    { id: 'none', name: '없음', emoji: '🚫' }, { id: 'mic', name: '마이크', emoji: '🎤' },
    { id: 'guitar', name: '기타', emoji: '🎸' }, { id: 'violin', name: '바이올린', emoji: '🎻' },
    { id: 'keytar', name: '키보드', emoji: '🎹' }, { id: 'book', name: '대본/책', emoji: '📖' },
  ],
  face: [
    { id: 'basic', name: '기본', emoji: '🙂' }, { id: 'smile', name: '미소', emoji: '😊' },
    { id: 'laugh', name: '크게 웃기', emoji: '😄' }, { id: 'surprise', name: '놀람', emoji: '😮' },
    { id: 'sad', name: '슬픔', emoji: '😢' }, { id: 'angry', name: '화남', emoji: '😠' },
    { id: 'nervous', name: '긴장', emoji: '😥' }, { id: 'wink', name: '윙크', emoji: '😉' },
    { id: 'sing', name: '노래', emoji: '🎵' }, { id: 'closed', name: '눈 감기', emoji: '😌' },
  ],
};

// 인물 종류별 기본 꾸미기값 (기존 인물의 개성 유지)
const DEFAULTS = {
  actor:    { shirt: '#d94040', pants: '#31435e', hair: '#4a3626', skin: '#e8b88f', hairStyle: 'short', face: 'basic', outfit: 'tshirt', hat: 'none', hatColor: '#ffd54a', glasses: 'none', item: 'none' },
  child:    { shirt: '#ffcf4d', pants: '#48a860', hair: '#4a3626', skin: '#f5d3b3', hairStyle: 'short', face: 'smile', outfit: 'tshirt', hat: 'none', hatColor: '#e78a2e', glasses: 'none', item: 'none' },
  singer:   { shirt: '#c026d3', pants: '#1e1e28', hair: '#2b2118', skin: '#e8b88f', hairStyle: 'long', face: 'sing', outfit: 'stage', hat: 'none', hatColor: '#ecc94b', glasses: 'none', item: 'mic' },
  dancer:   { shirt: '#e883b0', pants: '#e883b0', hair: '#2b2118', skin: '#e8b88f', hairStyle: 'ponytail', face: 'smile', outfit: 'dress', hat: 'none', hatColor: '#ecc94b', glasses: 'none', item: 'none' },
  king:     { shirt: '#8e5bc9', pants: '#4a1266', hair: '#caa64a', skin: '#e8b88f', hairStyle: 'short', face: 'basic', outfit: 'royal', hat: 'crown', hatColor: '#ffd54a', glasses: 'none', item: 'none' },
  narrator: { shirt: '#26346b', pants: '#1a2540', hair: '#2b2118', skin: '#e8b88f', hairStyle: 'short', face: 'basic', outfit: 'jacket', hat: 'none', hatColor: '#8a5a30', glasses: 'glasses', item: 'book' },
};
export function defaultCfgFor(type) {
  return { ...(DEFAULTS[type] || DEFAULTS.actor) };
}

export function randomActorCfg() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const pid = a => pick(a).id;
  return {
    skin: pick(ACTOR_OPTIONS.skin), hair: pick(ACTOR_OPTIONS.hair),
    hairStyle: pid(ACTOR_OPTIONS.hairStyle), shirt: pick(ACTOR_OPTIONS.shirt),
    pants: pick(ACTOR_OPTIONS.pants), face: pid(ACTOR_OPTIONS.face),
    outfit: pid(ACTOR_OPTIONS.outfit), hat: pid(ACTOR_OPTIONS.hat),
    hatColor: pick(ACTOR_OPTIONS.hatColor), glasses: pid(ACTOR_OPTIONS.glasses),
    item: 'none',
  };
}

// 저장/이전 버전 대비 — 빠진 항목은 기본값으로 채운다
export function normalizeCfg(cfg, type = 'actor') {
  const merged = { ...defaultCfgFor(type), ...(cfg || {}) };
  // v2 의 'cap' 머리모양 → 새 모자 시스템으로 이관
  if (merged.hairStyle === 'cap') { merged.hairStyle = 'short'; if (merged.hat === 'none') merged.hat = 'cap'; }
  return merged;
}

// ---------- 아코디언 꾸미기 UI ----------
// opts.pose = { list, get, set } 를 넘기면 '자세·움직임' 섹션을 함께 그린다.
export function buildCustomizerUI(container, getCfg, setCfg, opts = {}) {
  container.innerHTML = '';
  const cfg = getCfg();

  const section = (title, emoji, open) => {
    const d = document.createElement('details'); d.className = 'cz-sec'; if (open) d.open = true;
    const s = document.createElement('summary'); s.innerHTML = `<span class="cz-emoji">${emoji}</span>${title}`;
    d.appendChild(s); container.appendChild(d); return d;
  };
  const colorRow = (parent, label, colors, key) => {
    const row = document.createElement('div'); row.className = 'chip-row';
    row.innerHTML = `<span class="chip-label">${label}</span>`;
    const set = document.createElement('div'); set.className = 'chip-set';
    colors.forEach(col => {
      const b = document.createElement('button');
      const white = col.toLowerCase() === '#ffffff';
      b.className = 'color-chip' + (cfg[key] === col ? ' active' : '') + (white ? ' is-white' : '');
      b.style.background = col; b.title = (PALETTE.find(p => p.id === col)?.name) || col;
      b.setAttribute('aria-label', b.title);
      b.addEventListener('click', () => { setCfg({ ...getCfg(), [key]: col }); rebuild(); });
      set.appendChild(b);
    });
    row.appendChild(set); parent.appendChild(row);
  };
  const optRow = (parent, label, options, key) => {
    const row = document.createElement('div'); row.className = 'chip-row';
    row.innerHTML = `<span class="chip-label">${label}</span>`;
    const set = document.createElement('div'); set.className = 'chip-set';
    options.forEach(o => {
      const b = document.createElement('button'); b.className = 'opt-chip' + (cfg[key] === o.id ? ' active' : '');
      b.textContent = o.emoji ? `${o.emoji} ${o.name}` : o.name;
      b.addEventListener('click', () => { setCfg({ ...getCfg(), [key]: o.id }); rebuild(); });
      set.appendChild(b);
    });
    row.appendChild(set); parent.appendChild(row);
  };
  const rebuild = () => buildCustomizerUI(container, getCfg, setCfg, opts);

  // 자세·움직임 (맨 위 — 가장 자주 쓰는 기능)
  if (opts.pose) {
    const d = section('자세·움직임', '🤸', true);
    const row = document.createElement('div'); row.className = 'chip-row';
    const set = document.createElement('div'); set.className = 'chip-set';
    const curPose = opts.pose.get();
    opts.pose.list.forEach(p => {
      const b = document.createElement('button'); b.className = 'opt-chip pose-chip' + (curPose === p.id ? ' active' : '') + (p.animated ? ' anim' : '');
      b.textContent = `${p.emoji} ${p.name}`;
      b.title = p.animated ? '움직임 (반복 애니메이션)' : '멈춘 자세';
      b.addEventListener('click', () => { opts.pose.set(p.id); rebuild(); });
      set.appendChild(b);
    });
    row.appendChild(set); d.appendChild(row);
  }

  const body = section('몸', '🧍', true);
  colorRow(body, '피부색', ACTOR_OPTIONS.skin, 'skin');

  const head = section('머리', '💇', false);
  optRow(head, '머리 모양', ACTOR_OPTIONS.hairStyle, 'hairStyle');
  colorRow(head, '머리색', ACTOR_OPTIONS.hair, 'hair');

  const faceSec = section('얼굴', '😀', false);
  optRow(faceSec, '표정', ACTOR_OPTIONS.face, 'face');

  const outfit = section('의상', '👕', false);
  optRow(outfit, '옷 종류', ACTOR_OPTIONS.outfit, 'outfit');
  colorRow(outfit, '상의 색', ACTOR_OPTIONS.shirt, 'shirt');
  colorRow(outfit, '하의 색', ACTOR_OPTIONS.pants, 'pants');

  const acc = section('액세서리', '🎀', false);
  optRow(acc, '모자', ACTOR_OPTIONS.hat, 'hat');
  colorRow(acc, '모자·액세서리 색', ACTOR_OPTIONS.hatColor, 'hatColor');
  optRow(acc, '안경', ACTOR_OPTIONS.glasses, 'glasses');

  const item = section('소지품', '🎸', false);
  optRow(item, '손에 든 것', ACTOR_OPTIONS.item, 'item');
}
