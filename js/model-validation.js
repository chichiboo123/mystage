// 소품 모델 형태 점검 (개발용) — 모든 소품을 한 화면에 격자로 배치하고
// 바운딩 박스를 계산해 바닥에 제대로 놓이는지/비율이 이상한지 콘솔에 보고한다.
// 운영 화면에는 영향을 주지 않으며, URL 에 ?dev=1 이 있을 때 또는 window.__validateProps() 로만 실행된다.
import * as THREE from 'three';

// 배치 격자와 콘솔 리포트를 생성한다. layout=true 면 씬에 실제로 늘어놓는다.
export function runModelValidation({ scene, buildProp, categories, layout = true }) {
  const ids = [];
  for (const cat of categories) for (const it of cat.items) ids.push(it.id);

  const holder = new THREE.Group();
  holder.name = '__modelValidation';
  const cols = 8, gap = 3;
  const report = [];
  const FLOATING = new Set(['cloud', 'lantern']); // 일부러 공중/매달아 놓는 소품

  ids.forEach((id, i) => {
    let g;
    try { g = buildProp(id, 0, null); }
    catch (e) { report.push({ id, error: String(e) }); return; }

    const bb = new THREE.Box3().setFromObject(g);
    const size = new THREE.Vector3(); bb.getSize(size);
    const minY = bb.min.y;
    const grounded = FLOATING.has(id) || (minY > -0.15 && minY < 0.35); // 바닥에 자연스럽게 닿는가
    const sane = size.x < 6 && size.y < 6 && size.z < 6 && size.x > 0.05 && size.y > 0.05;
    report.push({
      id,
      size: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)],
      minY: +minY.toFixed(2),
      grounded, sane,
      ok: grounded && sane,
    });

    if (layout) {
      const cx = (i % cols) * gap - (cols - 1) * gap / 2;
      const cz = Math.floor(i / cols) * gap - 6;
      g.position.set(cx, -minY, cz); // 바닥(y=0)에 맞춰 내려놓기
      holder.add(g);
    }
  });

  if (layout && scene) scene.add(holder);

  const bad = report.filter(r => r.error || !r.ok);
  console.groupCollapsed(`%c[model-validation] ${report.length}개 소품 점검 — 문제 ${bad.length}개`, 'color:#4a7fd4;font-weight:bold');
  console.table(report);
  if (bad.length) console.warn('점검 필요:', bad);
  console.groupEnd();

  return { report, holder, remove: () => { if (holder.parent) holder.parent.remove(holder); } };
}
