/* ==========================================================
   Casino Fest · Rei da Fortuna — tela, rolos e bônus
   A matemática fica em fortuna-math.js; o rei animado em rei.js.
   As fichas são as da carteira única do cassino (casino.js).
   ========================================================== */
(() => {
  'use strict';

  const { fmt, $, toast, confetti, wallet, auto, sfx } = window.Casino;
  const F = window.FortunaMath;

  const BETS = [5, 10, 20, 50, 100, 200, 500];   // múltiplos de 5: cada linha vale um valor inteiro
  const SAVE_KEY = 'casinofest:fortuna:v1';
  const NAMES = { wild: 'Rei', bars: 'Barras de ouro', bag: 'Saco de moedas', ring: 'Anel de esmeralda', coin: 'Moeda da coroa', cash: 'Maço de notas', chip: 'Ficha' };
  const LINE_COLORS = ['#ffc940', '#ff4d6d', '#19d3a2', '#7b9bff', '#ff8a2a'];
  const LINE_NAMES = ['meio', 'cima', 'baixo', 'diagonal ↘', 'diagonal ↗'];
  const img = s => `fortuna/${s}.webp`;
  const TEASE_CHANCE = 1 / 14;        // ameaça de bônus que não vem (só visual, não muda o retorno)
  const TEASE_LINES = ['O Rei está de olho…', 'Sinto cheiro de fortuna…', 'Será que vem?', 'A coroa está brilhando…'];
  const TIERS = [[50, 'Super mega prêmio!'], [25, 'Mega prêmio!'], [10, 'Grande prêmio!']];
  const HIGH = new Set(['wild', 'bars', 'bag']);

  /* ---------------------------------------------------------
     Estado e salvamento
  --------------------------------------------------------- */
  let S = null, king = null;
  const el = {};
  let busy = false, autoLeft = 0;
  let cells = [];   // cells[r][c] → elemento da casa visível

  const fresh = () => ({ v: 1, bet: 5, turbo: false, spins: 0, net: 0, best: 0, logs: [] });
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* sem armazenamento */ } }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s || s.v !== 1) return null;
      if (!BETS.includes(s.bet)) s.bet = BETS[0];
      return s;
    } catch (e) { return null; }
  }
  function log(msg, cls = '') {
    S.logs.push([msg, cls]);
    if (S.logs.length > 80) S.logs.splice(0, S.logs.length - 80);
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

  // aleatório criptográfico em [0, 1)
  function rand() {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53;
  }
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const turbo = () => S.turbo || reduceMotion();
  const sleep = ms => new Promise(r => setTimeout(r, turbo() ? ms * 0.45 : ms));
  const randomSym = () => {
    const list = Object.entries(F.WEIGHTS), total = list.reduce((s, [, w]) => s + w, 0);
    let x = rand() * total;
    for (const [k, w] of list) { if ((x -= w) < 0) return k; }
    return 'chip';
  };

  /* ---------------------------------------------------------
     Rolos: cada coluna é uma tira que desce até o resultado
  --------------------------------------------------------- */
  function cellEl(sym) {
    const d = document.createElement('div');
    d.className = 'rf-cell';
    d.innerHTML = '<img alt="" draggable="false">';
    setCell(d, sym);
    return d;
  }
  function setCell(d, sym) {
    d.dataset.s = sym || '';
    d.classList.toggle('empty', !sym);
    const im = d.firstChild;
    if (sym) { im.src = img(sym); im.alt = NAMES[sym]; }
  }
  function fillColumn(col, syms) {
    const strip = col.firstChild;
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    strip.style.height = '100%';
    strip.replaceChildren(...syms.map(s => {
      const c = cellEl(s);
      c.style.height = `${100 / 3}%`;
      return c;
    }));
  }
  function buildReels(grid) {
    el.reels.replaceChildren();
    for (let c = 0; c < F.COLS; c++) {
      const col = document.createElement('div');
      col.className = 'rf-col';
      const strip = document.createElement('div');
      strip.className = 'rf-strip';
      col.appendChild(strip);
      el.reels.appendChild(col);
      fillColumn(col, [grid[0][c], grid[1][c], grid[2][c]]);
    }
    refreshCells();
  }
  function refreshCells() {
    cells = [[], [], []];
    [...el.reels.children].forEach((col, c) => {
      [...col.firstChild.children].forEach((d, r) => { cells[r][c] = d; });
    });
  }
  const currentGrid = () => cells.map(row => row.map(d => d.dataset.s || null));

  // os dois primeiros rolos já prometem um prêmio alto numa linha?
  function promising(grid) {
    return F.LINES.some(line => {
      const a = grid[line[0][0]][line[0][1]], b = grid[line[1][0]][line[1][1]];
      if (a === 'wild' || b === 'wild') return HIGH.has(a) && HIGH.has(b);
      return a === b && HIGH.has(a);
    });
  }

  // gira as 3 colunas e para uma de cada vez no resultado (o último segura o suspense)
  function spinTo(grid, tense = false) {
    const old = currentGrid();
    const tasks = [...el.reels.children].map((col, c) => new Promise(done => {
      const extra = 10 + c * 4;
      const syms = [grid[0][c], grid[1][c], grid[2][c]];
      for (let i = 0; i < extra; i++) syms.push(randomSym());
      syms.push(old[0][c] || randomSym(), old[1][c] || randomSym(), old[2][c] || randomSym());
      const n = syms.length;
      const strip = col.firstChild;
      strip.style.transition = 'none';
      strip.style.height = `${(n / 3) * 100}%`;
      strip.replaceChildren(...syms.map(s => { const d = cellEl(s); d.style.height = `${100 / n}%`; return d; }));
      strip.style.transform = `translateY(${(-(n - 3) / n) * 100}%)`;
      void strip.offsetHeight;
      const hold = tense && c === F.COLS - 1;
      const dur = (turbo() ? 380 : 820) + c * (turbo() ? 110 : 240) + (hold ? (turbo() ? 600 : 1500) : 0);
      col.classList.toggle('tense', hold);
      strip.classList.add('spinning');
      strip.style.transition = `transform ${dur}ms cubic-bezier(.25, .75, .3, 1.06)`;
      strip.style.transform = 'translateY(0)';
      setTimeout(() => {
        strip.classList.remove('spinning');
        col.classList.remove('tense');
        fillColumn(col, [grid[0][c], grid[1][c], grid[2][c]]);
        done();
      }, dur + 30);
    }));
    return Promise.all(tasks).then(refreshCells);
  }

  /* ---------------------------------------------------------
     Linhas premiadas
  --------------------------------------------------------- */
  function clearWins() {
    el.lines.replaceChildren();
    el.reels.classList.remove('dim');
    cells.flat().forEach(d => d.classList.remove('win'));
  }
  function showWins(wins) {
    if (!wins.length) return;
    el.reels.classList.add('dim');
    el.lines.innerHTML = wins.map(w => {
      const pts = F.LINES[w.line].map(([r, c]) => `${c * 100 + 50},${r * 100 + 50}`).join(' ');
      const col = LINE_COLORS[w.line];
      return `<g><polyline class="ln-glow" points="${pts}" stroke="${col}"/><polyline class="ln-core" points="${pts}" stroke="${col}"/><polyline class="ln-hot" points="${pts}"/></g>`;
    }).join('');
    wins.forEach(w => F.LINES[w.line].forEach(([r, c]) => cells[r][c].classList.add('win')));
  }

  /* ---------------------------------------------------------
     O rei e o raio do cetro
  --------------------------------------------------------- */
  const center = node => {
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  function bolt(from, to, color) {
    const box = el.stage.getBoundingClientRect();
    el.fx.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const a = { x: from.x - box.left, y: from.y - box.top }, b = { x: to.x - box.left, y: to.y - box.top };
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    let d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)}`;
    for (let i = 1; i < 8; i++) {
      const t = i / 8, j = (Math.random() - 0.5) * len * 0.13;
      d += `L${(a.x + dx * t + nx * j).toFixed(1)} ${(a.y + dy * t + ny * j).toFixed(1)}`;
    }
    d += `L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.setProperty('--bc', color);
    g.innerHTML = `<path class="bolt bolt-glow" d="${d}"/><path class="bolt bolt-core" d="${d}"/><path class="bolt bolt-hot" d="${d}"/><circle cx="${b.x}" cy="${b.y}" r="16" fill="${color}" opacity=".55"/>`;
    el.fx.appendChild(g);
    setTimeout(() => g.remove(), 700);
  }

  /* ---------------------------------------------------------
     Giro
  --------------------------------------------------------- */
  async function spin() {
    if (busy) return;
    const bet = S.bet;
    if (bet > wallet.balance) {
      stopAuto();
      return toast(wallet.balance < BETS[0] ? 'Sem fichas: use o + no topo para recarregar.' : 'Fichas insuficientes para essa aposta. Diminua o valor.');
    }

    // resultado decidido e salvo antes da animação
    const res = F.playSpin(rand);
    const win = Math.round(res.total * bet);
    S.spins++;
    S.net += win - bet;
    S.best = Math.max(S.best, win);
    wallet.add(-bet);
    save();
    const tease = res.feature || rand() < TEASE_CHANCE;
    const tense = !res.feature && promising(res.grid);
    const est = (tease ? 1700 : 0) + (tense ? 1500 : 0) + (res.feature ? 3200 + res.steps.length * 1300 : 1500);
    if (win > 0) wallet.add(win, { delay: (turbo() ? 0.5 : 1) * est });

    busy = true;
    sfx.play('spin');
    renderAll();
    clearWins();
    setWin('Girando…', '');
    if (tease) await teaser(res.feature);
    if (res.feature) await playFeature(res, bet, win);
    else await playBase(res, bet, win, tense);
    busy = false;
    renderAll();
    after(win, bet);
  }

  // o rei ameaça soltar o bônus: aponta o cetro, a máquina treme e o palco brilha
  async function teaser(real) {
    el.stage.classList.add('teasing');
    setWin(TEASE_LINES[Math.floor(rand() * TEASE_LINES.length)], '');
    king.cast(true, center(el.reels));
    await sleep(1500);
    king.cast(false);
    el.stage.classList.remove('teasing');
    if (!real) { king.pose('nod', 900); setWin('Girando…', ''); }
  }

  async function playBase(res, bet, win, tense) {
    await spinTo(res.grid, tense);
    if (!res.wins.length) { setWin('Não foi dessa vez', ''); return; }
    showWins(res.wins);
    setWin(res.wins.map(w => `${NAMES[w.sym]} · ${LINE_NAMES[w.line]}`).join('  ·  '), `+${fmt(win)}`);
    king.pose('cheer', 900);
    log(`Giro ${S.spins}: ganhou ${fmt(win)} em ${res.wins.length} linha${res.wins.length > 1 ? 's' : ''}.`, 'win');
    await celebrate(win, bet);
  }

  async function playFeature(res, bet, win) {
    // o rei aparece e escolhe o símbolo da vez
    el.stage.classList.add('in-feature');
    king.pose('party', 2200);
    confetti(120, el.stage);
    el.featureSym.src = img(res.sym);
    el.featureTag.hidden = false;
    await new Promise(done => overlay({ kicker: 'Bônus', title: 'Fortuna do Rei!', image: img(res.sym), amount: '', hint: `Só ${NAMES[res.sym]} e o Rei nos rolos até sair prêmio` }, 2400, done));

    // começa com a máquina vazia; o que cair fica preso
    cells.flat().forEach(d => { setCell(d, null); d.classList.remove('locked', 'just'); });
    for (const step of res.steps) {
      const open = cells.flat().filter(d => !d.classList.contains('locked'));
      let flip = 0;
      const roll = () => open.forEach((d, i) => setCell(d, (i + flip) % 3 === 0 ? 'wild' : res.sym));
      open.forEach(d => d.classList.add('rolling'));
      roll();
      const timer = setInterval(() => { flip++; roll(); }, 90);
      await sleep(800);
      clearInterval(timer);
      open.forEach(d => { d.classList.remove('rolling'); setCell(d, null); });
      if (step.fresh.length) {
        king.cast(true, center(cells[step.fresh[0][0]][step.fresh[0][1]]));
        await sleep(240);
      }
      for (const [r, c] of step.fresh) {
        const d = cells[r][c];
        setCell(d, step.grid[r][c]);
        d.classList.add('locked', 'just');
        bolt(king.tip(), center(d), step.grid[r][c] === 'wild' ? '#ff5fa2' : '#ffc940');
        await sleep(120);
      }
      king.cast(false);
      await sleep(380);
      cells.flat().forEach(d => d.classList.remove('just'));
    }

    showWins(res.wins);
    setWin(res.full ? 'Tela cheia! Prêmio x10' : 'Bônus da Fortuna', `+${fmt(win)}`);
    log(`Bônus da Fortuna (${NAMES[res.sym]}): ganhou ${fmt(win)}${res.full ? ' com tela cheia x10' : ''}.`, 'win');
    if (res.full) {
      confetti(240, el.stage);
      await bigWin(win, bet, 'Tela cheia · prêmio x10');
    } else {
      king.pose('cheer', 900);
      await celebrate(win, bet);
    }
    await sleep(500);
    el.stage.classList.remove('in-feature');
    el.featureTag.hidden = true;
    cells.flat().forEach(d => d.classList.remove('locked'));
  }

  async function celebrate(win, bet) {
    const x = win / bet;
    if (x >= 10) await bigWin(win, bet);
    else if (x >= 3) { confetti(70, el.reels); coinRain(10); }
    await sleep(500);
  }
  function bigWin(win, bet, kicker = '') {
    king.pose('party', 3200);
    coinRain(Math.min(60, 18 + Math.floor(win / bet / 2)));
    return new Promise(done => {
      overlay({ kicker, title: 'Grande prêmio!', amount: fmt(0), hint: '0x a aposta' }, 3800, done);
      const dur = turbo() ? 900 : 2200, t0 = performance.now();
      const tick = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        const v = Math.round(win * (1 - (1 - k) ** 3));
        el.ovAmount.textContent = fmt(v);
        el.ovHint.textContent = `${Math.floor(v / bet)}x a aposta`;
        const tier = TIERS.find(([m]) => v >= m * bet);
        if (tier && el.ovTitle.textContent !== tier[1]) {
          el.ovTitle.textContent = tier[1];
          el.ovTitle.classList.remove('bump');
          void el.ovTitle.offsetWidth;
          el.ovTitle.classList.add('bump');
          confetti(90, el.stage);
        }
        if (k >= 1 || el.overlay.hidden) { clearInterval(tick); el.ovAmount.textContent = fmt(win); }
      }, 40);
    });
  }
  function coinRain(n) {
    if (reduceMotion()) return;
    const fall = el.stage.offsetHeight + 80;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('img');
      c.src = img('coin');
      c.alt = '';
      c.className = 'rf-coin';
      c.style.left = `${Math.random() * 94}%`;
      c.style.width = `${24 + Math.random() * 24}px`;
      c.style.setProperty('--fall', `${fall}px`);
      c.style.setProperty('--spin', `${Math.round((Math.random() * 2 - 1) * 540)}deg`);
      c.style.animationDuration = `${1.3 + Math.random() * 1.1}s`;
      c.style.animationDelay = `${Math.random() * 0.9}s`;
      el.stage.appendChild(c);
      setTimeout(() => c.remove(), 3400);
    }
  }

  function after(win, bet) {
    if (autoLeft > 0) {
      autoLeft--;
      if (auto.stopsOn(win, bet)) autoLeft = 0;
      renderControls();
      if (autoLeft > 0) setTimeout(() => { if (autoLeft > 0 && !busy) spin(); }, win ? 700 : 300);
    }
  }

  /* ---------------------------------------------------------
     Avisos grandes
  --------------------------------------------------------- */
  let ovTimer = 0, ovDone = null;
  function overlay({ kicker, title, image, amount, hint }, ms, done) {
    clearTimeout(ovTimer);
    ovDone = done || null;
    el.ovKicker.textContent = kicker || '';
    el.ovTitle.textContent = title;
    el.ovImg.hidden = !image;
    if (image) el.ovImg.src = image;
    el.ovAmount.textContent = amount || '';
    el.ovHint.textContent = hint || 'Toque para continuar';
    el.overlay.hidden = false;
    ovTimer = setTimeout(closeOverlay, turbo() ? ms * 0.6 : ms);
  }
  function closeOverlay() {
    clearTimeout(ovTimer);
    if (el.overlay.hidden) return;
    el.overlay.hidden = true;
    const d = ovDone;
    ovDone = null;
    if (d) d();
  }

  /* ---------------------------------------------------------
     Controles e telas de apoio
  --------------------------------------------------------- */
  function stopAuto() { autoLeft = 0; renderControls(); }
  function toggleAuto() {
    if (autoLeft > 0) return stopAuto();
    if (S.bet > wallet.balance) return toast('Fichas insuficientes para o giro automático.');
    auto.open(el.btnAuto, n => {
      if (autoLeft > 0) return;
      if (S.bet > wallet.balance) return toast('Fichas insuficientes para o giro automático.');
      autoLeft = n;
      renderControls();
      if (!busy) spin();
    });
  }
  const locked = () => busy || autoLeft > 0;
  function changeBet(dir) {
    if (locked()) return;
    S.bet = BETS[Math.max(0, Math.min(BETS.length - 1, BETS.indexOf(S.bet) + dir))];
    save();
    renderAll();
  }
  function setWin(label, amount) {
    el.winLabel.textContent = label;
    el.winAmount.textContent = amount;
  }

  function renderStats() {
    el.spins.textContent = S.spins;
    el.best.textContent = fmt(S.best);
    el.net.textContent = (S.net > 0 ? '+' : S.net < 0 ? '−' : '') + fmt(Math.abs(S.net));
    el.net.style.color = S.net > 0 ? 'var(--teal)' : S.net < 0 ? '#ff8fab' : '';
  }
  function renderControls() {
    const i = BETS.indexOf(S.bet);
    el.betValue.textContent = fmt(S.bet);
    el.betMinus.disabled = locked() || i <= 0;
    el.betPlus.disabled = locked() || i >= BETS.length - 1;
    el.btnTurbo.setAttribute('aria-pressed', S.turbo ? 'true' : 'false');
    el.btnAuto.setAttribute('aria-pressed', autoLeft > 0 ? 'true' : 'false');
    el.btnAuto.textContent = autoLeft > 0 ? `Parar · ${auto.label(autoLeft)}` : 'Auto';
    el.btnSpin.disabled = busy || autoLeft > 0;
    el.spinLabel.textContent = busy ? 'Girando…' : `Girar · ${fmt(S.bet)}`;
    el.status.textContent = autoLeft > 0 ? (autoLeft === Infinity ? 'Giro automático sem limite' : `Giro automático: faltam ${autoLeft}`)
      : wallet.balance < BETS[0] ? 'Sem fichas: use o + no topo para recarregar'
      : S.bet > wallet.balance ? 'Aposta maior que suas fichas: diminua o valor'
      : busy ? '' : '3 iguais numa das 5 linhas pagam · o Rei vale por qualquer símbolo';
  }

  /* Quanto paga: valores já calculados para a aposta */
  function renderPays() {
    const bet = S.bet, line = bet / F.BET_LINES;
    el.paysBet.textContent = `aposta ${fmt(bet)}`;
    const icon = s => `<img src="${img(s)}" alt="">`;
    const rows = [
      `<div class="pay-row special" data-s="wild"><span class="pay-icon">${icon('wild')}</span><div class="pay-info">` +
      `<small class="pay-note"><b>Rei (coringa):</b> vale por qualquer símbolo</small>` +
      `<div class="pay-single"><small>3 na linha</small><b>${fmt(F.PAYS.wild * line)}</b></div></div></div>`,
      `<div class="pay-row special bonus" data-s="feature"><span class="pay-icon">${icon('coin')}</span><div class="pay-info">` +
      `<small class="pay-note"><b>Bônus da Fortuna:</b> aparece de surpresa</small>` +
      `<div class="pay-text">Só um símbolo e o Rei nos rolos; o que cai fica preso e gira de novo até sair prêmio. Tela cheia paga x${F.FULL_MULT}.</div></div></div>`,
    ];
    F.SYMBOLS.filter(s => s !== 'wild').forEach(s => {
      rows.push(`<div class="pay-row" data-s="${s}"><span class="pay-icon">${icon(s)}</span><div class="pay-info">` +
        `<div class="pay-single"><small>3 na linha</small><b>${fmt(F.PAYS[s] * line)}</b></div></div></div>`);
    });
    el.pays.innerHTML = rows.join('');
  }
  function renderLinesMini() {
    el.linesMini.innerHTML = F.LINES.map((line, i) => {
      const on = new Set(line.map(([r, c]) => `${r},${c}`));
      let rects = '';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) rects += `<rect x="${2 + c * 10}" y="${2 + r * 10}" width="8" height="8" rx="2"${on.has(`${r},${c}`) ? ` class="on" style="fill:${LINE_COLORS[i]}"` : ''}/>`;
      return `<svg viewBox="0 0 32 32" role="img" aria-label="Linha ${LINE_NAMES[i]}">${rects}</svg>`;
    }).join('');
  }

  function renderAll() {
    renderStats();
    renderControls();
    renderPays();
  }

  /* ---------------------------------------------------------
     Início
  --------------------------------------------------------- */
  function init() {
    Object.assign(el, {
      stage: $('#stage'), king: $('#king'), reels: $('#reels'), lines: $('#lines'), fx: $('#fx'),
      featureTag: $('#feature-tag'), featureSym: $('#feature-sym'),
      winLabel: $('#win-label'), winAmount: $('#win-amount'),
      overlay: $('#overlay'), ovKicker: $('#ov-kicker'), ovTitle: $('#ov-title'), ovImg: $('#ov-img'), ovAmount: $('#ov-amount'), ovHint: $('#ov-hint'),
      betMinus: $('#bet-minus'), betPlus: $('#bet-plus'), betValue: $('#bet-value'),
      btnAuto: $('#btn-auto'), btnTurbo: $('#btn-turbo'), btnSpin: $('#btn-spin'), spinLabel: $('#spin-label'), status: $('#status'),
      pays: $('#pays'), paysBet: $('#pays-bet'), linesMini: $('#lines-mini'),
      spins: $('#info-spins'), best: $('#info-best'), net: $('#info-net'), log: $('#log'),
    });
    king = window.Rei2D.mount(el.king);

    const saved = loadSave();
    S = saved || fresh();
    S.logs.forEach(([m, c]) => appendLog(m, c));
    if (!saved) log('Bem-vindo ao Rei da Fortuna! 3 iguais numa linha pagam; o Rei vale por qualquer símbolo.', 'sep');

    buildReels(Array.from({ length: 3 }, () => Array.from({ length: 3 }, randomSym)));
    renderLinesMini();

    el.btnSpin.addEventListener('click', spin);
    el.betMinus.addEventListener('click', () => changeBet(-1));
    el.betPlus.addEventListener('click', () => changeBet(1));
    el.btnAuto.addEventListener('click', toggleAuto);
    el.btnTurbo.addEventListener('click', () => { S.turbo = !S.turbo; save(); renderAll(); });
    el.overlay.addEventListener('click', closeOverlay);
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
      const onControl = e.target.closest && e.target.closest('button, input');
      if ((e.key === ' ' || e.key === 'Enter') && !onControl) {
        e.preventDefault();
        if (!el.overlay.hidden) closeOverlay();
        else if (!autoLeft) spin();
      }
    });

    wallet.setRefillGuard(() => (locked() ? 'Espere o giro terminar para recarregar.' : null));
    wallet.onChange(() => renderControls());

    save();
    renderAll();
    setWin('Boa sorte!', '');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
