/* ==========================================================
   Casino Fest · Bac Bo — copos de dados em 3D (Three.js + física)
   Cada lado tem um copo de vidro sobre uma base com luz. No lance a
   base chacoalha e os dados quicam lá dentro (física de verdade, com
   cannon-es). O resultado já vem decidido do bacbo.js: a simulação
   roda antes, inteira, e depois as faces do dado são "renumeradas"
   para que a face que ficou para cima seja o valor sorteado.
   Se o 3D não carregar, os dados em CSS continuam aparecendo.
   ========================================================== */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/geometries/RoundedBoxGeometry.js';

// medidas (o dado tem lado 1)
const R = 1.75;          // raio interno do copo
const WALL_H = 1.6;      // parte reta do vidro
const CEIL = 2.1;        // teto invisível da física (abaixo da cúpula)
const DT = 1 / 120;
const GRAVITY = 70;

// faces da caixa na ordem do BoxGeometry (+x, −x, +y, −y, +z, −z) e o valor de cada uma
const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(v => new THREE.Vector3(...v));
const VALUES = [2, 5, 1, 6, 3, 4];
const PIPS = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]],
  4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]],
  6: [[.27, .25], [.73, .25], [.27, .5], [.73, .5], [.27, .75], [.73, .75]] };
const THEME = {
  player: { light: '#7fb2ff', base: '#2f7bff', deep: '#1640b8', glow: '#3d8bff', felt: '#0e1f5c' },
  banker: { light: '#ff97a4', base: '#ff3d55', deep: '#a3121f', glow: '#ff4760', felt: '#4a0c18' },
};
const UP = new THREE.Vector3(0, 1, 0);

