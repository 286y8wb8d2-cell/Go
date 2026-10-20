// =============================================
// 3D 사람 모형으로 동작 보여 주기 (three.js, vendor/three.min.js를 처음 열 때 불러옴)
// 동작 좌표는 workout-motion.js의 키프레임을 그대로 쓰고, 옆으로 깊이(z)를 더해 입체로 만듦
// 쓰는 근육은 빨강(주로)·주황(보조)으로 칠하고, 힘이 드는 순간 더 진하게
// 3D가 안 되는 기기면 예전 막대 그림(moPlay)으로 대신함
// =============================================

let m3Loading = null;
let m3Renderer = null;
let m3Failed = false;

const M3_SKIN = 0xe0b48f;
const M3_HAIR = 0x3b2a20;
const M3_HOT = 0xe34948;    // 주로 쓰는 근육
const M3_HELP = 0xeda100;   // 보조 근육
const M3_LIMB_R = { upper: 3.1, fore: 2.5, thigh: 4.6, shin: 3.3 };

// three.js 불러오기 (한 번만)
function m3Load() {
  if (window.THREE) return Promise.resolve(true);
  if (m3Loading) return m3Loading;
  m3Loading = new Promise((resolve) => {
    const sc = document.createElement("script");
    sc.src = "vendor/three.min.js?v=149";
    sc.onload = () => resolve(!!window.THREE);
    sc.onerror = () => resolve(false);
    document.head.appendChild(sc);
  });
  return m3Loading;
}

function m3GetRenderer() {
  if (m3Renderer || m3Failed) return m3Renderer;
  try {
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false; // 색을 적은 그대로 보이게
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

// 2D 키프레임 좌표 → 3D (y는 위가 +, 바닥 = 0)
function m3Map(mo, p2, z) {
  if (mo.view === "front") return new THREE.Vector3(0, MO_GROUND - p2[1], -(p2[0] - 80));
  const x = p2[0] - 80;
  return new THREE.Vector3(mo.flip ? -x : x, MO_GROUND - p2[1], z);
}

function m3Mat(color, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.65, metalness: 0.02 }, extra || {}));
}

// 근육 하나 = 살짝 튀어나온 타원체 (색이 바뀜)
function m3Ellipsoid(mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
  m.castShadow = true;
  return m;
}

// 위치·방향(로컬 X=바깥, Y=축)·크기로 놓기
const m3TmpM = () => new THREE.Matrix4();
function m3Place(mesh, pos, out, axis, scale) {
  const x = out.clone().sub(axis.clone().multiplyScalar(out.dot(axis))).normalize();
  const z = new THREE.Vector3().crossVectors(x, axis).normalize();
  const m = m3TmpM().makeBasis(x, axis, z);
  mesh.position.copy(pos);
  mesh.quaternion.setFromRotationMatrix(m);
  mesh.scale.set(scale[0], scale[1], scale[2]);
}

