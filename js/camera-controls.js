// 카메라 조작 — 화면 고정, 확대·축소, 화면 맞추기(기본 시점 복귀), 부드러운 전환
// OrbitControls를 감싸서 다른 편집 기능(드래그 선택 등)과 충돌하지 않게 잠금 상태를 한 곳에서 관리한다.
import * as THREE from 'three';

export function createCameraRig(camera, controls) {
  let tween = null;
  let locked = false;     // 사용자가 켠 '화면 고정'
  let dragPaused = false; // 드래그 선택 등 일시적 비활성

  function apply() {
    controls.enableRotate = !locked;
    controls.enablePan = !locked;
    controls.enableZoom = !locked;
    controls.enabled = !locked && !dragPaused;
  }

  function tweenTo(pos, tgt) {
    tween = {
      t: 0,
      fromP: camera.position.clone(), toP: new THREE.Vector3(...pos),
      fromT: controls.target.clone(), toT: new THREE.Vector3(...tgt),
    };
  }

  return {
    setLocked(v) { locked = !!v; if (locked) tween = null; apply(); },
    isLocked() { return locked; },
    // 드래그 선택 등에서 카메라를 잠깐 멈출 때 (고정 상태를 덮어쓰지 않음)
    pauseForDrag() { dragPaused = true; apply(); },
    resumeAfterDrag() { dragPaused = false; apply(); },

    tweenTo,
    // 무대 중심으로 부드럽게 복귀 (화면 맞추기)
    fitView(view) { if (!locked) tweenTo(view.pos, view.tgt); },

    // 확대(<1)·축소(>1) — 타깃을 향해 부드럽게 거리 조절
    zoomBy(factor) {
      if (locked) return;
      const dir = camera.position.clone().sub(controls.target);
      let len = dir.length() * factor;
      len = Math.max(controls.minDistance + 0.01, Math.min(controls.maxDistance - 0.01, len));
      const newPos = controls.target.clone().add(dir.setLength(len));
      tweenTo([newPos.x, newPos.y, newPos.z], [controls.target.x, controls.target.y, controls.target.z]);
    },

    update() {
      if (tween) {
        tween.t = Math.min(1, tween.t + 0.05);
        const e = 1 - Math.pow(1 - tween.t, 3);
        camera.position.lerpVectors(tween.fromP, tween.toP, e);
        controls.target.lerpVectors(tween.fromT, tween.toT, e);
        if (tween.t >= 1) tween = null;
      }
    },
  };
}
