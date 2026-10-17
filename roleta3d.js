/* ==========================================================
   Casino Fest · Roleta — roda em 3D (Three.js)
   Só desenha: os ângulos da roda e da bolinha vêm do roleta.js,
   então o resultado é sempre o mesmo da versão 2D.
   Se o 3D não carregar, a roda em SVG continua aparecendo.
   ========================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const STEP = 360 / WHEEL.length;
const DEG = Math.PI / 180;
const colorOf = n => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');
const FILL = { red: '#d01f36', black: '#18161c', green: '#12a87c' };
const POCKET = { red: '#9e1328', black: '#0b0b0d', green: '#0a7a58' };

// medidas da roda (raio externo da cuba ≈ 1)
const R_IN = 0.53;      // começo das casas
const R_NUM = 0.655;    // começo do anel de números (largo, para ler bem)
const R_OUT = 0.80;     // fim do prato que gira
const TRACK_R = 0.885;  // pista da bolinha
const POCKET_R = 0.592; // bolinha parada dentro da casa
const BALL_R = 0.026;
// raios usados pelo roleta.js (SVG) para a pista e para a casa
const SVG_TRACK = 139, SVG_POCKET = 97;

// perfil da cuba (raio, altura): a pista inclinada até a borda
const BOWL = [[R_OUT, 0.0], [0.82, 0.012], [0.87, 0.036], [0.93, 0.072], [0.985, 0.11]];
const RIM = [[0.985, 0.11], [1.0, 0.15], [1.045, 0.162], [1.075, 0.125], [1.075, -0.07]];

function lathe(points, segments = 160) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}
function bowlY(r) {
  if (r <= BOWL[0][0]) return 0;
  for (let i = 1; i < BOWL.length; i++) {
    const [r0, y0] = BOWL[i - 1], [r1, y1] = BOWL[i];
    if (r <= r1) return y0 + (y1 - y0) * ((r - r0) / (r1 - r0));
  }
  return BOWL[BOWL.length - 1][1];
}

// face do prato: casas, números e filetes desenhados numa textura
function faceTexture() {
  const S = 2048, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const k = (S / 2) / R_OUT;
  g.translate(S / 2, S / 2);

  const center = g.createRadialGradient(0, 0, 0, 0, 0, R_IN * k);
  center.addColorStop(0, '#9a6236');
  center.addColorStop(1, '#4a2410');
  g.fillStyle = center;
  g.beginPath(); g.arc(0, 0, R_IN * k, 0, Math.PI * 2); g.fill();

  WHEEL.forEach((n, i) => {
    const a0 = (i * STEP - STEP / 2 - 90) * DEG, a1 = a0 + STEP * DEG, col = colorOf(n);
    g.beginPath(); g.arc(0, 0, R_NUM * k, a0, a1); g.arc(0, 0, R_IN * k, a1, a0, true); g.closePath();
    g.fillStyle = POCKET[col]; g.fill();
    g.beginPath(); g.arc(0, 0, R_OUT * k, a0, a1); g.arc(0, 0, R_NUM * k, a1, a0, true); g.closePath();
    g.fillStyle = FILL[col]; g.fill();
    g.save();
    g.rotate(i * STEP * DEG);
    g.font = `800 ${Math.round(0.082 * k)}px Outfit, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 0.014 * k;
    g.strokeStyle = 'rgba(10, 4, 24, .75)';
    g.strokeText(String(n), 0, -((R_NUM + R_OUT) / 2) * k);
    g.fillStyle = '#fff';
    g.fillText(String(n), 0, -((R_NUM + R_OUT) / 2) * k);
    g.restore();
  });
  g.strokeStyle = '#ffc928';
  g.lineWidth = 5;
  WHEEL.forEach((_, i) => {
    const a = (i * STEP - STEP / 2 - 90) * DEG;
    g.beginPath();
    g.moveTo(Math.cos(a) * R_NUM * k, Math.sin(a) * R_NUM * k);
    g.lineTo(Math.cos(a) * R_OUT * k, Math.sin(a) * R_OUT * k);
    g.stroke();
  });
  g.lineWidth = 8;
  for (const r of [R_NUM, R_OUT - 0.005]) { g.beginPath(); g.arc(0, 0, r * k, 0, Math.PI * 2); g.stroke(); }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function mount(container) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    console.warn('Roleta 3D indisponível, usando a versão 2D.', e);
    return null;
  }
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

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 3.55, 1.45);
  camera.lookAt(0, -0.06, 0.1);
  camera.zoom = 0.86;                    // afastada: a borda da cuba não é cortada

  // luzes: principal com sombra, céu/chão suave e um toque rosa da marca
  scene.add(new THREE.HemisphereLight('#fff1dc', '#2a160a', 0.7));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(1.4, 3.2, 1.3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 0.5, far: 8 });
  key.shadow.bias = -0.0006;
  scene.add(key);
  const pink = new THREE.PointLight('#ffb35c', 4, 6);
  pink.position.set(-1.8, 1.1, -1.2);
  scene.add(pink);

  const gold = new THREE.MeshStandardMaterial({ color: '#ffc940', metalness: 0.9, roughness: 0.26, envMapIntensity: 1.1 });

  // cuba fixa: pista, borda envernizada e base
  const track = new THREE.Mesh(lathe(BOWL), new THREE.MeshStandardMaterial({ color: '#1e0f07', roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide, envMapIntensity: 0.6 }));
  const rim = new THREE.Mesh(lathe(RIM), new THREE.MeshStandardMaterial({ color: '#5a2a12', roughness: 0.25, metalness: 0.15, envMapIntensity: 0.9 }));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.075, 1.0, 0.12, 96), new THREE.MeshStandardMaterial({ color: '#2a1208', roughness: 0.55 }));
  base.position.y = -0.13;
  track.receiveShadow = rim.receiveShadow = true;
  rim.castShadow = true;
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.013, 12, 160), gold);
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = 0.15;
  scene.add(track, rim, base, rimRing);

  // losangos na pista (desviam a bolinha nas roletas de verdade)
  for (let i = 0; i < 8; i++) {
    const a = (i * 45 + 22.5) * DEG, r = 0.925;
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.026), gold);
    d.scale.set(0.7, 0.45, 1.5);
    d.position.set(r * Math.sin(a), bowlY(r) + 0.012, -r * Math.cos(a));
    d.rotation.y = Math.PI - a;
    d.castShadow = true;
    scene.add(d);
  }

  // prato que gira: face pintada, divisórias das casas, cone e torre
  const rotor = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CircleGeometry(R_OUT, 160), new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.42, metalness: 0.05 }));
  face.rotation.x = -Math.PI / 2;
  face.receiveShadow = true;
  rotor.add(face);

  const frets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 0.034, R_NUM - R_IN + 0.012), gold, WHEEL.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const rm = (R_IN + R_NUM) / 2;
  WHEEL.forEach((_, i) => {
    const a = (i * STEP - STEP / 2) * DEG;
    q.setFromAxisAngle(up, Math.PI - a);
    m.compose(new THREE.Vector3(rm * Math.sin(a), 0.017, -rm * Math.cos(a)), q, one);
    frets.setMatrixAt(i, m);
  });
  frets.castShadow = true;
  rotor.add(frets);
  for (const [r, y, t] of [[R_IN, 0.004, 0.009], [R_OUT, 0.004, 0.007]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 160), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    rotor.add(ring);
  }

  const cone = new THREE.Mesh(lathe([[R_IN - 0.005, 0.0], [0.46, 0.035], [0.3, 0.085], [0.17, 0.115], [0.09, 0.125], [0, 0.125]], 96),
    new THREE.MeshStandardMaterial({ color: '#7a4422', roughness: 0.3, metalness: 0.2, envMapIntensity: 0.9 }));
  cone.castShadow = cone.receiveShadow = true;
  rotor.add(cone);

  const turret = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.1, 32), gold);
  post.position.y = 0.17;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 32, 16), gold);
  knob.position.y = 0.235;
  turret.add(post, knob);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.24, 12), gold);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.12, 0.2, 0);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 12), gold);
    tip.position.set(0.245, 0.2, 0);
    const holder = new THREE.Group();
    holder.add(arm, tip);
    holder.rotation.y = i * Math.PI / 2;
    turret.add(holder);
  }
  turret.traverse(o => { if (o.isMesh) o.castShadow = true; });
  rotor.add(turret);
  scene.add(rotor);

  // bolinha
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 16),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.12, metalness: 0.05, envMapIntensity: 1.2 }));
  ball.castShadow = true;
  scene.add(ball);

  // sombra suave no feltro
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.38 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.19;
  ground.receiveShadow = true;
  scene.add(ground);

  const render = () => renderer.render(scene, camera);
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  return {
    // mesmos parâmetros do desenho 2D: ângulos em graus (horário, a partir do topo) e raio no SVG
    set(wheelDeg, ballDeg, svgR) {
      rotor.rotation.y = -wheelDeg * DEG;
      const f = Math.max(0, (svgR - SVG_POCKET) / (SVG_TRACK - SVG_POCKET));
      const r = POCKET_R + f * (TRACK_R - POCKET_R);
      const y = (r > R_OUT ? bowlY(r) : 0.004) + BALL_R + (f > 0.02 && f < 0.98 ? Math.sin(f * Math.PI) * 0.03 : 0);
      ball.position.set(r * Math.sin(ballDeg * DEG), y, -r * Math.cos(ballDeg * DEG));
      render();
    },
  };
}

// espera a fonte dos números carregar antes de pintar a roda
try { await document.fonts.load('800 60px Outfit'); } catch (e) { /* usa a fonte reserva */ }
window.RoletaWheel3D = { mount };
document.dispatchEvent(new Event('roleta3d-ready'));
