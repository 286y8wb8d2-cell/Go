// =============================================
// 헬스장 기구 3D (workout-3d.js의 m3Play가 동작 이름에 맞춰 부름)
// 기구마다 고정된 부분(의자·기둥·무게 추)은 처음에 한 번 만들고,
// 몸과 같이 움직이는 부분(패드·발판·손잡이·케이블)은 매 장면 update에서 옮김
// 좌표: 옆모습은 사람이 +X를 봄, 위가 +Y, 바닥 = 0. 앞모습 동작은 옆 방향이 Z
// =============================================

// 운동 이름 → 기구
const WK_RIG_OF = {
  "레그 익스텐션": "legExt", "라잉 레그 컬": "legCurl", "레그 프레스": "legPress",
  "랫 풀다운": "pulldown", "시티드 케이블 로우": "cableRow", "체스트 프레스 머신": "chestPress",
  "머신 숄더 프레스": "shoulderPress", "덤벨 숄더 프레스": "uprightBench",
  "케이블 푸시다운": "cableHigh", "페이스 풀": "cableFace", "케이블 플라이": "cableFly",
  "케이블 레터럴 레이즈": "cableLow", "케이블 우드찹": "cableChop",
  "스미스 머신 스쿼트": "smith", "바벨 백스쿼트": "squatRack", "바벨 오버헤드 프레스": "squatRack",
  "바벨 벤치프레스": "benchRack", "어시스트 턱걸이 머신": "assistPull", "머신 카프 레이즈": "calfMachine",
};