// 동작 그림 시작: box에 3D 장면을 넣고, 멈추는 함수를 돌려줌. 안 되면 null
function m3Play(box, key, weight, exName) {
  const mo = WK_MOTIONS[key];
  const R = m3GetRenderer();
  if (!mo || !R) return null;
  const T = THREE;
  box.innerHTML = "";
  const w = (box.clientWidth || 328) - 8; // 상자 안쪽 여백만큼 빼기
  const h = Math.round(w * 0.8);
  R.setSize(w, h);
  box.appendChild(R.domElement);
  R.domElement.className = "m3-canvas";

  const scene = new T.Scene();
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  // 빛
  scene.add(new T.HemisphereLight(0xffffff, 0x8d96a3, 0.55));
  const sun = new T.DirectionalLight(0xffffff, 1.05);
  sun.position.set(70, 170, 110);
  const fill = new T.DirectionalLight(0xdbe6ff, 0.35);
  fill.position.set(-120, 60, -60);
  scene.add(fill);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
  scene.add(sun);

  // 바닥
  scene.fog = new T.Fog(0xf6f8fa, 1, 2); // 거리는 카메라를 정한 뒤 맞춤
  if (!mo.noGround) {
    const floor = new T.Mesh(track(new T.CircleGeometry(400, 48)), track(m3Mat(0xd5dce4, { roughness: 1 })));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
  }

  // 벤치 · 철봉
  if (mo.bench) {
    const [bx, by, bw] = mo.bench;
    const top = MO_GROUND - by;
    const cx = bx + bw / 2 - 80;
    const benchMat = track(m3Mat(0x8f84c9));
    const legMat = track(m3Mat(0x55565c));
    const g = new T.Group();
    const seat = new T.Mesh(track(new T.BoxGeometry(bw, 4, 16)), benchMat);
    seat.position.set(0, top - 2, 0);
    seat.castShadow = seat.receiveShadow = true;
    g.add(seat);
    [-1, 1].forEach((sx) => {
      const leg = new T.Mesh(track(new T.BoxGeometry(3, top - 4, 12)), legMat);
      leg.position.set(sx * (bw / 2 - 5), (top - 4) / 2, 0);
      leg.castShadow = true;
      g.add(leg);
    });
    if (mo.view === "front") {
      g.rotation.y = Math.PI / 2;
      g.position.set(0, 0, -cx);
    } else {
      g.position.set(mo.flip ? -cx : cx, 0, 0);
    }
    scene.add(g);
  }
  if (mo.bar) {
    const barMat = track(m3Mat(0x777b82, { metalness: 0.6, roughness: 0.35 }));
    const by = MO_GROUND - mo.bar;
    const bar = new T.Mesh(track(new T.CylinderGeometry(1.2, 1.2, 80, 12)), barMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(2, by, 0);
    scene.add(bar);
  }

  // ---------- 사람 모형 ----------
  const skin = track(m3Mat(M3_SKIN, { roughness: 0.55 }));
  const info = WK_MUSCLES_EX[exName] || WK_MUSCLES[key] || { p: [] };
  const prim = info.p || [];
  const sec = info.s || [];
  const muscleMats = {};
  const muscleMat = (id) => {
    if (!muscleMats[id]) muscleMats[id] = track(m3Mat(M3_SKIN, { roughness: 0.5 }));
    return muscleMats[id];
  };

  // 몸통 묶음: 엉덩이 관절 기준, 로컬 X=앞, Y=몸통 위, Z=옆
  const torso = new T.Group();
  scene.add(torso);
  const addTo = (parent, mat, pos, scale) => {
    const m = m3Ellipsoid(mat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.scale.set(scale[0], scale[1], scale[2]);
    parent.add(m);
    return m;
  };
  addTo(torso, skin, [0, 3, 0], [6.5, 6.5, 10]);     // 골반
  addTo(torso, skin, [0, 12, 0], [5.6, 7.5, 8.6]);   // 허리
  addTo(torso, skin, [0, 21.5, 0], [6.6, 8.5, 11]);  // 가슴통
  const neck = new T.Mesh(track(new T.CylinderGeometry(2.6, 3, 7, 12)), skin);
  neck.position.set(0.5, 32.5, 0);
  neck.castShadow = true;
  torso.add(neck);
  addTo(torso, skin, [0.8, 41, 0], [6.4, 7.6, 6]);   // 머리
  addTo(torso, track(m3Mat(M3_HAIR, { roughness: 0.9 })), [-0.6, 42.6, 0], [6.3, 6.6, 6.3]); // 머리카락
  addTo(torso, skin, [6.6, 40.5, 0], [1.3, 1.6, 1.2]); // 코 (어느 쪽을 보는지)
  // 몸통 근육
  [-1, 1].forEach((sd) => {
    addTo(torso, muscleMat("chest"), [5, 23, sd * 4.8], [2.6, 4.3, 4.8]);
    addTo(torso, muscleMat("obliques"), [2.2, 12, sd * 7.3], [2.6, 5.5, 2.2]);
    addTo(torso, muscleMat("back"), [-4.6, 20, sd * 5], [2.8, 8, 5]);
    addTo(torso, muscleMat("lowback"), [-4.4, 10.5, sd * 2.6], [2.1, 6, 2.2]);
    addTo(torso, muscleMat("glutes"), [-4.8, 1.5, sd * 4.6], [3.6, 5.2, 4.8]);
    addTo(torso, muscleMat("hipabd"), [-0.4, 5, sd * 8.8], [3, 4, 2.4]);
  });
  addTo(torso, muscleMat("abs"), [4.4, 12, 0], [2.2, 7.2, 4.2]);
  addTo(torso, muscleMat("back"), [-4.2, 27, 0], [2.6, 3.6, 6.5]); // 등 위(승모)

  // 팔다리: 마디 하나 = 캡슐 + 근육 혹
  function limb(len, r, bulges) {
    const cap = new T.Mesh(track(new T.CapsuleGeometry(r, len, 6, 14)), skin);
    cap.castShadow = true;
    scene.add(cap);
    const bs = bulges.map((b) => {
      const m = m3Ellipsoid(muscleMat(b.id));
      scene.add(m);
      return Object.assign({ mesh: m }, b);
    });
    return { cap: cap, len: len, r: r, bulges: bs };
  }
  const mkArm = () => ({
    up: limb(MO_LEN.upper, M3_LIMB_R.upper, [
      { id: "biceps", side: "front", t: 0.55, off: 0.5, sc: [0.62, 5.6, 0.72] },
      { id: "triceps", side: "back", t: 0.5, off: 0.5, sc: [0.62, 6, 0.72] },
    ]),
    fo: limb(MO_LEN.fore, M3_LIMB_R.fore, [
      { id: "forearm", side: "front", t: 0.3, off: 0.42, sc: [0.7, 5, 0.75] },
    ]),
    delt: (() => { const m = m3Ellipsoid(muscleMat("shoulder")); scene.add(m); return m; })(),
    hand: (() => { const m = m3Ellipsoid(skin); scene.add(m); return m; })(),
  });
  const mkLeg = () => ({
    th: limb(MO_LEN.thigh, M3_LIMB_R.thigh, [
      { id: "quads", side: "front", t: 0.5, off: 0.38, sc: [0.66, 7.6, 0.8] },
      { id: "hams", side: "back", t: 0.5, off: 0.38, sc: [0.62, 7.2, 0.76] },
      { id: "adductors", side: "inner", t: 0.35, off: 0.45, sc: [0.6, 6.6, 0.62] },
    ]),
    sh: limb(MO_LEN.shin, M3_LIMB_R.shin, [
      { id: "calves", side: "back", t: 0.32, off: 0.5, sc: [0.85, 6, 0.85] },
    ]),
    foot: (() => {
      const m = new T.Mesh(track(new T.BoxGeometry(9, 3, 4.6)), skin);
      m.castShadow = true;
      scene.add(m);
      return m;
    })(),
  });
  const arms = [mkArm(), mkArm()];
  const legs = [mkLeg(), mkLeg()];

  // 기구
  const weights = [];
  if (weight === "kb") {
    const g = new T.Group();
    const bell = new T.Mesh(track(new T.SphereGeometry(5.2, 20, 16)), track(m3Mat(0xe8692f, { roughness: 0.45 })));
    bell.position.y = -6;
    const handle = new T.Mesh(track(new T.TorusGeometry(3.2, 0.9, 8, 20, Math.PI)), track(m3Mat(0x333333)));
    handle.position.y = -2.4;
    bell.castShadow = handle.castShadow = true;
    g.add(bell, handle);
    scene.add(g);
    weights.push(g);
  }
  if (weight === "db") {
    for (let i = 0; i < 2; i++) {
      const g = new T.Group();
      const dbMat = track(m3Mat(0x2a78d6, { roughness: 0.4 }));
      const bar = new T.Mesh(track(new T.CylinderGeometry(0.9, 0.9, 9, 10)), track(m3Mat(0x555a60, { metalness: 0.5 })));
      g.add(bar);
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

  // ---------- 카메라 (손가락으로 좌우 돌리기) ----------
  const cam = new T.PerspectiveCamera(30, w / h, 1, 1000);
  let az = mo.view === "front" ? 1.15 : 0.62; // 옆모습 동작은 비스듬히 앞에서, 앞모습 동작은 거의 정면
  const el = 0.2;
  // 모든 자세의 손·발·엉덩이·어깨가 들어오게 중심과 거리 정하기
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  mo.f.map(moResolve).forEach((r) => {
    const sk = moSkeleton(r, mo.view === "front");
    [sk.head, sk.H, sk.S, r.hand, r.hand2, r.ft, r.ft2].forEach((q) => {
      x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]);
      y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
    });
  });
  y0 -= 9; // 머리 위
  if (mo.bar) y0 = Math.min(y0, mo.bar - 3);
  const cx2 = (x0 + x1) / 2 - 80;
  const target = new T.Vector3(mo.view === "front" ? 0 : mo.flip ? -cx2 : cx2, MO_GROUND - (y0 + y1) / 2, mo.view === "front" ? -cx2 : 0);
  const span = Math.max((y1 - y0) * 1.25, ((x1 - x0) * 1.1) / (w / h), 70);
  const dist = span / 2 / Math.tan((15 * Math.PI) / 180) + 25;
  scene.fog.near = dist + 20;
  scene.fog.far = dist + 260;
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

  // ---------- 움직이기 ----------
  const keys = mo.f.map(moResolve);
  const order = mo.seq || keys.length > 2 ? keys.map((_, i) => i).concat([0]) : [0, 1, 0];
  const segDur = (mo.d || 1) * 1000;
  const hold = 180;
  const total = (order.length - 1) * (segDur + hold);
  const front = mo.view === "front";
  const hot = info.hot || WK_MUSCLES[key]?.hot || [1];
  const load = (fi) => (hot === "all" || hot.indexOf(fi) >= 0 ? 1 : 0.15);
  const base = new T.Color(M3_SKIN);
  const cHot = new T.Color(M3_HOT);
  const cHelp = new T.Color(M3_HELP);
  const start = performance.now();
  let raf = 0;
  const up = new T.Vector3(0, 1, 0);

  function setSeg(seg, a, b, refFront, inner) {
    const axis = b.clone().sub(a).normalize();
    seg.cap.position.copy(a).add(b).multiplyScalar(0.5);
    seg.cap.quaternion.setFromUnitVectors(up, axis);
    let fr = refFront.clone().sub(axis.clone().multiplyScalar(refFront.dot(axis)));
    if (fr.lengthSq() < 1e-4) fr = new T.Vector3(0, 1, 0).sub(axis.clone().multiplyScalar(axis.y));
    fr.normalize();
    seg.bulges.forEach((bg) => {
      const out = bg.side === "front" ? fr : bg.side === "back" ? fr.clone().negate() : inner;
      const pos = a.clone().lerp(b, bg.t).add(out.clone().multiplyScalar(seg.r * bg.off));
      m3Place(bg.mesh, pos, out, axis, [seg.r * bg.sc[0], bg.sc[1], seg.r * bg.sc[2]]);
    });
    return fr;
  }

  // 2D에서 앞쪽 방향(옆모습 팔다리): 마디 방향을 90도 돌린 쪽
  function sideFront(a3, b3) {
    const d = b3.clone().sub(a3);
    return new T.Vector3(-d.y, d.x, 0).normalize();
  }

  function frame(now) {
    const tt = (((now - start) % total) + total) % total;
    const i = Math.floor(tt / (segDur + hold));
    const local = Math.min(1, (tt - i * (segDur + hold)) / segDur);
    const k = 0.5 - 0.5 * Math.cos(Math.PI * local);
    const fa = order[i];
    const fb = order[i + 1];
    const p = moMix(keys[fa], keys[fb], k);
    const sk = moSkeleton(p, front);

    // 몸통 방향
    const H = m3Map(mo, sk.H, 0);
    const S = m3Map(mo, sk.S, 0);
    const u = S.clone().sub(H).normalize();
    let f;
    if (front) f = new T.Vector3(1, 0, 0);
    else f = new T.Vector3(u.y, -u.x, 0);
    f.sub(u.clone().multiplyScalar(f.dot(u))).normalize();
    const l = new T.Vector3().crossVectors(f, u).normalize();
    torso.position.copy(H);
    torso.quaternion.setFromRotationMatrix(m3TmpM().makeBasis(f, u, l));

    // 어깨·엉덩이 좌우 (옆모습: 가까운 쪽이 1번)
    const sh = front ? [m3Map(mo, sk.S1, 0), m3Map(mo, sk.S2, 0)] : [S.clone().addScaledVector(l, 9.5), S.clone().addScaledVector(l, -9.5)];
    const hp = front ? [m3Map(mo, sk.H1, 0), m3Map(mo, sk.H2, 0)] : [H.clone().addScaledVector(l, 5.5), H.clone().addScaledVector(l, -5.5)];
    // 손이 한곳에 모이면(고블릿 등) 가운데로
    const together = Math.hypot(p.hand[0] - p.hand2[0], p.hand[1] - p.hand2[1]) < 4;
    const lz = l.z;
    [[sk.arm, 0], [sk.arm2, 1]].forEach(([arm2d, n]) => {
      const sd = n === 0 ? 1 : -1;
      const A = sh[n];
      let E, W;
      if (front) {
        E = m3Map(mo, arm2d[0], 0);
        W = m3Map(mo, arm2d[1], 0);
      } else {
        const zh = (together ? 3 : 9.5) * sd * lz;
        E = m3Map(mo, arm2d[0], (A.z + zh) / 2);
        W = m3Map(mo, arm2d[1], zh);
      }
      const out = A.clone().sub(S).normalize();
      setSeg(arms[n].up, A, E, front ? f : sideFront(A, E), out.clone().negate());
      setSeg(arms[n].fo, E, W, front ? f : sideFront(E, W), out.clone().negate());
      m3Place(arms[n].delt, A.clone().addScaledVector(u, -1.5), out, u, [3.6, 4.6, 4.4]);
      m3Place(arms[n].hand, W, f, W.clone().sub(E).normalize(), [2.1, 2.9, 2.6]);
      arms[n].W = W;
      arms[n].E = E;
    });
    [[sk.leg, 0], [sk.leg2, 1]].forEach(([leg2d, n]) => {
      const sd = n === 0 ? 1 : -1;
      const A = hp[n];
      let K, F;
      if (front) {
        K = m3Map(mo, leg2d[0], 0);
        F = m3Map(mo, leg2d[1], 0);
      } else {
        const zf = 6 * sd * lz;
        K = m3Map(mo, leg2d[0], (A.z + zf) / 2);
        F = m3Map(mo, leg2d[1], zf);
      }
      const inner = H.clone().sub(A).normalize();
      setSeg(legs[n].th, A, K, front ? f : sideFront(A, K), inner);
      const shinFront = setSeg(legs[n].sh, K, F, front ? f : sideFront(K, F), inner);
      // 발: 정강이 앞쪽으로 뻗은 상자
      const shinUp = K.clone().sub(F).normalize();
      m3Place(legs[n].foot, F.clone().addScaledVector(shinFront, 3.2).addScaledVector(shinUp, -0.5), shinFront, shinUp, [1, 1, 1]);
    });

    // 기구: 손에 붙이기
    if (weight === "kb") {
      const handsMid = together ? arms[0].W.clone().lerp(arms[1].W, 0.5) : arms[0].W;
      weights[0].position.copy(handsMid);
    }
    if (weight === "db") {
      weights.forEach((g, n) => {
        g.position.copy(arms[n].W);
        g.quaternion.setFromUnitVectors(up, l);
      });
    }

    // 근육 색: 힘이 드는 자세에 가까울수록 진하게
    const I = load(fa) + (load(fb) - load(fa)) * k;
    Object.keys(muscleMats).forEach((id) => {
      const mat = muscleMats[id];
      if (prim.indexOf(id) >= 0) {
        mat.color.copy(base).lerp(cHot, 0.7 + 0.3 * I);
        mat.emissive.copy(cHot).multiplyScalar(0.05 + 0.35 * I);
      } else if (sec.indexOf(id) >= 0) {
        mat.color.copy(base).lerp(cHelp, 0.55 + 0.25 * I);
        mat.emissive.copy(cHelp).multiplyScalar(0.03 + 0.1 * I);
      }
    });

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
    scene.traverse((o) => { if (o.geometry && disposables.indexOf(o.geometry) < 0) o.geometry.dispose(); });
    disposables.forEach((d) => d.dispose && d.dispose());
  };
}
