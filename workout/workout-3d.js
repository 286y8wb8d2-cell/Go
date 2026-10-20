// =============================================
// 3D 사람 모델로 동작 보여 주기
// - three.js(vendor/three.min.js) + GLTFLoader(vendor/GLTFLoader.js), 처음 열 때만 불러옴
// - 사람 모델: vendor/human.glb ("3D Male Base Mesh" by orange-juice-games, CC0 — 자유 이용)
// - 동작 좌표는 workout-motion.js의 키프레임(옆모습 2D)을 그대로 쓰고,
//   모델 뼈 길이에 맞춰 무릎·팔꿈치를 3D로 다시 계산해서 뼈를 돌림
// - 쓰는 근육은 피부 색을 빨강(주로)·주황(보조)으로 칠하고, 힘이 드는 순간 더 진하게
// 3D가 안 되는 기기면 예전 막대 그림(moPlay)으로 대신함
// =============================================

let m3Loading = null;
let m3Renderer = null;
let m3Failed = false;
let m3Model = null; // 한 번 불러 두고 계속 씀 (한 번에 창 하나만 열림)

const M3_SKIN = 0xe0b48f;
const M3_SHORTS = 0x2b3442;
const M3_HAIR = 0x2e231c;
const M3_HOT = 0xe34948;    // 주로 쓰는 근육
const M3_HELP = 0xeda100;   // 보조 근육

function m3Script(src) {
  return new Promise((resolve) => {
    const sc = document.createElement("script");
    sc.src = src;
    sc.onload = () => resolve(true);
    sc.onerror = () => resolve(false);
    document.head.appendChild(sc);
  });
}

// three.js → GLTFLoader → 사람 모델 순서로 (한 번만)
function m3Load() {
  if (m3Model) return Promise.resolve(true);
  if (m3Loading) return m3Loading;
  m3Loading = (async () => {
    if (!window.THREE && !(await m3Script("vendor/three.min.js?v=149"))) return false;
    if (!THREE.GLTFLoader && !(await m3Script("vendor/GLTFLoader.js?v=149"))) return false;
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false; // 색을 적은 그대로 보이게
    try {
      const gltf = await new THREE.GLTFLoader().loadAsync("vendor/human.glb?v=1");
      m3Model = m3Prepare(gltf.scene);
      return true;
    } catch (e) {
      return false;
    }
  })();
  return m3Loading;
}

function m3GetRenderer() {
  if (m3Renderer || m3Failed) return m3Renderer;
  try {
    m3Renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    m3Renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    m3Renderer.shadowMap.enabled = true;
    m3Renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    m3Renderer.outputEncoding = THREE.sRGBEncoding;
  } catch (e) {
    m3Failed = true;
    m3Renderer = null;
  }
  return m3Renderer;
}

