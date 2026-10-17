/* ==========================================================
   Casino Fest · Rei da Folia — o rei em 2D (ilustração recortada)
   Uma única imagem (rei.webp) dividida em camadas com máscaras:
   corpo, cabeça e braço do cetro. Cada camada gira no seu
   "osso" (pescoço e ombro), como nos personagens de slot.
   API usada pelo folia.js: pose(nome, ms), cast(on, ponto), tip().
   ========================================================== */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const IMG = 'folia/rei.webp';
  const W = 951, H = 1441;                       // coordenadas da arte original
  const SHOULDER = [572, 478];                   // osso do ombro: meio da manga, na costura
  const JOINT_R = 92;                            // junta redonda (metade da altura da manga)
  const NECK = [345, 362];                       // osso do pescoço
  const FEET = [385, 1425];
  const STAR = [881, 235];                       // estrela do cetro (de onde sai o raio)
  const ARM_ANGLE = 11;                          // ombro → mão: a arte já aponta 11° para baixo
  const ARM = '556,330 700,140 951,110 951,800 800,800 700,620 600,610 566,600';
  const HEAD = '200,0 460,0 458,240 450,300 430,345 395,368 350,374 300,364 262,337 245,300 225,250 200,150';
  const EYES = [[323, 199, 19, 11, '#f6bd8e'], [390, 196, 18, 11, '#f8bc89']];

  const damp = (cur, tgt, k, dt) => cur + (tgt - cur) * (1 - Math.exp(-k * dt));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  let uid = 0;

  function mount(container) {
    const id = `rk${++uid}`;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'rei2d');
    svg.setAttribute('aria-hidden', 'true');
    const img = (extra = '') => `<image href="${IMG}" width="${W}" height="${H}" ${extra}/>`;
    svg.innerHTML = `
      <defs>
        <radialGradient id="${id}-glow">
          <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".3" stop-color="#ffe08a" stop-opacity=".7"/>
          <stop offset="1" stop-color="#ffc940" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${id}-joint" gradientUnits="userSpaceOnUse" x1="0" y1="${SHOULDER[1] - JOINT_R}" x2="0" y2="${SHOULDER[1] + JOINT_R}">
          <stop offset="0" stop-color="#fcf6ea"/><stop offset=".45" stop-color="#ece1cb"/><stop offset="1" stop-color="#bba98a"/>
        </linearGradient>
        <radialGradient id="${id}-shadow"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
        <!-- corpo: sem o braço e sem o alto da cabeça (essas partes têm camada própria) -->
        <mask id="${id}-body" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
          <rect width="${W}" height="${H}" fill="#fff"/>
          <polygon points="${ARM}" fill="#000"/>
          <rect x="195" y="0" width="270" height="245" fill="#000"/>
        </mask>
        <mask id="${id}-arm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
          <polygon points="${ARM}" fill="#fff"/>
        </mask>
        <clipPath id="${id}-head"><polygon points="${HEAD}"/></clipPath>
      </defs>
      <ellipse class="rk-shadow" cx="${FEET[0]}" cy="${FEET[1]}" rx="270" ry="34" fill="url(#${id}-shadow)"/>
      <g class="rk-root">
        <g class="rk-arm">
          <!-- junta do ombro: gira junto e fica sob a jaqueta, então o contorno do ombro nunca abre -->
          <circle cx="${SHOULDER[0]}" cy="${SHOULDER[1]}" r="${JOINT_R}" fill="url(#${id}-joint)"/>
          ${img(`mask="url(#${id}-arm)"`)}
          <circle class="rk-glow" cx="${STAR[0]}" cy="${STAR[1]}" r="95" fill="url(#${id}-glow)" style="mix-blend-mode:screen"/>
        </g>
        ${img(`mask="url(#${id}-body)"`)}
        <g class="rk-head">
          ${img(`clip-path="url(#${id}-head)"`)}
          ${EYES.map(([cx, cy, rx, ry, c]) => `<g class="rk-lid" data-cx="${cx}" data-top="${cy - ry}" style="display:none">
            <ellipse cx="${cx}" cy="${cy}" rx="${rx + 2}" ry="${ry + 1}" fill="${c}"/>
            <path d="M${cx - rx} ${cy + 2}Q${cx} ${cy + ry - 1} ${cx + rx} ${cy + 2}" stroke="#4a2410" stroke-width="3" fill="none" stroke-linecap="round"/>
          </g>`).join('')}
        </g>
      </g>`;
    container.appendChild(svg);

    const root = svg.querySelector('.rk-root'), head = svg.querySelector('.rk-head'), arm = svg.querySelector('.rk-arm');
    const glow = svg.querySelector('.rk-glow'), shadow = svg.querySelector('.rk-shadow');
    const lids = [...svg.querySelectorAll('.rk-lid')];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const KEYS = ['hop', 'sway', 'head', 'headY', 'arm', 'glow'];
    const C = Object.fromEntries(KEYS.map(k => [k, 0]));
    const st = {
      nextAt: performance.now() / 1000 + rnd(2.5, 4.5),
      action: null, actionUntil: 0, casting: false, aim: null, blinkAt: 0, blinkUntil: 0,
    };

    // ponto da arte → tela, passando pelas transformações da camada
    const pt = svg.createSVGPoint();
    function toClient(node, x, y) {
      pt.x = x; pt.y = y;
      const p = pt.matrixTransform(node.getScreenCTM());
      return { x: p.x, y: p.y };
    }

    function targets(t) {
      // parado: respira, balança de leve e mexe o cetro
      const T = {
        hop: 0, sway: Math.sin(t * 0.5) * 0.7,
        head: Math.sin(t * 0.6) * 1.8 + Math.sin(t * 1.4) * 0.6, headY: 0,
        arm: Math.sin(t * 1.1) * 3.5, glow: 0.25 + Math.sin(t * 2.2) * 0.1,
      };
      const a = st.action;
      if (st.casting) {
        // aponta o cetro para a bola
        T.arm = -20;
        if (st.aim) {
          const s = toClient(root, SHOULDER[0], SHOULDER[1]);
          const deg = (Math.atan2(st.aim.y - s.y, st.aim.x - s.x) * 180) / Math.PI;
          T.arm = Math.max(-30, Math.min(30, deg - ARM_ANGLE));
        }
        T.glow = 1; T.head = 2.5; T.sway = -0.8;
      } else if (a === 'cheer') {
        T.hop = reduce ? 0 : Math.abs(Math.sin(t * 12)) * 46;
        T.arm = -30; T.head = -3; T.glow = 0.8;
      } else if (a === 'party') {
        const b = t * 8;
        T.hop = reduce ? 0 : Math.abs(Math.sin(b)) * 52;
        T.sway = Math.sin(t * 4) * 4;
        T.arm = -12 + Math.sin(b) * 16; T.head = Math.sin(b) * 4; T.glow = 0.9;
      } else if (a === 'scepter') {
        // ergue o cetro e balança a estrela
        T.arm = -24 + Math.sin(t * 9) * 4; T.glow = 0.8; T.head = -1.5;
      } else if (a === 'laugh') {
        T.hop = reduce ? 0 : Math.abs(Math.sin(t * 16)) * 10;
        T.head = -3.5 + Math.sin(t * 16) * 1; T.headY = -4;
      } else if (a === 'nod') {
        T.headY = Math.max(0, Math.sin(t * 7)) * 8; T.head = 1.5;
      }
      return T;
    }

    function think(t) {
      if (st.action && t > st.actionUntil) st.action = null;
      if (!st.casting && !st.action && t > st.nextAt && !reduce) {
        const g = pick(['scepter', 'laugh', 'nod', 'scepter']);
        st.action = g;
        st.actionUntil = t + (g === 'laugh' ? 1.3 : g === 'nod' ? 1.1 : 1.6);
        st.nextAt = st.actionUntil + rnd(3, 6);
      }
      if (t > st.blinkAt) { st.blinkUntil = t + 0.13; st.blinkAt = t + rnd(2.2, 5); }
    }

    function apply(t, dt) {
      const T = targets(t);
      const k = st.casting ? 18 : st.action ? 12 : 7;
      for (const key of KEYS) C[key] = damp(C[key], T[key], key === 'hop' ? 22 : k, dt);
      const br = reduce ? 0 : Math.sin(t * 1.7) * 0.008;
      root.setAttribute('transform',
        `translate(0 ${(-C.hop).toFixed(2)}) rotate(${C.sway.toFixed(3)} ${FEET[0]} ${FEET[1]}) ` +
        `translate(${FEET[0]} ${FEET[1]}) scale(${(1 - br * 0.5).toFixed(4)} ${(1 + br).toFixed(4)}) translate(${-FEET[0]} ${-FEET[1]})`);
      head.setAttribute('transform', `translate(0 ${C.headY.toFixed(2)}) rotate(${C.head.toFixed(3)} ${NECK[0]} ${NECK[1]})`);
      arm.setAttribute('transform', `rotate(${C.arm.toFixed(3)} ${SHOULDER[0]} ${SHOULDER[1]})`);
      glow.setAttribute('opacity', Math.max(0, Math.min(1, C.glow)).toFixed(3));
      glow.setAttribute('r', (80 + C.glow * 60 + Math.sin(t * 5) * 6).toFixed(1));
      shadow.setAttribute('rx', (270 - C.hop * 1.4).toFixed(1));
      // piscar: a pálpebra desce de cima
      const closing = t < st.blinkUntil;
      lids.forEach(l => {
        l.style.display = closing ? '' : 'none';
        if (closing) {
          const cx = +l.dataset.cx, top = +l.dataset.top;
          const s = Math.sin(((st.blinkUntil - t) / 0.13) * Math.PI);
          l.setAttribute('transform', `translate(${cx} ${top}) scale(1 ${Math.max(0.05, s).toFixed(3)}) translate(${-cx} ${-top})`);
        }
      });
    }

    let raf = 0, last = performance.now() / 1000;
    function step() {
      const t = performance.now() / 1000;
      let gap = Math.min(1, t - last);
      last = t;
      while (gap > 0) {
        const dt = Math.min(1 / 60, gap);
        gap -= dt;
        think(t - gap);
        apply(t - gap, dt);
      }
    }
    function frame() {
      raf = requestAnimationFrame(frame);
      step();
    }
    apply(last, 0.016);
    frame();

    return {
      // 'cheer' (comemora), 'party' (dança), 'scepter', 'laugh', 'nod'
      pose(name, ms = 900) {
        const t = performance.now() / 1000;
        st.action = name;
        st.actionUntil = t + ms / 1000;
        st.nextAt = Math.max(st.nextAt, st.actionUntil + rnd(2, 4));
      },
      // liga/desliga o cetro apontado; point = alvo em coordenadas da tela
      cast(on, point) {
        st.casting = !!on;
        st.aim = on ? point || null : null;
        if (!on) st.nextAt = performance.now() / 1000 + rnd(2, 4);
      },
      // estrela do cetro em coordenadas da tela (de onde sai o raio)
      tip() {
        step();
        return toClient(arm, STAR[0], STAR[1]);
      },
      destroy() { cancelAnimationFrame(raf); svg.remove(); },
    };
  }

  window.Rei2D = { mount };
})();
