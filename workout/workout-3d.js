// =============================================
// 3D 사람 모델로 동작 보여 주기
// - three.js(vendor/three.min.js) + GLTFLoader(vendor/GLTFLoader.js), 처음 열 때만 불러옴
// - 사람 모델: vendor/human.glb — MakeHuman(CC0) 몸을 kblood/CharacterCreator(생성물 CC0)로 만든 것에
//   남성·근육 체형을 굳히고 짧은 머리·반바지를 합침 (vendor/human-LICENSE.txt)
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
      const gltf = await new THREE.GLTFLoader().loadAsync("vendor/human.glb?v=2");
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
// 뼈 이름 (MakeHuman game_engine 뼈대). sd = "l" | "r"
const M3_BONE = { upper: "upperarm_", fore: "lowerarm_", hand: "hand_", thigh: "thigh_", shin: "calf_" };
const M3_CURL = 1; // 손가락 굽히는 방향 (뼈 X축 기준)

function m3Prepare(root) {
  const T = THREE;
  root.rotation.y = Math.PI / 2; // 모델은 +Z를 봄 → 앞이 +X, 왼쪽이 -Z가 되게
  root.updateMatrixWorld(true);
  const bones = {};
  const meshes = [];
  root.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isSkinnedMesh) meshes.push(o);
  });
  const body = meshes.find((m) => m.material.name === "Skin");
  const head = (n) => new T.Vector3().setFromMatrixPosition(bones[n].matrixWorld);
  const restQ = {};
  Object.keys(bones).forEach((n) => (restQ[n] = bones[n].getWorldQuaternion(new T.Quaternion())));

  // 길이(미터) → 동작 좌표(다리 길이 40)로 바꾸는 배율
  const hipL = head("thigh_l"), kneeL = head("calf_l"), ankL = head("foot_l");
  const SC = 40 / (hipL.distanceTo(kneeL) + kneeL.distanceTo(ankL));
  const shL = head("upperarm_l"), elL = head("lowerarm_l"), wrL = head("hand_l");
  const hipC = hipL.clone().add(head("thigh_r")).multiplyScalar(0.5);
  const shC = shL.clone().add(head("upperarm_r")).multiplyScalar(0.5);
  const L = {
    SC: SC,
    thigh: hipL.distanceTo(kneeL) * SC,
    shin: kneeL.distanceTo(ankL) * SC,
    upper: shL.distanceTo(elL) * SC,
    fore: (elL.distanceTo(wrL) + 0.045) * SC, // 손바닥 가운데까지
    torso: shC.distanceTo(hipC) * SC,
    ankle: ankL.y * SC, // 발목 높이 (발바닥 = 0)
    pelvisOff: head("pelvis").sub(hipC).multiplyScalar(SC), // 엉덩이 가운데 → pelvis 뼈 시작
  };

  // 피부·반바지의 점마다 근육 부위 정하기 (서 있는 기본 자세 기준, 앞=+X 위=+Y 오른쪽=+Z)
  const yHip = hipC.y, yKnee = kneeL.y, ySh = shC.y;
  const v = new T.Vector3();
  function classify(mesh) {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const sIdx = geo.attributes.skinIndex;
    const sW = geo.attributes.skinWeight;
    const names = mesh.skeleton.bones.map((b) => b.name);
    const region = new Array(pos.count).fill("");
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      let best = 0;
      let bw = -1;
      ["getX", "getY", "getZ", "getW"].forEach((g) => {
        const wt = sW[g](i);
        if (wt > bw) { bw = wt; best = sIdx[g](i); }
      });
      const bn = names[best].replace(/_[lr]$/, "");
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
      } else if (bn === "calf") {
        const t = (yKnee - v.y) / (yKnee - ankL.y);
        if (v.x < kneeL.x - 0.005 && t < 0.72) r = "calves";
      } else if (bn === "pelvis") {
        if (v.x < hipC.x - 0.03) r = v.y < yHip + 0.06 ? "glutes" : "lowback";
        else if (Math.abs(v.z) > 0.11) r = "hipabd";
        else if (v.y > yHip + 0.04) r = "abs";
      } else if (bn === "spine_01" || bn === "spine_02") {
        if (v.x > 0.02) r = Math.abs(v.z) < 0.07 ? "abs" : "obliques";
        else if (v.x < -0.03) r = Math.abs(v.z) < 0.06 ? "lowback" : "back";
        else r = "obliques";
      } else if (bn === "spine_03") {
        if (v.x > 0.02) r = v.y > ySh - 0.2 ? "chest" : "abs";
        else r = "back";
      } else if (bn === "clavicle") {
        r = Math.abs(v.z) > 0.13 ? "shoulder" : v.x < 0 ? "back" : "chest";
      } else if (bn === "upperarm") {
        const t = (ySh - v.y) / (ySh - elL.y);
        if (t < 0.3) r = "shoulder";
        else r = v.x > head(names[best]).x ? "biceps" : "triceps";
      } else if (bn === "lowerarm") {
        r = "forearm";
      } else if (bn === "neck_01") {
        r = v.x < 0 ? "back" : "";
      }
      region[i] = r;
    }
    return region;
  }

  // 근육 빛: 점마다 glow(색 rgb + 세기 a)를 두고, 재질에서 피부색 위에 섞음
  const glowing = [];
  meshes.forEach((m) => {
    m.castShadow = true;
    m.frustumCulled = false;
    if (m !== body && !/shorts/i.test(m.material.name)) return;
    const region = classify(m);
    const glow = new Float32Array(region.length * 4);
    m.geometry.setAttribute("glow", new T.BufferAttribute(glow, 4));
    const mat = m.material;
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec4 glow;\nvarying vec4 vGlow;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = glow;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec4 vGlow;")
        .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vGlow.rgb, vGlow.a);")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow.rgb * vGlow.a * 0.3;");
    };
    mat.customProgramCacheKey = () => "glow";
    if (/shorts/i.test(mat.name)) mat.color.set(0x2b3442);
    glowing.push({ mesh: m, region: region, glow: glow });
  });

  root.scale.setScalar(SC);
  const handRest = { l: bones.hand_l.quaternion.clone(), r: bones.hand_r.quaternion.clone() };
  const fingerRest = {};
  Object.keys(bones).forEach((n) => { if (/^(index|middle|ring|pinky|thumb)_0/.test(n)) fingerRest[n] = bones[n].quaternion.clone(); });
  return { root: root, bones: bones, restQ: restQ, handRest: handRest, fingerRest: fingerRest, L: L, glowing: glowing };
}