/* ---------- texturas das faces ---------- */
const faceCache = {};
function faceMaterials(side) {
  if (faceCache[side]) return faceCache[side];
  const t = THEME[side];
  faceCache[side] = VALUES.map(v => {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const bg = g.createRadialGradient(S * .32, S * .28, S * .05, S * .5, S * .5, S * .75);
    bg.addColorStop(0, t.light); bg.addColorStop(.5, t.base); bg.addColorStop(1, t.deep);
    g.fillStyle = bg;
    g.fillRect(0, 0, S, S);
    for (const [x, y] of PIPS[v]) {
      const px = x * S, py = y * S, r = S * (v === 1 ? .13 : .085);
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.beginPath(); g.arc(px, py + r * .12, r * 1.08, 0, Math.PI * 2); g.fill();
      const pip = g.createRadialGradient(px - r * .3, py - r * .35, r * .1, px, py, r);
      pip.addColorStop(0, '#ffffff'); pip.addColorStop(.7, '#ece8f6'); pip.addColorStop(1, '#bdb6d2');
      g.fillStyle = pip;
      g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return new THREE.MeshPhysicalMaterial({ map: tex, roughness: .28, clearcoat: .8, clearcoatRoughness: .2, envMapIntensity: .9 });
  });
  return faceCache[side];
}

// rotação que deixa o valor v para cima, com um giro aleatório em volta do eixo vertical
function restQuat(v, yaw = Math.random() * Math.PI * 2) {
  const q = new THREE.Quaternion().setFromUnitVectors(NORMALS[VALUES.indexOf(v)], UP);
  return new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(q);
}
const REST_POS = [[-0.62, 0.5, 0.22], [0.62, 0.5, -0.22]];

/* ---------- vidro: borda brilhante (fresnel) e um reflexo vertical ---------- */
function glassMaterial(tint, side, k) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side,
    uniforms: { tint: { value: new THREE.Color(tint) }, k: { value: k } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 tint; uniform float k; varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 n = normalize(vN);
        float f = pow(1.0 - abs(dot(n, normalize(vV))), 2.4);
        float streak = smoothstep(0.93, 0.985, dot(n, normalize(vec3(-0.62, 0.25, 0.75))));
        float streak2 = smoothstep(0.965, 0.995, dot(n, normalize(vec3(0.7, 0.1, 0.7)))) * 0.6;
        vec3 c = mix(tint, vec3(1.0), 0.55 + f * 0.45);
        gl_FragColor = vec4(c, clamp(0.04 + f * k + (streak + streak2) * k * 0.75, 0.0, 0.85));
      }`,
  });
}

/* ---------- física: simula o lance inteiro e guarda os quadros ---------- */
function simulate(start, shakeSteps) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY, 0) });
  world.defaultContactMaterial.friction = 0.22;
  world.defaultContactMaterial.restitution = 0.34;
  world.solver.iterations = 14;

  const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);
  const ceil = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  ceil.quaternion.setFromEuler(Math.PI / 2, 0, 0);
  ceil.position.set(0, CEIL, 0);
  world.addBody(ceil);
  const N = 28, half = R * Math.tan(Math.PI / N) + 0.06;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wall = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.5, CEIL, half)) });
    wall.position.set(Math.cos(a) * (R + 0.5), CEIL / 2, Math.sin(a) * (R + 0.5));
    wall.quaternion.setFromEuler(0, -a, 0);
    world.addBody(wall);
  }

  const bodies = start.map(({ p, q }) => {
    const b = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)), linearDamping: 0.04, angularDamping: 0.1 });
    b.position.set(p.x, p.y, p.z);
    b.quaternion.set(q.x, q.y, q.z, q.w);
    world.addBody(b);
    return b;
  });

  const frames = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  let still = 0;
  for (let s = 0; s < 900; s++) {
    // a base dá trancos: cada dado leva um impulso para cima e de lado
    if (s < shakeSteps && s % 10 === 0) {
      for (const b of bodies) {
        b.velocity.set(rnd(-6, 6) - b.position.x * 1.2, rnd(9, 14.5), rnd(-6, 6) - b.position.z * 1.2);
        b.angularVelocity.set(rnd(-26, 26), rnd(-18, 18), rnd(-26, 26));
      }
    }
    world.step(DT);
    frames.push(bodies.map(b => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
    if (s > shakeSteps) {
      const calm = bodies.every(b => b.velocity.lengthSquared() < 0.004 && b.angularVelocity.lengthSquared() < 0.004);
      still = calm ? still + 1 : 0;
      if (still > 12) break;
    }
  }
  return frames;
}

// face (em coordenadas do corpo) que ficou para cima e o quanto ela está reta
function topFace(qArr) {
  const inv = new THREE.Quaternion(qArr[3], qArr[4], qArr[5], qArr[6]).invert();
  const up = UP.clone().applyQuaternion(inv);
  let best = 0, dot = -2;
  NORMALS.forEach((n, i) => { const d = n.dot(up); if (d > dot) { dot = d; best = i; } });
  return { n: NORMALS[best], flat: dot };
}

/* ---------- cena de um copo ---------- */
function mount(container, side) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    console.warn('Bac Bo 3D indisponível, usando os dados em CSS.', e);
    return null;
  }
  const t = THEME[side];
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const LOOK = new THREE.Vector3(0, 0.9, 0);

  scene.add(new THREE.HemisphereLight('#f4ecff', '#1a0f33', 0.8));
  const key = new THREE.DirectionalLight('#ffffff', 2.6);
  key.position.set(2.5, 9, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
  key.shadow.bias = -0.0008;
  scene.add(key);
  const glowLight = new THREE.PointLight(t.glow, 6, 7);
  glowLight.position.set(0, 0.6, 0);
  scene.add(glowLight);

  // tudo que chacoalha junto: base, vidro e dados
  const rig = new THREE.Group();
  scene.add(rig);

  const metal = new THREE.MeshStandardMaterial({ color: '#221a3a', roughness: 0.32, metalness: 0.75, envMapIntensity: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: '#ffc940', roughness: 0.25, metalness: 0.9, envMapIntensity: 1.2 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.42, R + 0.62, 0.62, 72), metal);
  base.position.y = -0.31;
  base.receiveShadow = true;
  rig.add(base);
  const felt = new THREE.Mesh(new THREE.CircleGeometry(R + 0.05, 72), new THREE.MeshStandardMaterial({ color: t.felt, roughness: 0.9 }));
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = 0.002;
  felt.receiveShadow = true;
  rig.add(felt);
  const ledMat = new THREE.MeshStandardMaterial({ color: t.glow, emissive: t.glow, emissiveIntensity: 1.4, roughness: 0.4 });
  const led = new THREE.Mesh(new THREE.TorusGeometry(R + 0.24, 0.075, 12, 96), ledMat);
  led.rotation.x = Math.PI / 2;
  led.position.y = 0.02;
  rig.add(led);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R + 0.5, 0.05, 10, 96), gold);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.0;
  rig.add(lip);

  // vidro: o lado de dentro é desenhado antes do lado de fora
  const glassGeo = new THREE.LatheGeometry([
    ...Array.from({ length: 2 }, (_, i) => new THREE.Vector2(R + 0.08, i * WALL_H)),
    ...Array.from({ length: 13 }, (_, i) => {
      const a = ((i + 1) / 13) * (Math.PI / 2);
      return new THREE.Vector2((R + 0.08) * Math.cos(a), WALL_H + (R + 0.08) * 0.62 * Math.sin(a));
    }),
  ], 72);
  const glassBack = new THREE.Mesh(glassGeo, glassMaterial(t.light, THREE.BackSide, 0.35));
  const glassFront = new THREE.Mesh(glassGeo, glassMaterial(t.light, THREE.FrontSide, 0.7));
  glassBack.renderOrder = 1;
  glassFront.renderOrder = 2;
  rig.add(glassBack, glassFront);
  const band = new THREE.Mesh(new THREE.TorusGeometry(R + 0.09, 0.025, 8, 96), gold);
  band.rotation.x = Math.PI / 2;
  band.position.y = WALL_H;
  rig.add(band);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12), gold);
  cap.position.y = WALL_H + (R + 0.08) * 0.62 + 0.05;
  rig.add(cap);

  // dados
  const geo = new RoundedBoxGeometry(1, 1, 1, 4, 0.14);
  const mats = faceMaterials(side);
  const dice = [0, 1].map(() => {
    const m = new THREE.Mesh(geo, mats);
    m.castShadow = true;
    rig.add(m);
    return m;
  });

  const render = () => renderer.render(scene, camera);
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // afasta a câmera até o copo inteiro caber, em qualquer proporção
    const tan = Math.tan((camera.fov / 2) * Math.PI / 180);
    const need = Math.max(2.35 / tan, 2.5 / (tan * camera.aspect));
    const dir = new THREE.Vector3(0, 0.95, 1).normalize();
    camera.position.copy(LOOK).addScaledVector(dir, need * 1.06);
    camera.lookAt(LOOK);
    camera.updateProjectionMatrix();
    render();
  };
  new ResizeObserver(resize).observe(container);

  function show(values) {
    values.forEach((v, i) => {
      dice[i].position.set(...REST_POS[i]);
      dice[i].quaternion.copy(restQuat(v, (i ? 0.35 : -0.3) + (Math.random() - 0.5) * 0.9));
    });
    render();
  }

  let playing = null;
  function roll(values, shakeMs = 1100) {
    if (playing) playing.finish();
    const shakeSteps = Math.round(shakeMs / 1000 / DT);
    const start = dice.map(d => ({ p: d.position.clone(), q: d.quaternion.clone() }));
    // procura um lance em que os dois dados terminem retos no chão
    let frames, tops;
    for (let tries = 0; tries < 8; tries++) {
      frames = simulate(start, shakeSteps);
      const last = frames[frames.length - 1];
      tops = last.map(f => topFace(f));
      if (tops.every(x => x.flat > 0.985) && last.every(f => f[1] < 0.56)) break;
    }
    // renumera as faces: o valor sorteado vai para a face que ficou em cima
    const offsets = values.map((v, i) => new THREE.Quaternion().setFromUnitVectors(NORMALS[VALUES.indexOf(v)], tops[i].n));
    // a troca acontece no ar, com o dado girando rápido (não dá para ver)
    const SWAP = 7;
    const q = new THREE.Quaternion(), qEnd = new THREE.Quaternion();
    const ms = frames.length * DT * 1000;

    const done = new Promise(resolve => {
      const t0 = performance.now();
      let raf = 0, timer = 0, over = false;
      const apply = k => {
        const f = frames[Math.max(0, Math.min(frames.length - 1, k))];
        const shaking = k < shakeSteps + 6;
        rig.position.y = shaking ? Math.abs(Math.sin(k * 0.62)) * 0.05 : 0;
        rig.rotation.z = shaking ? Math.sin(k * 0.41) * 0.012 : 0;
        ledMat.emissiveIntensity = shaking ? 1.4 + Math.abs(Math.sin(k * 0.25)) * 1.6 : 1.4;
        glowLight.intensity = shaking ? 9 : 6;
        f.forEach((d, i) => {
          dice[i].position.set(d[0], d[1], d[2]);
          q.set(d[3], d[4], d[5], d[6]);
          if (k >= SWAP) q.multiply(offsets[i]);
          dice[i].quaternion.copy(q);
        });
        render();
      };
      const finish = () => {
        if (over) return;
        over = true;
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        apply(frames.length - 1);
        // acerta o dado perfeitamente reto (correção mínima)
        dice.forEach((d, i) => {
          qEnd.copy(d.quaternion);
          const yaw = new THREE.Euler().setFromQuaternion(qEnd, 'YXZ').y;
          const target = restQuat(values[i], 0);
          const cand = new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(target);
          // escolhe, entre os 4 giros possíveis, o mais perto do atual
          let best = cand, bestDot = -1;
          for (let s = 0; s < 4; s++) {
            const c = new THREE.Quaternion().setFromAxisAngle(UP, (s * Math.PI) / 2).multiply(cand);
            const dot = Math.abs(c.dot(qEnd));
            if (dot > bestDot) { bestDot = dot; best = c; }
          }
          d.quaternion.copy(best);
          d.position.y = 0.5;
        });
        rig.position.y = 0;
        rig.rotation.z = 0;
        render();
        playing = null;
        resolve();
      };
      const frame = now => {
        // o horário do quadro pode vir um pouco antes do t0: nunca deixa ficar negativo
        const k = Math.max(0, Math.floor((now - t0) / 1000 / DT));
        if (k >= frames.length - 1) return finish();
        apply(k);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      timer = setTimeout(finish, ms + 400);   // aba em segundo plano: termina mesmo assim
      playing = { finish };
    });
    // a duração vai junto, para o bacbo.js marcar quando creditar as fichas
    return Object.assign(done, { ms });
  }

  resize();
  return { show, roll, setWin(on) { ledMat.emissiveIntensity = on ? 3 : 1.4; render(); } };
}

window.BacBo3D = { mount };
document.dispatchEvent(new Event('bacbo3d-ready'));