// ---------- 모델 준비: 뼈 찾기, 길이 재기, 피부를 근육 부위로 나누기 ----------
function m3Prepare(root) {
  const T = THREE;
  root.updateMatrixWorld(true);
  const bones = {};
  let mesh = null;
  root.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isSkinnedMesh) mesh = o;
  });
  const head = (n) => new T.Vector3().setFromMatrixPosition(bones[n].matrixWorld);
  const restQ = {};
  Object.keys(bones).forEach((n) => (restQ[n] = bones[n].getWorldQuaternion(new T.Quaternion())));
  const box = new T.Box3().setFromObject(mesh);

  // 길이(미터) → 동작 좌표(다리 길이 40)로 바꾸는 배율
  const hipL = head("thighL"), kneeL = head("shinL"), ankL = head("footL");
  const SC = 40 / (hipL.distanceTo(kneeL) + kneeL.distanceTo(ankL));
  const shL = head("upper_armL"), elL = head("forearmL"), wrL = head("handL");
  const hipC = hipL.clone().add(head("thighR")).multiplyScalar(0.5);
  const shC = shL.clone().add(head("upper_armR")).multiplyScalar(0.5);
  const L = {
    SC: SC,
    thigh: hipL.distanceTo(kneeL) * SC,
    shin: kneeL.distanceTo(ankL) * SC,
    upper: shL.distanceTo(elL) * SC,
    fore: (elL.distanceTo(wrL) + 0.045) * SC, // 손바닥 가운데까지
    torso: shC.distanceTo(hipC) * SC,
    ankle: (ankL.y - box.min.y) * SC, // 발목 높이
    spineOff: head("spine").sub(hipC).multiplyScalar(SC), // 엉덩이 가운데 → spine 뼈 시작
  };

  // 피부 점마다 근육 부위 정하기 (서 있는 기본 자세 기준, 앞=+X 위=+Y 오른쪽=+Z)
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const sIdx = geo.attributes.skinIndex;
  const sW = geo.attributes.skinWeight;
  const names = mesh.skeleton.bones.map((b) => b.name);
  const n = pos.count;
  const region = new Array(n).fill("");
  const cover = new Array(n).fill("skin"); // skin | shorts | hair
  const v = new T.Vector3();
  const yHip = hipC.y, yKnee = kneeL.y, ySh = shC.y;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);
    let best = 0;
    let bw = -1;
    ["getX", "getY", "getZ", "getW"].forEach((g) => {
      const wt = sW[g](i);
      if (wt > bw) { bw = wt; best = sIdx[g](i); }
    });
    const bn = names[best].replace(/[LR]$/, "");
    let r = "";
    if (bn === "thigh") {
      const t = (yHip - v.y) / (yHip - yKnee);
      const c = hipL.clone().lerp(kneeL, Math.min(Math.max(t, 0), 1));
      const rx = v.x - c.x;
      const rz = Math.abs(v.z) - Math.abs(c.z); // + 바깥, - 안쪽
      if (t < 0.15 && rx < 0) r = "glutes";
      else if (rx > Math.abs(rz) * 0.7) r = "quads";
      else if (rx < -Math.abs(rz) * 0.7) r = "hams";
      else r = rz < 0 ? "adductors" : "quads";
      if (t < 0.42) cover[i] = "shorts";
    } else if (bn === "shin") {
      const t = (yKnee - v.y) / (yKnee - ankL.y);
      if (v.x < kneeL.x - 0.005 && t < 0.72) r = "calves";
    } else if (bn === "spine" || bn === "pelvis") {
      if (v.x < hipC.x - 0.03) r = v.y < yHip + 0.07 ? "glutes" : "lowback";
      else if (Math.abs(v.z) > 0.12) r = "hipabd";
      else if (v.y > yHip + 0.05) r = "abs";
      if (v.y < yHip + 0.1) cover[i] = "shorts";
    } else if (bn === "spine001" || bn === "spine002") {
      if (v.x > 0.03) r = Math.abs(v.z) < 0.075 ? "abs" : "obliques";
      else if (v.x < -0.03) r = Math.abs(v.z) < 0.07 ? "lowback" : "back";
      else r = "obliques";
    } else if (bn === "spine003") {
      if (v.x > 0.02) r = v.y > ySh - 0.2 ? "chest" : "abs";
      else r = "back";
    } else if (bn === "shoulder") {
      r = Math.abs(v.z) > 0.15 ? "shoulder" : v.x < 0 ? "back" : "chest";
    } else if (bn === "upper_arm") {
      const t = (ySh - v.y) / (ySh - elL.y);
      if (t < 0.3) r = "shoulder";
      else r = v.x > head(names[best]).x - 0.005 ? "biceps" : "triceps";
    } else if (bn === "forearm") {
      r = "forearm";
    } else if (bn === "spine004") {
      r = v.x < 0 && v.y < ySh + 0.1 ? "back" : "";
    } else if (bn === "spine005") {
      if (v.y > box.max.y - 0.1 || (v.x < -0.03 && v.y > box.max.y - 0.2)) cover[i] = "hair";
    }
    region[i] = r;
  }
  const colors = new Float32Array(n * 3);
  geo.setAttribute("color", new T.BufferAttribute(colors, 3));
  mesh.material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  root.scale.setScalar(SC);
  const handRest = { L: bones.handL.quaternion.clone(), R: bones.handR.quaternion.clone() };
  return { root: root, mesh: mesh, bones: bones, restQ: restQ, handRest: handRest, L: L, region: region, cover: cover, colors: colors };
}