// 뼈를 세계 기준 위치·회전으로 놓기 (부모 기준으로 바꿔서)
function m3SetWorld(bone, pos, quat) {
  const T = THREE;
  const pm = bone.parent.matrixWorld;
  const pq = bone.parent.getWorldQuaternion(new T.Quaternion());
  bone.position.copy(pos).applyMatrix4(new T.Matrix4().copy(pm).invert());
  bone.quaternion.copy(pq.invert().multiply(quat));
  bone.updateMatrixWorld(true);
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

  // 헬스장 기구 (운동 이름에 맞춰, workout-rigs.js)
  const rigMat = {
    steel: track(m3Mat(0x5b6470, { metalness: 0.6, roughness: 0.35 })),
    chrome: track(m3Mat(0xc9ced4, { metalness: 0.8, roughness: 0.2 })),
    pad: track(m3Mat(0x22262c, { roughness: 0.8 })),
    plate: track(m3Mat(0x2d3138, { roughness: 0.5 })),
    cable: track(m3Mat(0x111316, { roughness: 0.4 })),
  };
  const rig = m3BuildRig(WK_RIG_OF[exName], {
    T: T, mo: mo, front: front, fx: fx, map: map, mat: rigMat, keys: mo.f.map(moResolve),
    add: (o) => { track(o.geometry); scene.add(o); },
  });

  // 벤치 · 철봉
  if (mo.bench && !(rig && rig.hideBench)) {
    const [bx, by, bw] = mo.bench;
    const top = MO_GROUND - by; // 벤치 윗면 (발바닥·엉덩이가 닿는 면)
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
    // 철봉 기둥 (봉이 떠 있지 않게)
    const by3 = MO_GROUND - mo.bar + lift;
    [-40, 40].forEach((z) => {
      const p = new T.Mesh(track(new T.BoxGeometry(4, by3 + 4, 4)), rigMat.steel);
      p.position.set(2, (by3 + 4) / 2, z);
      p.castShadow = true;
      scene.add(p);
      const foot = new T.Mesh(track(new T.BoxGeometry(30, 2, 5)), rigMat.steel);
      foot.position.set(2, 1, z);
      scene.add(foot);
    });
  }

  // 사람
  scene.add(M.root);
  const B = M.bones;

  // 기구
  const weights = [];
  if (weight === "kb") {
    const g = new T.Group();
    const bell = new T.Mesh(track(new T.SphereGeometry(4.2, 20, 16)), track(m3Mat(0xe8692f, { roughness: 0.45 })));
    bell.position.y = -5.4;
    const handle = new T.Mesh(track(new T.TorusGeometry(2.6, 0.75, 8, 20, Math.PI)), track(m3Mat(0x333333)));
    handle.position.y = -2.2;
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

  if (weight === "lat") {
    // 랫 풀다운 봉: 원판 없이 길고 끝이 살짝 굽은 봉
    const g = new T.Group();
    g.add(new T.Mesh(track(new T.CylinderGeometry(0.8, 0.8, 54, 10)), track(m3Mat(0x8a8f96, { metalness: 0.7, roughness: 0.3 }))));
    scene.add(g);
    weights.push(g);
  }
  if (weight === "bb") {
    // 바벨: 봉 + 양쪽 원판 (양손 가운데에, 몸 옆 방향으로)
    const g = new T.Group();
    g.add(new T.Mesh(track(new T.CylinderGeometry(0.7, 0.7, 50, 10)), track(m3Mat(0x8a8f96, { metalness: 0.7, roughness: 0.3 }))));
    const plateMat = track(m3Mat(0x2b2f36, { roughness: 0.6 }));
    [-1, 1].forEach((sd) => {
      const plate = new T.Mesh(track(new T.CylinderGeometry(6.5, 6.5, 2.4, 24)), plateMat);
      plate.position.y = sd * 19;
      plate.castShadow = true;
      g.add(plate);
    });
    scene.add(g);
    weights.push(g);
  }

  // 손가락: 무언가 쥐는 동작이면 더 구부림 (바닥 짚을 땐 폄)
  const grip = weight || mo.bar ? 1.1 : 0.35;
  function setFingers(hand, amt) {
    hand.traverse((b) => {
      if (M.fingerRest[b.name]) {
        b.quaternion.copy(M.fingerRest[b.name]);
        b.rotateX((/^thumb/.test(b.name) ? 0.35 : 1) * amt * (/01/.test(b.name) ? 0.7 : 1) * M3_CURL);
      }
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
  if (rig && rig.top) y0 = Math.min(y0, MO_GROUND + lift - rig.top - 4); // 기구 꼭대기까지 보이게
  if (rig) { x0 -= 14; x1 += 14; } // 무게 추·기둥이 옆에 있어서
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
  const cHot = new T.Color(M3_HOT);
  const cHelp = new T.Color(M3_HELP);
  let lastI = -1;
  function paint(I) {
    if (Math.abs(I - lastI) < 0.02) return;
    lastI = I;
    M.glowing.forEach((g) => {
      for (let i = 0; i < g.region.length; i++) {
        const rg = g.region[i];
        let c = null;
        let a = 0;
        if (rg && prim.indexOf(rg) >= 0) { c = cHot; a = 0.5 + 0.4 * I; }
        else if (rg && sec.indexOf(rg) >= 0) { c = cHelp; a = 0.35 + 0.3 * I; }
        g.glow[i * 4] = c ? c.r : 0;
        g.glow[i * 4 + 1] = c ? c.g : 0;
        g.glow[i * 4 + 2] = c ? c.b : 0;
        g.glow[i * 4 + 3] = a;
      }
      g.mesh.geometry.attributes.glow.needsUpdate = true;
    });
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

  // ---------- 자세 맞추기 ----------
  // 1) 바닥·벤치·철봉에 닿지 않는 팔다리는 2D 자세의 관절 각도를 그대로 (모델 길이로)
  // 2) 닿는 손발만 그 자리에 정확히 (IK)
  // 3) 몸 전체 높이: 누우면 등, 앉으면 엉덩이가 닿게 / 매달리면 손이 봉에 / 점프는 뜬 채로
  const benchTop = mo.bench ? MO_GROUND - mo.bench[1] : null; // 벤치 윗면 (3D 높이)
  const onBench2 = (x2) => mo.bench && x2 >= mo.bench[0] - 1 && x2 <= mo.bench[0] + mo.bench[2] + 1;
  const support = (v3) => (onBench2(unmap(v3)[0]) ? benchTop : 0);
  const TH = { foot: L.ankle, knee: 2.5, hip: 4.5, sh: 4.5, head: 4.5, hand: 1.5, elbow: 2 }; // 관절에서 피부까지
  const barY = mo.bar ? MO_GROUND - mo.bar + lift : null;
  const dir3 = (a2, b2) => map(b2, 0).sub(map(a2, 0)).normalize();

  // 팔다리 하나를 목표점까지 (pole 쪽으로 굽힘)
  function aimLimb(upper, lower, A, Tg, pole, l1, l2, f) {
    const [J, E] = m3Ik(A, Tg, l1, l2, pole.clone().sub(A.clone().add(Tg).multiplyScalar(0.5)));
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
    const sk = moSkeleton(p, front); // 2D 막대 자세 (각도의 기준)

    // 몸통 방향 (앞=f, 위=u, 옆=l)
    const td = moDir(p.t);
    const H0 = map(p.h, 0);
    const u = map([p.h[0] + td[0], p.h[1] + td[1]], 0).sub(H0).normalize();
    const f = front ? new T.Vector3(1, 0, 0) : new T.Vector3(u.y, -u.x, 0);
    f.sub(u.clone().multiplyScalar(f.dot(u))).normalize();
    const l = new T.Vector3().crossVectors(f, u).normalize();
    const Rb = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(f, u, l));
    const placePelvis = (H) => {
      M.root.updateMatrixWorld(true);
      m3SetWorld(B.pelvis, H.clone().add(L.pelvisOff.clone().applyQuaternion(Rb)), Rb.clone().multiply(M.restQ.pelvis));
    };
    placePelvis(H0);

    // 팔·다리: 옆모습이면 카메라 쪽(+Z, 오른쪽)이 1번, 앞모습이면 그림 오른쪽(-Z, 왼쪽)이 1번
    const together = weight === "kb" && Math.hypot(p.hand[0] - p.hand2[0], p.hand[1] - p.hand2[1]) < 4; // 커틀벨 하나를 두 손으로
    const sides = front ? [["l", 0], ["r", 1]] : [["r", 0], ["l", 1]];
    const limbs = [];
    sides.forEach(([sd, n]) => {
      const arm2 = n === 0 ? sk.arm : sk.arm2;
      const leg2 = n === 0 ? sk.leg : sk.leg2;
      const hand2d = n === 0 ? p.hand : p.hand2;
      const foot2d = n === 0 ? p.ft : p.ft2;
      // 손: 철봉 / 바닥 / 벤치에 닿는지
      let hc = null;
      if (mo.bar && Math.abs(hand2d[1] - mo.bar) < 4) hc = "bar";
      else if (hand2d[1] >= 106) hc = "floor";
      else if (mo.bench && onBench2(hand2d[0]) && Math.abs(hand2d[1] - mo.bench[1]) < 4) hc = "bench";
      let fc = null;
      if (foot2d[1] >= 107) fc = "floor";
      else if (mo.bench && onBench2(foot2d[0]) && Math.abs(foot2d[1] - mo.bench[1]) < 4) fc = "bench";
      limbs.push({ kind: "arm", sd: sd, n: n, up: M3_BONE.upper + sd, lo: M3_BONE.fore + sd, l1: L.upper, l2: L.fore,
        d1: dir3(front ? sk.S1 : sk.S, arm2[0]), d2: dir3(arm2[0], arm2[1]), target2: hand2d, contact: hc });
      limbs.push({ kind: "leg", sd: sd, n: n, up: M3_BONE.thigh + sd, lo: M3_BONE.shin + sd, l1: L.thigh, l2: L.shin,
        d1: dir3(front ? sk.H1 : sk.H, leg2[0]), d2: dir3(leg2[0], leg2[1]), target2: foot2d, contact: fc });
    });
    // 관절 각도대로 놓았을 때 각 관절 위치 (FK)
    const fk = () => limbs.forEach((lb) => {
      lb.A = wp(lb.up);
      lb.J = lb.A.clone().addScaledVector(lb.d1, lb.l1);
      lb.E = lb.J.clone().addScaledVector(lb.d2, lb.l2);
      if (lb.kind === "arm" && together && !front) lb.E.z = Math.sign(lb.A.z) * 2.5;
      if (lb.kind === "arm" && together && front) lb.E.addScaledVector(f, 9);
    });
    fk();

    // 몸 전체 위치 맞추기
    let shift = new T.Vector3();
    const arms = limbs.filter((lb) => lb.kind === "arm");
    if (mo.bar && arms.some((lb) => lb.contact === "bar")) {
      // 매달리기: 두 손 가운데가 봉에 오게
      const mid = arms[0].E.clone().lerp(arms[1].E, 0.5);
      const want = map([(p.hand[0] + p.hand2[0]) / 2, mo.bar], 0);
      shift.set(0, barY - mid.y, (front ? want.z : 0) - (front ? mid.z : 0));
      if (!front) shift.x = want.x - mid.x;
    } else {
      // 가장 낮은 곳이 바닥(또는 벤치)에 닿게. 이미 떠 있으면(점프) 그대로
      const S0 = H0.clone().addScaledVector(u, L.torso);
      const pts = [[H0, TH.hip], [S0, TH.sh], [S0.clone().addScaledVector(u, 11), TH.head]];
      limbs.forEach((lb) => {
        pts.push([lb.J, lb.kind === "arm" ? TH.elbow : TH.knee]);
        // 바닥·벤치를 짚는 손발은 뒤에서 그 자리로 맞추므로 높이 계산에서 뺌
        if (!lb.contact) pts.push([lb.E, lb.kind === "arm" ? TH.hand : TH.foot]);
      });
      let m = Infinity;
      pts.forEach(([v, th]) => (m = Math.min(m, v.y - th - support(v))));
      if (m < 0 || m < 5) shift.y = -m;
    }
    if (shift.lengthSq() > 1e-6) {
      placePelvis(H0.clone().add(shift));
      fk();
    }

    // 팔다리: 닿는 곳은 그 자리로, 나머지는 각도대로
    const palms = {};
    limbs.forEach((lb) => {
      let Tg = lb.E;
      if (lb.contact) {
        const zz = lb.kind === "leg" ? lb.A.z * 1.15 : together ? Math.sign(lb.A.z) * 2.5 : lb.A.z;
        Tg = map(lb.target2, zz);
        if (lb.contact === "floor") Tg.y = lb.kind === "leg" ? L.ankle : TH.hand;
        if (lb.contact === "bench") Tg.y = benchTop + (lb.kind === "leg" ? L.ankle : TH.hand);
        if (lb.contact === "bar") Tg.y = barY;
      }
      const E = aimLimb(lb.up, lb.lo, lb.A, Tg, lb.J, lb.l1, lb.l2, f);
      if (lb.kind === "arm") {
        palms[lb.sd] = E;
        // 바닥 짚은 손: 손바닥을 바닥에 펴고 손가락은 머리 쪽으로
        const hb = B[M3_BONE.hand + lb.sd];
        if (lb.contact === "floor") {
          const fwd = new T.Vector3(u.x, 0, u.z);
          if (fwd.lengthSq() < 0.01) fwd.set(f.x, 0, f.z);
          m3Aim(hb, M.restQ[M3_BONE.hand + lb.sd], fwd.normalize(), new T.Vector3(0, 0, -Math.sign(lb.A.z)));
        } else {
          hb.quaternion.copy(M.handRest[lb.sd]);
          hb.updateMatrixWorld(true);
        }
        setFingers(hb, lb.contact === "floor" ? 0.1 : grip);
      }
    });

    // 기구: 손바닥에 붙이기
    if (weight === "kb") {
      weights[0].position.copy(together ? palms.l.clone().lerp(palms.r, 0.5) : palms[sides[0][0]]);
    }
    if (weight === "bb" || weight === "lat") {
      weights[0].position.copy(palms.l.clone().lerp(palms.r, 0.5));
      weights[0].quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), l);
    }
    if (weight === "db") {
      ["r", "l"].forEach((sd, n) => {
        weights[n].position.copy(palms[sd]);
        weights[n].quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), l);
      });
    }

    // 기구에서 몸을 따라 움직이는 부분 (패드·발판·손잡이·케이블)
    if (rig) {
      const both = (nm) => ({ l: wp(nm + "l"), r: wp(nm + "r") });
      rig.update({ palm: palms, knee: both("calf_"), ankle: both("foot_"), sh: both("upperarm_"), f: f, u: u, l: l });
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