// c: { T, add(mesh), mo, map(p2, z), front, fx, keys(키프레임), mat }
// 돌려주는 것: { hideBench, top(가장 높은 곳 3D y), update(st) } 또는 null
// st: { palm, knee, ankle, sh: {l, r}, H, f, u, l }
function m3BuildRig(name, c) {
  if (!name) return null;
  const T = c.T;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const m = c.mat;
  const mo = c.mo;
  const fx = c.fx;
  // 도구: 상자, 막대(두 점 사이), 무게 추
  const box = (w, h, d, mat, x, y, z) => {
    const o = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    c.add(o);
    return o;
  };
  const rod = (r, mat) => {
    const o = new T.Mesh(new T.CylinderGeometry(r, r, 1, 14), mat);
    o.castShadow = true;
    c.add(o);
    return o;
  };
  const between = (o, a, b) => {
    const d = b.clone().sub(a);
    const len = d.length() || 0.001;
    o.position.copy(a).addScaledVector(d, 0.5);
    o.scale.set(1, len, 1);
    o.quaternion.setFromUnitVectors(V(0, 1, 0), d.divideScalar(len));
    return o;
  };
  const rodAB = (r, mat, a, b) => between(rod(r, mat), a, b);
  const zRod = (r, mat, len) => { const o = rod(r, mat); o.rotation.x = Math.PI / 2; o.scale.set(1, len, 1); return o; };
  const stack = (x, z, h) => {
    rodAB(0.7, m.chrome, V(x, 0, z - 5), V(x, h, z - 5));
    rodAB(0.7, m.chrome, V(x, 0, z + 5), V(x, h, z + 5));
    for (let i = 0; i < 12; i++) box(9, 1.7, 13, m.plate, x, 1.5 + i * 2.1, z);
    box(13, 3, 17, m.steel, x, h, z);
    box(14, 2, 18, m.steel, x, 1, z);
  };
  const post = (x, z, h) => box(5, h, 5, m.steel, x, h / 2, z);
  const mid = (o) => o.l.clone().lerp(o.r, 0.5);
  // 키프레임(2D) → 3D
  const P = (p2, z) => c.map(p2, z || 0);
  const k0 = c.keys[0];
  const k1 = c.keys[1] || c.keys[0];
  const bench = mo.bench ? {
    top: MO_GROUND - mo.bench[1], w: mo.bench[2],
    cx: fx * (mo.bench[0] + mo.bench[2] / 2 - 80),
  } : null;
  if (bench) {
    bench.back = bench.cx - (fx * bench.w) / 2; // 사람 등 쪽 끝
    bench.front = bench.cx + (fx * bench.w) / 2;
  }
  // 기계 의자 (패드 + 다리 + 바닥 받침)
  const seat = (w, d) => {
    box(w || bench.w, 5, d || 22, m.pad, bench.cx, bench.top - 2.5, 0);
    box(5, bench.top - 5, 5, m.steel, bench.cx, (bench.top - 5) / 2, 0);
    box((w || bench.w) + 8, 2, 26, m.steel, bench.cx, 1, 0);
  };
  const r = { hideBench: false, top: 0, update: () => {} };

  if (name === "legExt") {
    r.hideBench = true;
    seat();
    const bk = box(5, 32, 22, m.pad, bench.back - fx * 1.5, bench.top + 16, 0);
    bk.rotation.z = fx * 0.12;
    post(bench.front, 15, bench.top + 2);
    stack(bench.back - fx * 15, 0, 70);
    r.top = 72;
    const roller = zRod(2.6, m.pad, 26);
    const lever = rod(1.1, m.steel);
    r.update = (st) => {
      const kn = mid(st.knee);
      const an = mid(st.ankle);
      const sd = an.clone().sub(kn).normalize();
      const sf = V(-sd.y, sd.x, 0).multiplyScalar(fx); // 정강이 앞쪽
      const rc = an.clone().addScaledVector(sf, 3.2).addScaledVector(sd, -1.5);
      roller.position.copy(rc);
      between(lever, V(bench.front, kn.y, 15), V(rc.x, rc.y, 15));
    };
  } else if (name === "legCurl") {
    r.hideBench = true;
    box(bench.w, 5, 20, m.pad, bench.cx, bench.top - 2.5, 0);
    post(bench.back + fx * 5, 0, bench.top - 5);
    post(bench.front - fx * 5, 0, bench.top - 5);
    box(bench.w + 10, 2, 24, m.steel, bench.cx, 1, 0);
    stack(bench.front + fx * 14, 0, 55);
    r.top = 58;
    const roller = zRod(2.4, m.pad, 24);
    const lever = rod(1.1, m.steel);
    const grip = zRod(1, m.chrome, 26);
    r.update = (st) => {
      const kn = mid(st.knee);
      const an = mid(st.ankle);
      const sd = an.clone().sub(kn).normalize();
      const sf = V(-sd.y, sd.x, 0).multiplyScalar(fx);
      const rc = an.clone().addScaledVector(sf, -3); // 발목 뒤쪽
      roller.position.copy(rc);
      between(lever, V(bench.back, bench.top + 1, 14), V(rc.x, rc.y, 14));
      grip.position.copy(mid(st.palm));
    };
  } else if (name === "legPress") {
    r.hideBench = true;
    seat(bench.w * 0.8, 24);
    // 등받이: 첫 자세의 몸통 방향으로 기울어짐
    const H3 = P(k0.h);
    const u0 = V(Math.sin((k0.t * Math.PI) / 180) * fx, -Math.cos((k0.t * Math.PI) / 180), 0).normalize();
    const f0 = V(u0.y, -u0.x, 0);
    const back = box(5, 34, 24, m.pad, 0, 0, 0);
    back.position.copy(H3.clone().addScaledVector(u0, 15).addScaledVector(f0, -5));
    back.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(f0, u0, V(0, 0, 1)));
    // 레일: 발이 밀리는 방향
    const A3 = P(k0.ft);
    const B3 = P(k1.ft);
    let d = B3.clone().sub(A3);
    if (d.length() < 2) d = V(fx * 0.7, 0.7, 0);
    d.normalize();
    const n = V(-d.y, d.x, 0);
    [-13, 13].forEach((z) => {
      const a = A3.clone().addScaledVector(d, -6).addScaledVector(n, -4);
      const b = B3.clone().addScaledVector(d, 34).addScaledVector(n, -4);
      a.z = b.z = z;
      rodAB(1.2, m.chrome, a, b);
      rodAB(1.4, m.steel, V(b.x, 0, z), b);
      rodAB(1.4, m.steel, V(a.x, 0, z), a);
      r.top = Math.max(r.top, b.y);
    });
    const plate = box(3, 24, 28, m.steel, 0, 0, 0);
    plate.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(d, n, V(0, 0, 1)));
    r.update = (st) => {
      plate.position.copy(mid(st.ankle).addScaledVector(d, 4.5));
      plate.position.z = 0;
    };
  } else if (name === "pulldown") {
    r.hideBench = true;
    seat(bench.w * 0.7, 22);
    const hand0 = P(k0.hand);
    const colX = hand0.x + fx * 20;
    const topY = hand0.y + 16;
    post(colX, 0, topY);
    box(Math.abs(colX - hand0.x) + 6, 4, 6, m.steel, (colX + hand0.x) / 2, topY, 0);
    const pulley = zRod(3, m.chrome, 3);
    pulley.position.set(hand0.x, topY - 3, 0);
    stack(colX + fx * 9, 0, topY - 8);
    r.top = topY + 3;
    const pad = zRod(2.4, m.pad, 22);
    const cable = rod(0.35, m.cable);
    r.update = (st) => {
      const kn = mid(st.knee);
      pad.position.set(kn.x - fx * 3, kn.y + 4.2, 0); // 허벅지 위 무릎 패드
      const bar = mid(st.palm);
      between(cable, V(hand0.x, topY - 3, 0), bar);
    };
  } else if (name === "cableRow") {
    r.hideBench = true;
    seat(bench.w * 0.8, 22);
    const ank = P(k0.ft);
    const hand0 = P(k0.hand);
    const colX = ank.x + fx * 16;
    post(colX, 0, hand0.y + 14);
    box(Math.abs(colX - bench.cx) + 10, 2, 10, m.steel, (colX + bench.cx) / 2, 1, 0);
    const pulley = zRod(2.6, m.chrome, 3);
    pulley.position.set(colX - fx * 3, hand0.y, 0);
    stack(colX + fx * 9, 0, hand0.y + 10);
    r.top = hand0.y + 16;
    const foot = box(3, 14, 26, m.steel, 0, 0, 0);
    foot.rotation.z = fx * 0.45;
    const cable = rod(0.35, m.cable);
    const grip = zRod(1, m.chrome, 9);
    r.update = (st) => {
      const an = mid(st.ankle);
      foot.position.set(an.x + fx * 4, an.y + 1, 0);
      const h = mid(st.palm);
      grip.position.copy(h);
      between(cable, V(colX - fx * 3, hand0.y, 0), h);
    };
  } else if (name === "chestPress" || name === "shoulderPress") {
    r.hideBench = true;
    seat(bench.w * 0.8, 22);
    const bk = box(5, 40, 22, m.pad, bench.back - fx * 1, bench.top + 21, 0);
    bk.rotation.z = fx * 0.06;
    const pvY = name === "chestPress" ? bench.top + 46 : bench.top + 12;
    const pvX = bench.back - fx * 8;
    post(pvX, 0, bench.top + 48);
    stack(pvX - fx * 10, 0, bench.top + 40);
    r.top = bench.top + 50;
    const levers = [rod(1.1, m.steel), rod(1.1, m.steel)];
    const grips = [rod(1, m.chrome), rod(1, m.chrome)];
    r.update = (st) => {
      ["l", "r"].forEach((sd, i) => {
        const p = st.palm[sd];
        between(grips[i], p.clone().add(V(0, -3, 0)), p.clone().add(V(0, 3, 0)));
        between(levers[i], V(pvX, pvY, p.z + Math.sign(p.z) * 3), p.clone().add(V(0, 0, Math.sign(p.z) * 3)));
      });
    };
  } else if (name === "uprightBench") {
    const bk = box(5, 36, 18, m.pad, bench.back - fx * 1, bench.top + 18, 0);
    bk.rotation.z = fx * 0.1;
    box(3, bench.top + 16, 3, m.steel, bench.back - fx * 4, (bench.top + 16) / 2, 0);
    r.top = bench.top + 36;
  } else if (name === "cableHigh" || name === "cableFace") {
    const H3 = P(k0.h);
    const colX = H3.x + fx * 30;
    const sh = H3.y + 26;
    const pY = name === "cableHigh" ? sh + 22 : sh + 6;
    post(colX, 0, sh + 30);
    stack(colX + fx * 8, 0, sh + 24);
    const pulley = zRod(2.6, m.chrome, 3);
    pulley.position.set(colX - fx * 3.5, pY, 0);
    r.top = sh + 32;
    const cable = rod(0.35, m.cable);
    const ropeA = rod(0.8, m.cable);
    const ropeB = rod(0.8, m.cable);
    const barH = zRod(0.9, m.chrome, 12);
    r.update = (st) => {
      const h = mid(st.palm);
      const knot = name === "cableHigh" ? h : h.clone().add(V(fx * 6, 0, 0));
      between(cable, V(colX - fx * 3.5, pY, 0), knot);
      if (name === "cableHigh") {
        barH.position.copy(h);
        ropeA.visible = ropeB.visible = false;
      } else {
        barH.visible = false;
        between(ropeA, knot, st.palm.l);
        between(ropeB, knot, st.palm.r);
      }
    };
  } else if (name === "cableFly" || name === "cableChop" || name === "cableLow") {
    // 앞모습 동작: 옆(Z)에 기둥
    const cols = name === "cableFly" ? [[130, 26, "l"], [30, 26, "r"]] : name === "cableChop" ? [[132, 14, "mid"]] : [[46, 104, "l"]];
    const cables = [];
    cols.forEach(([x2, y2, which]) => {
      const p = P([x2, y2], 0);
      const z = p.z + Math.sign(p.z) * 4;
      post(-4, z, Math.max(p.y, 40) + 8);
      stack(-12, z, Math.max(p.y, 40) + 2);
      const pulley = rod(2.4, m.chrome);
      pulley.scale.set(1, 3, 1);
      pulley.position.set(-2, p.y, p.z);
      r.top = Math.max(r.top, p.y + 10);
      cables.push({ from: V(-2, p.y, p.z), which: which, line: rod(0.35, m.cable), grip: rod(1, m.chrome) });
    });
    r.update = (st) => {
      cables.forEach((cb) => {
        // 케이블 레터럴은 오른쪽(그림 오른쪽 = 1번) 손 하나만
        const h = cb.which === "mid" ? mid(st.palm) : cb.which === "l" && name === "cableLow" ? st.palm.l : st.palm[cb.which === "l" ? "l" : "r"];
        between(cb.line, cb.from, h);
        between(cb.grip, h.clone().add(V(0, -3, 0)), h.clone().add(V(0, 3, 0)));
      });
    };
  } else if (name === "smith" || name === "squatRack" || name === "benchRack") {
    // 바벨 거치대 (스미스는 봉이 레일 사이를 오르내림)
    const hand0 = P(k0.hand);
    let x = hand0.x - fx * 3;
    let h = 96;
    let hookY = hand0.y - 2;
    if (name === "benchRack") {
      const S3 = P([k0.h[0] + Math.sin((k0.t * Math.PI) / 180) * 30, k0.h[1] + Math.cos((k0.t * Math.PI) / 180) * 30]);
      x = S3.x + (S3.x - P(k0.h).x > 0 ? 6 : -6);
      h = hand0.y + 4;
      hookY = hand0.y - 1;
    }
    const zs = name === "benchRack" ? 22 : 30;
    [-zs, zs].forEach((z) => {
      box(4, h, 4, m.steel, x, h / 2, z);
      box(14, 2, 6, m.steel, x, 1, z);
      if (name !== "smith") box(5, 2, 4, m.chrome, x + fx * 3, hookY, z); // J 후크
    });
    if (name === "smith") box(4, 4, zs * 2 + 4, m.steel, x, h, 0);
    r.top = h + 2;
    if (name === "smith") {
      const sleeves = [box(3, 5, 3, m.chrome, x, 0, -zs), box(3, 5, 3, m.chrome, x, 0, zs)];
      r.update = (st) => sleeves.forEach((s) => (s.position.y = mid(st.palm).y));
    }
  } else if (name === "assistPull") {
    const kneePad = box(12, 3, 24, m.pad, 0, 0, 0);
    r.update = (st) => {
      const kn = mid(st.knee);
      kneePad.position.set(kn.x, kn.y - 3, 0);
    };
  } else if (name === "calfMachine") {
    const H3 = P(k0.h);
    const px = H3.x - fx * 10;
    const shY = H3.y + 30;
    post(px, 0, shY + 10);
    stack(px - fx * 8, 0, shY + 4);
    r.top = shY + 12;
    const pads = [box(7, 4, 7, m.pad, 0, 0, 0), box(7, 4, 7, m.pad, 0, 0, 0)];
    const arms = [rod(1, m.steel), rod(1, m.steel)];
    r.update = (st) => {
      ["l", "r"].forEach((sd, i) => {
        const s = st.sh[sd].clone().add(V(0, 4, 0));
        pads[i].position.copy(s);
        between(arms[i], V(px, s.y + 1, s.z), s);
      });
    };
  } else {
    return null;
  }
  return r;
}