// ---------- 계산 도우미 ----------
// 3D 두 마디 팔다리: A에서 목표 Tg로, pole 쪽으로 굽힘 → [관절, 끝점]
function m3Ik(A, Tg, l1, l2, pole) {
  const d = Tg.clone().sub(A);
  let dist = d.length() || 0.001;
  const nrm = d.clone().divideScalar(dist);
  dist = Math.min(dist, l1 + l2 - 0.01);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pp = pole.clone().sub(nrm.clone().multiplyScalar(pole.dot(nrm)));
  if (pp.lengthSq() < 1e-6) pp.set(1, 0, 0).sub(nrm.clone().multiplyScalar(nrm.x));
  pp.normalize();
  const J = A.clone().addScaledVector(nrm, a).addScaledVector(pp, h);
  return [J, A.clone().addScaledVector(nrm, dist)];
}

// 뼈를 세계 기준 방향 dir(뼈가 뻗는 쪽)과 front(앞쪽)에 맞춰 돌림
function m3Aim(bone, restQ, dir, front) {
  const T = THREE;
  const Y = dir.clone().normalize();
  let F = front.clone().sub(Y.clone().multiplyScalar(front.dot(Y)));
  if (F.lengthSq() < 1e-6) F = new T.Vector3(0, 1, 0).sub(Y.clone().multiplyScalar(Y.y));
  F.normalize();
  // 기본 자세에서 이 뼈의 "앞"(+X)이 뼈 안에서 어느 쪽인지
  const lf = new T.Vector3(1, 0, 0).applyQuaternion(restQ.clone().invert());
  lf.y = 0;
  lf.normalize();
  const ly = new T.Vector3(0, 1, 0);
  const A = new T.Matrix4().makeBasis(lf, ly, new T.Vector3().crossVectors(lf, ly));
  const Bm = new T.Matrix4().makeBasis(F, Y, new T.Vector3().crossVectors(F, Y));
  const world = new T.Quaternion().setFromRotationMatrix(Bm.multiply(A.transpose()));
  const parentQ = bone.parent.getWorldQuaternion(new T.Quaternion());
  bone.quaternion.copy(parentQ.invert().multiply(world));
  bone.updateMatrixWorld(true);
}

function m3Mat(color, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.65, metalness: 0.02 }, extra || {}));
}

