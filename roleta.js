/* ==========================================================
   Casino Fest · Roleta Europeia (um zero só)
   Número cheio paga 35:1 · dúzias e colunas 2:1 ·
   vermelho/preto, par/ímpar e 1-18/19-36 pagam 1:1.
   As fichas são as da carteira única do cassino (casino.js).
   ========================================================== */
(() => {
  'use strict';

  const { fmt, $, toast, confetti, wallet, chipSvg, showBanner, sfx } = window.Casino;

  /* ---------------------------------------------------------
     Constantes
  --------------------------------------------------------- */
  // ordem real dos números na roda europeia, a partir do zero
  const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const STEP = 360 / WHEEL.length;
  const CHIPS = [1, 5, 10, 25, 100, 500];
  const CHIP_COLORS = [1000, 500, 250, 100, 50, 25, 10, 5, 1];
  const MAX_STRAIGHT = 200;
  const MAX_OUTSIDE = 1000;
  const SPIN_MS = 5600;
  const SAVE_KEY = 'casinofest:roleta:v1';

  const colorOf = n => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');
  const colorName = n => ({ green: 'Verde', red: 'Vermelho', black: 'Preto' }[colorOf(n)]);

  /* Apostas de fora: quais números cobrem e quanto pagam (x a aposta, além dela) */
  const OUTSIDE = {
    low:   { label: '1 a 18', pays: 1, test: n => n >= 1 && n <= 18 },
    high:  { label: '19 a 36', pays: 1, test: n => n >= 19 },
    even:  { label: 'Par', pays: 1, test: n => n > 0 && n % 2 === 0 },
    odd:   { label: 'Ímpar', pays: 1, test: n => n % 2 === 1 },
    red:   { label: 'Vermelho', pays: 1, test: n => REDS.has(n) },
    black: { label: 'Preto', pays: 1, test: n => n > 0 && !REDS.has(n) },
    d1:    { label: '1ª dúzia', pays: 2, test: n => n >= 1 && n <= 12 },
    d2:    { label: '2ª dúzia', pays: 2, test: n => n >= 13 && n <= 24 },
    d3:    { label: '3ª dúzia', pays: 2, test: n => n >= 25 },
    c1:    { label: '1ª coluna', pays: 2, test: n => n > 0 && n % 3 === 1 },
    c2:    { label: '2ª coluna', pays: 2, test: n => n > 0 && n % 3 === 2 },
    c3:    { label: '3ª coluna', pays: 2, test: n => n > 0 && n % 3 === 0 },
  };
  const isNum = k => k[0] === 'n';
  const covers = (k, n) => (isNum(k) ? Number(k.slice(1)) === n : OUTSIDE[k].test(n));
  const paysOf = k => (isNum(k) ? 35 : OUTSIDE[k].pays);
  const labelOf = k => (isNum(k) ? `número ${k.slice(1)}` : OUTSIDE[k].label);
  const limitOf = k => (isNum(k) ? MAX_STRAIGHT : MAX_OUTSIDE);

  let R = null;              // estado da mesa
  const el = {};
  let spinning = false;
  let selected = 10;         // ficha escolhida na bandeja
  let wheel3d = null;        // roda em 3D, quando o roleta3d.js carrega

  /* ---------------------------------------------------------
     Estado, histórico e salvamento
  --------------------------------------------------------- */
  const fresh = () => ({
    v: 1, phase: 'bet', bets: {}, undo: [], lastBets: {}, history: [],
    round: 0, net: 0, wheelAngle: 0, ballAngle: 0, result: null, outcome: null,
    banner: null, bannerLose: false, logs: [],
  });
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(R)); } catch (e) { /* sem armazenamento */ }
  }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s || s.v !== 1 || typeof s.bets !== 'object' || !Array.isArray(s.history)) return null;
      return s;
    } catch (e) { return null; }
  }
  function log(msg, cls = '') {
    R.logs.push([msg, cls]);
    if (R.logs.length > 80) R.logs.splice(0, R.logs.length - 80);
    appendLog(msg, cls);
  }
  function appendLog(msg, cls) {
    const li = document.createElement('li');
    if (cls) li.className = cls;
    li.textContent = msg;
    el.log.appendChild(li);
    while (el.log.children.length > 80) el.log.removeChild(el.log.firstChild);
    el.log.scrollTop = el.log.scrollHeight;
  }

  const staked = (bets = R.bets) => Object.values(bets).reduce((s, v) => s + v, 0);

  /* ---------------------------------------------------------
     Roda (SVG)
  --------------------------------------------------------- */
  const C = 160;
  const polar = (r, a) => [C + r * Math.sin(a * Math.PI / 180), C - r * Math.cos(a * Math.PI / 180)];
  function wedge(r0, r1, a0, a1) {
    const [x0, y0] = polar(r1, a0), [x1, y1] = polar(r1, a1), [x2, y2] = polar(r0, a1), [x3, y3] = polar(r0, a0);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r1} ${r1} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r0} ${r0} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
  }
  const FILL = { red: '#d01f36', black: '#18161c', green: '#12a87c' };
  const POCKET = { red: '#7a0f20', black: '#0a0a0c', green: '#086b4e' };
  const R_TRACK = 139, R_POCKET = 97;

  function buildWheel() {
    let numbers = '', pockets = '', seps = '';
    WHEEL.forEach((n, i) => {
      const a0 = i * STEP - STEP / 2, a1 = a0 + STEP, c = colorOf(n);
      numbers += `<path d="${wedge(106, 128, a0, a1)}" fill="${FILL[c]}"/>`;
      pockets += `<path d="${wedge(88, 106, a0, a1)}" fill="${POCKET[c]}"/>`;
      const [sx0, sy0] = polar(88, a0), [sx1, sy1] = polar(128, a0);
      seps += `<line x1="${sx0.toFixed(2)}" y1="${sy0.toFixed(2)}" x2="${sx1.toFixed(2)}" y2="${sy1.toFixed(2)}"/>`;
      numbers += `<text class="num-text" text-anchor="middle" transform="rotate(${i * STEP} ${C} ${C})" x="${C}" y="${C - 113.5}">${n}</text>`;
    });
    // losangos decorativos na pista da bolinha
    let diamonds = '';
    for (let k = 0; k < 8; k++) {
      const [x, y] = polar(146, k * 45 + 22.5);
      diamonds += `<rect x="${(x - 3.2).toFixed(2)}" y="${(y - 3.2).toFixed(2)}" width="6.4" height="6.4" rx="1" transform="rotate(${k * 45 + 22.5 + 45} ${x.toFixed(2)} ${y.toFixed(2)})" fill="url(#rl-gold)"/>`;
    }
    el.wheel.innerHTML = `
      <svg viewBox="0 0 320 320" aria-label="Roda da roleta">
        <defs>
          <radialGradient id="rl-rim" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#7a3d1c"/><stop offset=".7" stop-color="#4a2210"/><stop offset="1" stop-color="#2a1208"/></radialGradient>
          <radialGradient id="rl-track" cx=".5" cy=".5" r=".5"><stop offset=".8" stop-color="#140a05"/><stop offset="1" stop-color="#3a1d0c"/></radialGradient>
          <radialGradient id="rl-cone" cx=".45" cy=".38" r=".7"><stop offset="0" stop-color="#a0683a"/><stop offset=".6" stop-color="#6b3a1c"/><stop offset="1" stop-color="#3a1d0c"/></radialGradient>
          <linearGradient id="rl-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a6"/><stop offset=".5" stop-color="#ffc928"/><stop offset="1" stop-color="#d98200"/></linearGradient>
          <radialGradient id="rl-ball" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#e7e4ef"/><stop offset="1" stop-color="#9c97b0"/></radialGradient>
        </defs>
        <circle cx="160" cy="160" r="158" fill="url(#rl-rim)" stroke="url(#rl-gold)" stroke-width="3"/>
        <circle cx="160" cy="160" r="150" fill="url(#rl-track)" stroke="rgba(255,201,64,.35)" stroke-width="1"/>
        ${diamonds}
        <g id="rl-rotor">
          <circle cx="160" cy="160" r="129.5" fill="none" stroke="url(#rl-gold)" stroke-width="3"/>
          ${numbers}${pockets}
          <g stroke="url(#rl-gold)" stroke-width="1.3">${seps}</g>
          <circle cx="160" cy="160" r="88" fill="url(#rl-cone)" stroke="url(#rl-gold)" stroke-width="2.5"/>
          <circle cx="160" cy="160" r="62" fill="none" stroke="rgba(255,201,64,.35)" stroke-width="1"/>
          <g fill="url(#rl-gold)">
            ${[0, 90, 180, 270].map(a => `<path transform="rotate(${a} 160 160)" d="M160 100l6 34h-12z"/>`).join('')}
          </g>
          <circle cx="160" cy="160" r="22" fill="url(#rl-gold)" stroke="#7a3d00" stroke-width="1.5"/>
          <use href="#crown" x="145" y="149" width="30" height="20"/>
        </g>
        <circle id="rl-ball-dot" r="6" fill="url(#rl-ball)" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>
      </svg>`;
    el.rotor = $('#rl-rotor', el.wheel);
    el.ball = $('#rl-ball-dot', el.wheel);
  }

  function setWheel(wheelAngle, ballAngle, ballR) {
    el.rotor.setAttribute('transform', `rotate(${wheelAngle % 360} ${C} ${C})`);
    const [x, y] = polar(ballR, ballAngle);
    el.ball.setAttribute('cx', x.toFixed(2));
    el.ball.setAttribute('cy', y.toFixed(2));
    if (wheel3d) wheel3d.set(wheelAngle, ballAngle, ballR);
  }

  // troca a roda 2D pela 3D assim que ela estiver pronta
  function mount3d() {
    if (wheel3d || !window.RoletaWheel3D || !el.wheel3d) return;
    wheel3d = window.RoletaWheel3D.mount(el.wheel3d);
    if (!wheel3d) return;
    el.wheel.parentElement.classList.add('is-3d');
    restWheel();
  }
  // posição final: a bolinha parada dentro da casa do número sorteado
  function restWheel() {
    const r = R.result;
    const ball = r === null ? R.ballAngle : R.wheelAngle + WHEEL.indexOf(r) * STEP;
    setWheel(R.wheelAngle, ball, r === null ? R_TRACK : R_POCKET);
  }

  const easeOut = t => 1 - Math.pow(1 - t, 3);
  function bounce(t) {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  }

  // gira a roda num sentido e a bolinha no outro, até cair na casa do resultado.
  // Cada giro sorteia voltas, ritmo, momento da queda e os pulos entre as casas,
  // para nunca parecer o mesmo movimento (o resultado já está decidido antes).
  function animateSpin(fromWheel, toWheel, fromBall, result, duration) {
    return new Promise(resolve => {
      const laps = 4 + Math.floor(Math.random() * 4);                 // 4 a 7 voltas da bolinha
      const target = toWheel + WHEEL.indexOf(result) * STEP;
      const base = fromBall - 360 * laps;
      const toBall = base - ((((base - target) % 360) + 360) % 360);
      const ballPow = 3 + Math.random() * 1.6;                         // como a bolinha perde velocidade
      const dropAt = 0.56 + Math.random() * 0.16;                      // quando ela sai da pista
      const hop = (Math.random() < 0.5 ? -1 : 1) * STEP * (0.8 + Math.random() * 2.6);   // pula casas antes de assentar
      const hops = 1.2 + Math.random() * 2.2;
      const rattle = 1 + Math.random() * 3;                            // trepidação na pista
      const t0 = performance.now();
      const frame = now => {
        const t = Math.min(1, (now - t0) / duration);
        const w = fromWheel + (toWheel - fromWheel) * easeOut(t);
        let b = fromBall + (toBall - fromBall) * (1 - Math.pow(1 - t, ballPow));
        let r;
        if (t < dropAt) {
          r = R_TRACK - rattle * Math.abs(Math.sin(t * 46)) * (t / dropAt);
        } else {
          const u = (t - dropAt) / (1 - dropAt);
          r = R_TRACK + (R_POCKET - R_TRACK) * bounce(Math.min(1, u * 1.2));
          b += hop * Math.sin(Math.PI * hops * u) * (1 - u) * (1 - u);
        }
        setWheel(w, b, r);
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  /* ---------------------------------------------------------
     Pano de apostas
  --------------------------------------------------------- */
  // cada casa tem posição no pano horizontal (--gr/--gc) e no vertical do celular (--mr/--mc)
  function buildBoard() {
    const cells = [];
    const add = (key, cls, html, gr, gc, mr, mc) =>
      cells.push(`<div class="spot ${cls}" data-key="${key}" style="--gr:${gr};--gc:${gc};--mr:${mr};--mc:${mc}" role="button" tabindex="-1" aria-label="${labelOf(key)}">${html}</div>`);

    add('n0', 'num green', '<span>0</span>', '1 / 4', '1', '1', '2 / 5');
    for (let n = 1; n <= 36; n++) {
      const col = Math.floor((n - 1) / 3), row = (n - 1) % 3;
      add(`n${n}`, `num ${colorOf(n)}`, `<span>${n}</span>`, String(3 - row), String(2 + col), String(2 + col), String(2 + row));
    }
    ['c3', 'c2', 'c1'].forEach((k, i) => add(k, 'out col', '<span>2:1</span>', String(1 + i), '14', '14', String(4 - i)));
    ['d1', 'd2', 'd3'].forEach((k, i) => add(k, 'out vert', `<span>${i + 1}ª 12</span>`, '4', `${2 + i * 4} / ${6 + i * 4}`, `${2 + i * 4} / ${6 + i * 4}`, '1'));
    const outs = [
      ['low', '<span>1–18</span>'], ['even', '<span>Par</span>'], ['red', '<i class="diamond red"></i>'],
      ['black', '<i class="diamond black"></i>'], ['odd', '<span>Ímpar</span>'], ['high', '<span>19–36</span>'],
    ];
    outs.forEach(([k, html], i) => add(k, 'out vert', html, '5', `${2 + i * 2} / ${4 + i * 2}`, `${2 + i * 2} / ${4 + i * 2}`, '5'));
    el.board.innerHTML = cells.join('');
    el.spots = new Map([...el.board.querySelectorAll('.spot')].map(s => [s.dataset.key, s]));

    el.board.addEventListener('click', e => {
      const s = e.target.closest('.spot');
      if (s) placeBet(s.dataset.key);
    });
    el.board.addEventListener('contextmenu', e => {
      const s = e.target.closest('.spot');
      if (!s) return;
      e.preventDefault();
      removeSpot(s.dataset.key);
    });
    // passar o mouse numa aposta de fora acende os números que ela cobre
    el.board.addEventListener('mouseover', e => {
      const s = e.target.closest('.spot');
      highlightCover(s && !isNum(s.dataset.key) ? s.dataset.key : null);
    });
    el.board.addEventListener('mouseleave', () => highlightCover(null));
  }
  function highlightCover(key) {
    el.spots.forEach((s, k) => s.classList.toggle('cover', !!key && isNum(k) && covers(key, Number(k.slice(1)))));
  }

  function chipHtml(amount) {
    const v = CHIP_COLORS.find(c => c <= amount) || 1;
    const txt = amount >= 1000 ? `${Math.round(amount / 100) / 10}k`.replace('.', ',') : amount;
    return `<span class="spot-chip">${chipSvg(v)}<b>${txt}</b></span>`;
  }

  /* ---------------------------------------------------------
     Apostas
  --------------------------------------------------------- */
  // depois de um giro, a primeira ficha começa uma aposta nova
  function startNewBet() {
    if (R.phase !== 'result') return;
    R.phase = 'bet';
    R.bets = {};
    R.undo = [];
    R.banner = null;
  }

  function placeBet(key) {
    if (spinning) return;
    startNewBet();
    const cur = R.bets[key] || 0;
    const room = limitOf(key) - cur;
    if (room <= 0) return toast(`Limite de ${fmt(limitOf(key))} nesta casa.`);
    const free = wallet.balance - staked();
    if (free <= 0) return toast('Fichas insuficientes. Use o + no topo para recarregar.');
    const amt = Math.min(selected, room, free);
    R.bets[key] = cur + amt;
    R.undo.push([key, amt]);
    if (amt < selected) toast(amt === room ? `Limite de ${fmt(limitOf(key))} nesta casa.` : 'Apostei o que restava das suas fichas.');
    commit();
  }
  function removeSpot(key) {
    if (spinning || R.phase !== 'bet' || !R.bets[key]) return;
    delete R.bets[key];
    R.undo = R.undo.filter(([k]) => k !== key);
    commit();
  }
  function undo() {
    if (spinning || R.phase !== 'bet' || !R.undo.length) return;
    const [key, amt] = R.undo.pop();
    R.bets[key] -= amt;
    if (R.bets[key] <= 0) delete R.bets[key];
    commit();
  }
  function clearBets() {
    if (spinning) return;
    startNewBet();
    R.bets = {};
    R.undo = [];
    commit();
  }
  function doubleBets() {
    if (spinning || R.phase !== 'bet' || !staked()) return;
    const next = {};
    for (const [k, v] of Object.entries(R.bets)) next[k] = Math.min(limitOf(k), v * 2);
    if (staked(next) > wallet.balance) return toast('Fichas insuficientes para dobrar a aposta.');
    for (const [k, v] of Object.entries(next)) if (v > R.bets[k]) R.undo.push([k, v - R.bets[k]]);
    R.bets = next;
    commit();
  }
  function repeatBets() {
    if (spinning || !Object.keys(R.lastBets).length) return;
    if (staked(R.lastBets) > wallet.balance) return toast('Fichas insuficientes para repetir a última aposta.');
    startNewBet();
    R.bets = { ...R.lastBets };
    R.undo = Object.entries(R.bets);
    commit();
  }

  /* ---------------------------------------------------------
     Giro e pagamento
  --------------------------------------------------------- */
  function randomNumber() {
    const a = new Uint32Array(1);
    let x;
    do { crypto.getRandomValues(a); x = a[0]; } while (x >= 4294967296 - (4294967296 % 37)); // sem viés
    return x % 37;
  }

  async function spin() {
    if (spinning) return;
    if (R.phase === 'result' && Object.keys(R.lastBets).length) repeatBets();
    if (R.phase !== 'bet') return;
    const total = staked();
    if (!total) return toast('Escolha uma ficha e clique no pano para apostar.');
    if (total > wallet.balance) return toast('Você não tem fichas suficientes para essa aposta.');

    // resultado e pagamento são decididos e salvos antes da animação
    const result = randomNumber();
    const fromWheel = R.wheelAngle, fromBall = R.ballAngle;
    const toWheel = fromWheel + 360 * (1.5 + Math.random() * 1.5);
    wallet.add(-total);

    let win = 0;
    const winners = [];
    for (const [k, v] of Object.entries(R.bets)) {
      if (covers(k, result)) { win += v * (paysOf(k) + 1); winners.push(k); }
    }
    const net = win - total;
    R.round++;
    R.lastBets = { ...R.bets };
    R.result = result;
    R.outcome = { winners, win, net, total };
    R.history.unshift(result);
    R.history = R.history.slice(0, 18);
    R.net += net;
    R.wheelAngle = toWheel % 360;
    R.ballAngle = (toWheel + WHEEL.indexOf(result) * STEP) % 360;
    R.phase = 'result';
    R.banner = makeBanner(result, net, win);
    R.bannerLose = net < 0;
    save();

    log(`── Rodada ${R.round} · ${fmt(total)} na mesa ──`, 'sep');
    spinning = true;
    sfx.play('spin');
    render();
    // no celular a roda fica acima do pano: leva a tela até ela para ver o giro
    const r = el.wheel.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.wheel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1200 : Math.round(SPIN_MS * (0.85 + Math.random() * 0.3));
    if (win > 0) wallet.add(win, { delay: duration });
    await animateSpin(fromWheel, toWheel, fromBall, result, duration);
    spinning = false;

    log(`Deu ${result} ${colorName(result)}.`);
    if (winners.length) log(`Acertou: ${winners.map(labelOf).join(', ')}. Recebeu ${fmt(win)}.`, 'win');
    log(net > 0 ? `Você ganhou ${fmt(net)} nesta rodada.` : net < 0 ? `Você perdeu ${fmt(-net)} nesta rodada.` : 'Empate: recuperou o que apostou.', net > 0 ? 'win' : '');
    save();
    render();
    if (net > 0) confetti(win >= total * 10 ? 240 : 130, el.wheel);
  }

  function makeBanner(n, net, win) {
    const kicker = `Deu ${n} · ${colorName(n)}`;
    if (net > 0) return { kicker, title: R.outcome.winners.some(isNum) ? 'Na mosca!' : 'Você ganhou!', amount: '+' + fmt(net) };
    if (net === 0) return { kicker, title: 'Empate', amount: '' };
    return { kicker, title: 'Não foi dessa vez', amount: '−' + fmt(-net) };
  }

  /* ---------------------------------------------------------
     Renderização
  --------------------------------------------------------- */
  function render() {
    const total = staked();
    const showing = R.phase === 'result' && !spinning;

    // fichas no pano + destaque do número sorteado
    el.spots.forEach((s, k) => {
      const v = R.bets[k] || 0;
      const key = String(v);
      if (s.dataset.v !== key) {
        s.dataset.v = key;
        const old = $('.spot-chip', s);
        if (old) old.remove();
        if (v) s.insertAdjacentHTML('beforeend', chipHtml(v));
      }
      const won = showing && R.outcome && R.outcome.winners.includes(k);
      s.classList.toggle('win', showing && k === `n${R.result}`);
      s.classList.toggle('won', !!won);
      s.classList.toggle('lost', showing && v > 0 && !won);
    });
    el.board.classList.toggle('board-locked', spinning);

    // resultado no meio da roda
    el.resultBadge.hidden = !showing || R.result === null;
    if (showing && R.result !== null) {
      el.resultBadge.textContent = R.result;
      el.resultBadge.className = `rl-result ${colorOf(R.result)}`;
    }
    showBanner(el.banner, showing ? R.banner : null, R.bannerLose);

    // últimos números (o mais novo à esquerda)
    const hist = spinning ? R.history.slice(1) : R.history;
    el.history.innerHTML = hist.length
      ? hist.map(n => `<span class="hnum ${colorOf(n)}">${n}</span>`).join('')
      : '<span class="rl-history-empty">Nenhum giro ainda</span>';

    // barra da mesa
    el.round.textContent = R.round;
    el.staked.textContent = fmt(R.phase === 'bet' ? total : 0);
    el.net.textContent = (R.net > 0 ? '+' : R.net < 0 ? '−' : '') + fmt(Math.abs(R.net));
    el.net.style.color = R.net > 0 ? 'var(--teal)' : R.net < 0 ? '#ff8fab' : '';
    const last = spinning ? R.history[1] : R.history[0];
    el.last.textContent = last === undefined ? '–' : last;
    el.last.style.color = last === undefined ? '' : { red: '#ff6b7b', black: '#c9c2ea', green: 'var(--teal)' }[colorOf(last)];

    renderControls();
  }

  function renderControls() {
    const total = R.phase === 'bet' ? staked() : 0;
    const hasLast = Object.keys(R.lastBets).length > 0;
    el.trayChips.forEach(b => {
      const v = Number(b.dataset.v);
      b.classList.toggle('selected', v === selected);
      b.setAttribute('aria-checked', v === selected ? 'true' : 'false');
      b.disabled = spinning;
    });
    el.btnUndo.disabled = spinning || R.phase !== 'bet' || !R.undo.length;
    el.btnClear.disabled = spinning || !total;
    el.btnDouble.disabled = spinning || !total;
    el.btnRepeat.disabled = spinning || !hasLast;
    const repeatTotal = staked(R.lastBets);
    el.btnSpin.disabled = spinning || (!total && !(R.phase === 'result' && hasLast && repeatTotal <= wallet.balance));
    el.spinLabel.textContent = spinning ? 'Girando…'
      : total ? `Girar · ${fmt(total)}`
      : R.phase === 'result' && hasLast ? `Repetir e girar · ${fmt(repeatTotal)}` : 'Girar';
    el.controls.classList.toggle('disabled', spinning);

    el.status.textContent = spinning ? 'Rien ne va plus… a bolinha está rodando!'
      : wallet.balance < 1 && !total ? 'Sem fichas: use o + no topo para recarregar'
      : R.phase === 'result' ? 'Clique no pano para uma nova aposta, ou repita a última'
      : total ? 'Tudo pronto? Gire a roleta' : 'Escolha uma ficha e clique no pano para apostar';
    el.status.classList.toggle('mine', !spinning && R.phase === 'bet' && total > 0);
  }

  function commit() {
    save();
    render();
  }

  /* ---------------------------------------------------------
     Início e interação
  --------------------------------------------------------- */
  function buildTray() {
    el.chipTray.innerHTML = CHIPS.map(v =>
      `<button type="button" class="tray-chip c${v}" data-v="${v}" role="radio" aria-label="Ficha de ${fmt(v)}">${chipSvg(v)}<b>${v}</b></button>`).join('');
    el.trayChips = [...el.chipTray.querySelectorAll('.tray-chip')];
    el.trayChips.forEach(b => b.addEventListener('click', () => { selected = Number(b.dataset.v); renderControls(); }));
  }

  function init() {
    Object.assign(el, {
      wheel: $('#wheel'), wheel3d: $('#wheel3d'), resultBadge: $('#result-badge'), banner: $('#banner'),
      history: $('#history'), board: $('#board'), chipTray: $('#chip-tray'),
      btnUndo: $('#btn-undo'), btnClear: $('#btn-clear'), btnDouble: $('#btn-double'),
      btnRepeat: $('#btn-repeat'), btnSpin: $('#btn-spin'), spinLabel: $('#spin-label'),
      controls: $('#controls'), status: $('#status'), log: $('#log'),
      round: $('#info-round'), staked: $('#info-staked'), net: $('#info-net'), last: $('#info-last'),
    });

    const saved = loadSave();
    R = saved || fresh();
    R.logs.forEach(([m, c]) => appendLog(m, c));
    if (!saved) log('Mesa aberta! Escolha uma ficha, clique no pano e gire. Boa sorte!', 'sep');

    buildWheel();
    buildBoard();
    buildTray();
    restWheel();
    mount3d();
    document.addEventListener('roleta3d-ready', mount3d);

    el.btnUndo.addEventListener('click', undo);
    el.btnClear.addEventListener('click', clearBets);
    el.btnDouble.addEventListener('click', doubleBets);
    el.btnRepeat.addEventListener('click', repeatBets);
    el.btnSpin.addEventListener('click', spin);

    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const onControl = e.target.closest && e.target.closest('button, input');
      if ((e.key === 'Enter' || e.key === ' ') && !onControl) { e.preventDefault(); spin(); }
      else if (e.key === 'Backspace') undo();
      else if (/^[1-6]$/.test(e.key)) { selected = CHIPS[Number(e.key) - 1]; renderControls(); }
    });

    // recarga só fora do giro; o saldo novo libera as apostas
    wallet.setRefillGuard(() => (spinning ? 'Espere a bolinha parar para recarregar.' : null));
    wallet.onChange(() => renderControls());

    save();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