// 동작 그림 시작: box에 3D 장면을 넣고, 멈추는 함수를 돌려줌. 안 되면 null
function m3Play(box, key, weight, exName) {
  const mo = WK_MOTIONS[key];
  const R = m3GetRenderer();
  const M = m3Model;
  if (!mo || !R || !M) return null;
  const T = THREE;
  const L = M.L;
  const lift = L.ankle; // 발목이 바닥보다 이만큼 위 → 모든 높이를 이만큼 올림
  box.innerHTML = "";
  const w = (box.clientWidth || 328) - 8; // 상자 안쪽 여백만큼 빼기
  const h = Math.round(w * 0.85);
  R.setSize(w, h);
  box.appendChild(R.domElement);
  R.domElement.className = "m3-canvas";

  const front = mo.view === "front";
  const fx = mo.flip ? -1 : 1;
  // 2D 동작 좌표 ↔ 3D (y는 위가 +, 바닥 = 0)
  const map = (p2, z) => front
    ? new T.Vector3(0, MO_GROUND - p2[1] + lift, -(p2[0] - 80))
    : new T.Vector3(fx * (p2[0] - 80), MO_GROUND - p2[1] + lift, z);
  const unmap = (v3) => front ? [80 - v3.z, MO_GROUND + lift - v3.y] : [80 + fx * v3.x, MO_GROUND + lift - v3.y];

  const scene = new T.Scene();
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  // 빛
  scene.add(new T.HemisphereLight(0xffffff, 0x8d96a3, 0.6));
  const sun = new T.DirectionalLight(0xffffff, 1.0);
  sun.position.set(70, 170, 110);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
  scene.add(sun);
  const fill = new T.DirectionalLight(0xdbe6ff, 0.4);
  fill.position.set(-120, 60, -60);
  scene.add(fill);

  // 바닥 (멀리 갈수록 배경색으로 흐려짐)
  scene.fog = new T.Fog(0xf6f8fa, 1, 2);
  if (!mo.noGround) {
    const floor = new T.Mesh(track(new T.CircleGeometry(400, 48)), track(m3Mat(0xd5dce4, { roughness: 1 })));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
  }

  // 벤치 · 철봉
  if (mo.bench) {
    const [bx, by, bw] = mo.bench;
    const top = MO_GROUND - by + lift;
    const cx = bx + bw / 2 - 80;
    const g = new T.Group();
    const seat = new T.Mesh(track(new T.BoxGeometry(bw, 4, 16)), track(m3Mat(0x8f84c9)));
    seat.position.set(0, top - 2, 0);
    seat.castShadow = seat.receiveShadow = true;
    g.add(seat);
    const legMat = track(m3Mat(0x55565c));
    [-1, 1].forEach((sx) => {
      const leg = new T.Mesh(track(new T.BoxGeometry(3, top - 4, 12)), legMat);
      leg.position.set(sx * (bw / 2 - 5), (top - 4) / 2, 0);
      leg.castShadow = true;
      g.add(leg);
    });
    if (front) {
      g.rotation.y = Math.PI / 2;
      g.position.set(0, 0, -cx);
    } else {
      g.position.set(fx * cx, 0, 0);
    }
    scene.add(g);
  }
  if (mo.bar) {
    const bar = new T.Mesh(track(new T.CylinderGeometry(1.2, 1.2, 80, 12)), track(m3Mat(0x777b82, { metalness: 0.6, roughness: 0.35 })));
    bar.rotation.x = Math.PI / 2;
    bar.position.set(2, MO_GROUND - mo.bar + lift, 0);
    scene.add(bar);
  }

  // 사람
  scene.add(M.root);
  const B = M.bones;

  // 기구
  const weights = [];
  if (weight === "kb") {
    const g = new T.Group();
    const bell = new T.Mesh(track(new T.SphereGeometry(5.2, 20, 16)), track(m3Mat(0xe8692f, { roughness: 0.45 })));
    bell.position.y = -6.5;
    const handle = new T.Mesh(track(new T.TorusGeometry(3.2, 0.9, 8, 20, Math.PI)), track(m3Mat(0x333333)));
    handle.position.y = -2.6;
    bell.castShadow = handle.castShadow = true;
    g.add(bell, handle);
    scene.add(g);
    weights.push(g);
  }
  if (weight === "db") {
    const dbMat = track(m3Mat(0x2a78d6, { roughness: 0.4 }));
    const barMat = track(m3Mat(0x555a60, { metalness: 0.5 }));
    for (let i = 0; i < 2; i++) {
      const g = new T.Group();
      g.add(new T.Mesh(track(new T.CylinderGeometry(0.9, 0.9, 9, 10)), barMat));
      [-1, 1].forEach((sd) => {
        const plate = new T.Mesh(track(new T.CylinderGeometry(2.8, 2.8, 2.6, 16)), dbMat);
        plate.position.y = sd * 4.6;
        plate.castShadow = true;
        g.add(plate);
      });
      scene.add(g);
      weights.push(g);
    }
  }

  // 손가락: 무언가 쥐는 동작이면 더 구부림 (바닥 짚을 땐 폄)
  const grip = weight || mo.bar ? 1.1 : 0.35;
  function setFingers(hand, amt) {
    hand.traverse((b) => {
      if (/^(f_|thumb)/.test(b.name)) b.rotation.set((/^thumb/.test(b.name) ? 0.4 : 1) * amt * (/01/.test(b.name) ? 0.6 : 1), 0, 0);
    });
    hand.updateMatrixWorld(true);
  }

  // ---------- 카메라: 동작 전체가 들어오게 + 손가락으로 좌우 돌리기 ----------
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  mo.f.map(moResolve).forEach((r) => {
    const sk = moSkeleton(r, front);
    [sk.head, sk.H, sk.S, r.hand, r.hand2, r.ft, r.ft2].forEach((q) => {
      x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]);
      y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
    });
  });
  y0 -= 9; // 머리 위
  if (mo.bar) y0 = Math.min(y0, mo.bar - 3);
  const cx2 = (x0 + x1) / 2 - 80;
  const target = new T.Vector3(front ? 0 : fx * cx2, MO_GROUND - (y0 + y1) / 2 + lift, front ? -cx2 : 0);
  const span = Math.max((y1 - y0) * 1.2, ((x1 - x0) * 1.1) / (w / h), 64);
  const dist = span / 2 / Math.tan((15 * Math.PI) / 180) + 25;
  scene.fog.near = dist + 20;
  scene.fog.far = dist + 260;
  const cam = new T.PerspectiveCamera(30, w / h, 1, 1000);
  let az = front ? 1.2 : 0.62; // 옆모습 동작은 비스듬히 앞에서, 앞모습 동작은 거의 정면
  const el = 0.2;
  let dragX = null;
  const onDown = (e) => { dragX = e.clientX; };
  const onMove = (e) => {
    if (dragX == null) return;
    az -= (e.clientX - dragX) * 0.012;
    dragX = e.clientX;
  };
  const onUp = () => { dragX = null; };
  R.domElement.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  // ---------- 근육 색 ----------
  const info = WK_MUSCLES_EX[exName] || WK_MUSCLES[key] || { p: [] };
  const prim = info.p || [];
  const sec = info.s || [];
  const hot = info.hot || (WK_MUSCLES[key] && WK_MUSCLES[key].hot) || [1];
  const load = (fi) => (hot === "all" || hot.indexOf(fi) >= 0 ? 1 : 0.15);
  const cBase = { skin: new T.Color(M3_SKIN), shorts: new T.Color(M3_SHORTS), hair: new T.Color(M3_HAIR) };
  const cHot = new T.Color(M3_HOT);
  const cHelp = new T.Color(M3_HELP);
  const tmpC = new T.Color();
  const colAttr = M.mesh.geometry.attributes.color;
  let lastI = -1;
  function paint(I) {
    if (Math.abs(I - lastI) < 0.02) return;
    lastI = I;
    for (let i = 0; i < M.region.length; i++) {
      const rg = M.region[i];
      tmpC.copy(cBase[M.cover[i]]);
      if (M.cover[i] !== "hair" && rg) {
        if (prim.indexOf(rg) >= 0) tmpC.lerp(cHot, 0.55 + 0.45 * I);
        else if (sec.indexOf(rg) >= 0) tmpC.lerp(cHelp, 0.45 + 0.3 * I);
      }
      M.colors[i * 3] = tmpC.r;
      M.colors[i * 3 + 1] = tmpC.g;
      M.colors[i * 3 + 2] = tmpC.b;
    }
    colAttr.needsUpdate = true;
  }

  // ---------- 움직이기 ----------
  const keys = mo.f.map(moResolve);
  const order = mo.seq || keys.length > 2 ? keys.map((_, i) => i).concat([0]) : [0, 1, 0];
  const segDur = (mo.d || 1) * 1000;
  const hold = 180;
  const total = (order.length - 1) * (segDur + hold);
  const start = performance.now();
  let raf = 0;
  const wp = (nm) => new T.Vector3().setFromMatrixPosition(B[nm].matrixWorld);
  // 옆모습에서 마디의 앞쪽: 마디 방향을 90도 돌린 쪽
  const sideFront = (a, b) => new T.Vector3(-(b.y - a.y), b.x - a.x, 0).normalize();

  // 팔 또는 다리 한쪽: A(어깨·엉덩이 관절)에서 2D 목표점까지
  function poseLimb(upper, lower, A, target2, s, l1, l2, z, f, push) {
    const Tg = map(target2, z);
    if (push) Tg.addScaledVector(f, push); // 앞모습에서 손을 몸 앞으로
    // 2D에서 굽히는 쪽을 구해 3D 굽힘 방향(pole)으로
    const J2 = moIk(unmap(A), target2, l1, l2, s)[0];
    const pole = map(J2, (A.z + Tg.z) / 2).sub(A.clone().add(Tg).multiplyScalar(0.5));
    const [J, E] = m3Ik(A, Tg, l1, l2, pole);
    m3Aim(B[upper], M.restQ[upper], J.clone().sub(A), front ? f : sideFront(A, J));
    m3Aim(B[lower], M.restQ[lower], E.clone().sub(J), front ? f : sideFront(J, E));
    return E;
  }

  function frame(now) {
    const tt = (((now - start) % total) + total) % total;
    const i = Math.floor(tt / (segDur + hold));
    const local = Math.min(1, (tt - i * (segDur + hold)) / segDur);
    const k = 0.5 - 0.5 * Math.cos(Math.PI * local);
    const fa = order[i];
    const fb = order[i + 1];
    const p = moMix(keys[fa], keys[fb], k);

    // 몸통: 엉덩이 위치와 방향 (앞=f, 위=u, 옆=l)
    const td = moDir(p.t);
    const H = map(p.h, 0);
    const S = map([p.h[0] + td[0] * L.torso, p.h[1] + td[1] * L.torso], 0);
    const u = S.clone().sub(H).normalize();
    const f = front ? new T.Vector3(1, 0, 0) : new T.Vector3(u.y, -u.x, 0);
    f.sub(u.clone().multiplyScalar(f.dot(u))).normalize();
    const l = new T.Vector3().crossVectors(f, u).normalize();
    const Rb = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(f, u, l));
    B.spine.quaternion.copy(Rb.clone().multiply(M.restQ.spine));
    B.spine.position.copy(H.clone().add(L.spineOff.clone().applyQuaternion(Rb)).divideScalar(L.SC));
    M.root.updateMatrixWorld(true);

    // 팔·다리: 옆모습이면 카메라 쪽(+Z, 오른쪽)이 1번, 앞모습이면 그림 오른쪽(-Z, 왼쪽)이 1번
    const together = Math.hypot(p.hand[0] - p.hand2[0], p.hand[1] - p.hand2[1]) < 4;
    const sides = front ? [["L", 0], ["R", 1]] : [["R", 0], ["L", 1]];
    const palms = {};
    sides.forEach(([sd, n]) => {
      const A = wp("upper_arm" + sd);
      const hand2d = (n === 0 ? p.hand : p.hand2).slice();
      const onFloor = hand2d[1] >= 106;
      if (onFloor) hand2d[1] = MO_GROUND + lift - 1.5; // 바닥 짚는 손은 손바닥 높이로
      const zH = together ? Math.sign(A.z) * 2.5 : A.z;
      palms[sd] = poseLimb("upper_arm" + sd, "forearm" + sd, A, hand2d, n === 0 ? p.es : p.es2, L.upper, L.fore, zH, f, front && together ? 9 : 0);
      // 바닥 짚은 손: 손바닥을 바닥에 펴고 손가락은 머리 쪽으로
      const hb = B["hand" + sd];
      if (onFloor) {
        const fwd = new T.Vector3(u.x, 0, u.z);
        if (fwd.lengthSq() < 0.01) fwd.set(f.x, 0, f.z);
        m3Aim(hb, M.restQ["hand" + sd], fwd.normalize(), new T.Vector3(0, 0, -Math.sign(A.z)));
      } else {
        hb.quaternion.copy(M.handRest[sd]);
        hb.updateMatrixWorld(true);
      }
      setFingers(hb, onFloor ? 0.1 : grip);
      const K = wp("thigh" + sd);
      poseLimb("thigh" + sd, "shin" + sd, K, n === 0 ? p.ft : p.ft2, n === 0 ? p.ks : p.ks2, L.thigh, L.shin, K.z * 1.15, f);
    });

    // 기구: 손바닥에 붙이기
    if (weight === "kb") {
      weights[0].position.copy(together ? palms.L.clone().lerp(palms.R, 0.5) : palms[sides[0][0]]);
    }
    if (weight === "db") {
      ["R", "L"].forEach((sd, n) => {
        weights[n].position.copy(palms[sd]);
        weights[n].quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), l);
      });
    }

    // 근육: 힘이 드는 자세에 가까울수록 진하게
    paint(load(fa) + (load(fb) - load(fa)) * k);

    cam.position.set(target.x + dist * Math.sin(az) * Math.cos(el), target.y + dist * Math.sin(el), target.z + dist * Math.cos(az) * Math.cos(el));
    cam.lookAt(target);
    R.render(scene, cam);
    raf = requestAnimationFrame(frame);
  }
  frame(start);

  return () => {
    cancelAnimationFrame(raf);
    R.domElement.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    scene.remove(M.root);
    disposables.forEach((d) => d.dispose && d.dispose());
  };
}
