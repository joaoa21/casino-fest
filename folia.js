/* ==========================================================
   Casino Fest · Rei da Folia — tela, animações e bônus
   A matemática fica em folia-math.js.
   As fichas são as da carteira única do cassino (casino.js).
   ========================================================== */
(() => {
  'use strict';

  const { fmt, $, toast, confetti, wallet, auto, sfx } = window.Casino;
  const F = window.FoliaMath;

  const BETS = [20, 40, 100, 200, 400, 1000];   // múltiplos de 20: todo prêmio vira valor inteiro
  const SAVE_KEY = 'casinofest:folia:v1';
  const NAMES = { crown: 'Coroa', scepter: 'Cetro', sneaker: 'Tênis', cup: 'Taça', red: 'Rubi', purple: 'Ametista', yellow: 'Topázio', green: 'Esmeralda', blue: 'Safira', scatter: 'Sol', orb: 'Bola' };


  /* ---------------------------------------------------------
     Símbolos (imagens em folia/): a cor da bola sobe com o valor
  --------------------------------------------------------- */
  const ORB_ART = v => (v >= 100 ? 'gold' : v >= 25 ? 'red' : v >= 10 ? 'purple' : v >= 5 ? 'blue' : 'green');
  const GEMS = new Set(['red', 'purple', 'yellow', 'green', 'blue']);
  const symImg = (s, alt = '') => `<img class="fo-sym${GEMS.has(s) ? ' gem' : ''}" src="folia/${s}.webp" alt="${alt}" draggable="false">`;
  const orbHtml = (v, style = '') => `<div class="fo-orb ${ORB_ART(v)}"${style}><img src="folia/orb-${ORB_ART(v)}.webp" alt="" draggable="false"><b>x${v}</b></div>`;
  const cellInner = cell => (cell.s === 'orb' ? orbHtml(cell.v) : symImg(cell.s, NAMES[cell.s]));

  /* ---------------------------------------------------------
     Estado e salvamento
  --------------------------------------------------------- */
  let S = null;
  const el = {};
  let busy = false, autoLeft = 0;
  const nodes = new Map();      // id da casa → elemento na grade

  const fresh = () => ({ v: 1, bet: 20, turbo: false, spins: 0, net: 0, best: 0, bonus: null, logs: [] });
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
  const turbo = () => S.turbo || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = ms => new Promise(r => setTimeout(r, turbo() ? ms * 0.45 : ms));

  /* ---------------------------------------------------------
     Grade: cada casa é um elemento que cai até o seu lugar
  --------------------------------------------------------- */
  const pos = (c, r) => ({ left: `${(c * 100) / F.COLS}%`, top: `${r * 20}%` });

  function makeNode(cell, c, rStart) {
    const n = document.createElement('div');
    n.className = 'fo-cell' + (cell.s === 'orb' ? ' orb-cell' : '');
    n.dataset.id = cell.id;
    n.innerHTML = cellInner(cell);
    const p = pos(c, rStart);
    n.style.left = p.left;
    n.style.top = p.top;
    el.grid.appendChild(n);
    nodes.set(cell.id, n);
    return n;
  }

  // a grade inteira cai de cima (início do giro)
  async function dropIn(grid) {
    const old = [...nodes.values()];
    old.forEach(n => { n.style.transitionDelay = '0ms'; n.style.top = `${parseFloat(n.style.top) + 110}%`; n.style.opacity = '0'; });
    await sleep(old.length ? 240 : 0);
    old.forEach(n => n.remove());
    nodes.clear();
    el.grid.classList.remove('dim');
    grid.forEach((col, c) => col.forEach((cell, r) => {
      const n = makeNode(cell, c, r - F.ROWS - 1);
      n.style.transitionDelay = `${(turbo() ? 25 : 55) * c + (F.ROWS - r) * 12}ms`;
    }));
    void el.grid.offsetHeight;
    grid.forEach((col, c) => col.forEach((cell, r) => { nodes.get(cell.id).style.top = pos(c, r).top; }));
    await sleep(380 + 55 * F.COLS);
    nodes.forEach(n => { n.style.transitionDelay = '0ms'; });
  }

  // depois de uma cascata: quem ficou cai e os novos entram por cima
  async function settle(grid) {
    grid.forEach((col, c) => {
      const fresh = col.filter(cell => !nodes.has(cell.id)).length;
      col.forEach((cell, r) => {
        if (!nodes.has(cell.id)) makeNode(cell, c, r - fresh - 0.4);
      });
    });
    void el.grid.offsetHeight;
    grid.forEach((col, c) => col.forEach((cell, r) => { nodes.get(cell.id).style.top = pos(c, r).top; }));
    await sleep(440);
  }

  // valor de uma cascata flutuando sobre o grupo premiado
  function floatAt(cells, text) {
    const cx = cells.reduce((s, [c]) => s + c, 0) / cells.length, cy = cells.reduce((s, [, r]) => s + r, 0) / cells.length;
    const f = document.createElement('div');
    f.className = 'fo-float';
    f.textContent = text;
    f.style.left = `${((cx + 0.5) * 100) / F.COLS}%`;
    f.style.top = `${(cy + 0.5) * 20}%`;
    el.grid.appendChild(f);
    setTimeout(() => f.remove(), 1200);
  }

  /* ---------------------------------------------------------
     O rei: comemoração e o raio do cetro
  --------------------------------------------------------- */
  let king = null;       // o rei 2D animado (rei.js)
  function kingPose(name, ms) {
    king.pose(name, Math.max(ms || 0, name === 'cheer' ? 900 : 0));
  }
  // de onde sai o raio: a estrela do cetro
  function kingTip(box) {
    const t = king.tip();
    return { x: t.x - box.left, y: t.y - box.top };
  }
  const clientCenter = node => {
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const centerIn = (node, box) => {
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
  };
  function bolt(from, to, color) {
    const box = el.stage.getBoundingClientRect();
    el.fx.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, segs = 8;
    let d = `M${from.x.toFixed(1)} ${from.y.toFixed(1)}`;
    for (let i = 1; i < segs; i++) {
      const t = i / segs, j = (Math.random() - 0.5) * len * 0.13;
      d += `L${(from.x + dx * t + nx * j).toFixed(1)} ${(from.y + dy * t + ny * j).toFixed(1)}`;
    }
    d += `L${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.setProperty('--bc', color);
    g.innerHTML = `<path class="bolt bolt-glow" d="${d}"/><path class="bolt bolt-core" d="${d}"/><path class="bolt bolt-hot" d="${d}"/>` +
      `<circle cx="${to.x}" cy="${to.y}" r="16" fill="${color}" opacity=".55"/>`;
    el.fx.appendChild(g);
    setTimeout(() => g.remove(), 700);
  }

  // o rei aponta o cetro e acerta cada bola; no bônus o valor vai para o placar
  async function castAtOrbs(orbs, toTotal, accumStart) {
    let acc = accumStart;
    el.grid.classList.add('dim');
    for (const o of orbs) {
      const n = nodes.get(o.id);
      if (!n) continue;
      king.cast(true, clientCenter(n));
      await sleep(300);
      const box = el.stage.getBoundingClientRect();
      bolt(kingTip(box), centerIn(n, box), '#ffc940');
      const orb = n.querySelector('.fo-orb');
      orb.classList.remove('hit');
      void orb.offsetWidth;
      orb.classList.add('hit');
      n.classList.add('win');
      await sleep(380);
      if (toTotal) {
        bolt(centerIn(n, box), centerIn(el.totalMult, box), '#ff5fa2');
        await sleep(200);
        acc += o.v;
        el.totalMult.textContent = `x${acc}`;
        el.totalBox.classList.remove('bump');
        void el.totalBox.offsetWidth;
        el.totalBox.classList.add('bump');
      }
      await sleep(160);
    }
    king.cast(false);
  }

  /* ---------------------------------------------------------
     Giro (normal ou grátis)
  --------------------------------------------------------- */
  async function spin() {
    if (busy) return;
    const b = S.bonus;
    const free = !!b && !b.pending;
    if (b && !free) return;
    const bet = free ? b.bet : S.bet;
    if (!free && bet > wallet.balance) {
      stopAuto();
      return toast(wallet.balance < BETS[0] ? 'Sem fichas: use o + no topo para recarregar.' : 'Fichas insuficientes para essa aposta. Diminua o valor.');
    }

    // resultado decidido e salvo antes da animação
    const res = F.playSpin(rand, bet, free ? 'free' : 'base', free ? b.accum : 0);
    let total = Math.floor(res.total);
    if (free) {
      total = Math.min(total, F.MAX_WIN * bet - b.total);    // teto do bônus
      b.left--;
      b.played++;
      b.accum = res.accum;
      b.total += total;
      b.left += res.freeSpins;
      if (b.total >= F.MAX_WIN * bet) b.left = 0;
    } else {
      S.spins++;
      S.net -= bet;
      wallet.add(-bet);
      if (res.freeSpins) S.bonus = { left: res.freeSpins, played: 0, total: 0, accum: 0, bet, bought: false, pending: true };
    }
    S.net += total;
    S.best = Math.max(S.best, total);
    save();
    const est = 900 + (res.steps.length - 1) * 1350 + (res.tumbleWin > 0 ? res.orbs.length * 900 : 0) + 500;
    if (total > 0) wallet.add(total, { delay: (turbo() ? 0.45 : 1) * est });

    busy = true;
    sfx.play('spin');
    renderAll();
    await play(res, bet, free, total, free ? b.accum - (res.tumbleWin > 0 && res.orbs.length ? res.orbSum : 0) : 0);
    busy = false;
    renderAll();
    after(res, bet, free, total);
  }

  async function play(res, bet, free, total, accumBefore) {
    setWin('Girando…', '');
    await dropIn(res.steps[0].grid);
    let running = 0;
    for (let i = 0; i < res.steps.length; i++) {
      const st = res.steps[i];
      if (i > 0) await settle(st.grid);
      if (!st.wins.length) break;
      el.grid.classList.add('dim');
      st.wins.forEach(w => {
        w.cells.forEach(([c, r]) => { const n = nodes.get(st.grid[c][r].id); if (n) n.classList.add('win'); });
        floatAt(w.cells, fmt(w.amount));
      });
      running += st.stepWin;
      setWin(st.wins.map(w => `${w.count}× ${NAMES[w.s]}`).join(' · '), fmt(running));
      kingPose('cheer', 600);
      await sleep(820);
      st.wins.forEach(w => w.cells.forEach(([c, r]) => {
        const n = nodes.get(st.grid[c][r].id);
        if (n) { n.classList.add('pop'); nodes.delete(st.grid[c][r].id); setTimeout(() => n.remove(), 300); }
      }));
      el.grid.classList.remove('dim');
      await sleep(260);
    }

    // bolas de multiplicador: só valem se o giro teve prêmio
    if (res.tumbleWin > 0 && res.orbs.length) {
      setWin(free ? 'O Rei soma os multiplicadores!' : 'O Rei solta o poder!', fmt(res.tumbleWin));
      await castAtOrbs(res.orbs, free, accumBefore);
      setWin(`${fmt(res.tumbleWin)} × ${res.mult}`, fmt(Math.floor(res.lineWin)));
      kingPose('cheer', 600);
      await sleep(700);
    }
    el.grid.classList.remove('dim');
    if (res.scatterPay) setWin(`${res.scatters} sóis pagam`, fmt(res.scatterPay));

    if (total > 0) {
      setWin(free ? 'Neste giro grátis' : 'Você ganhou', `+${fmt(total)}`);
      log(`${free ? 'Giro grátis' : `Giro ${S.spins}`}: ganhou ${fmt(total)}${res.mult > 1 ? ` (multiplicador x${res.mult})` : ''}.`, 'win');
      const x = total / bet;
      if (x >= 15 && !free) await bigWin(total, bet);
      else if (x >= 40 && free) await bigWin(total, bet);
      else if (x >= 5) confetti(80, el.grid);
    } else {
      setWin(free ? 'Giro grátis sem prêmio' : 'Não foi dessa vez', '');
    }
    save();
  }

  function after(res, bet, free, total) {
    const b = S.bonus;
    if (b && b.pending) {
      stopAuto();
      log(`${res.scatters} sóis! ${b.left} giros grátis com multiplicador acumulado.`, 'win');
      setTimeout(() => announceBonus(`${res.scatters} sóis!`), 500);
    } else if (b) {
      if (free && res.freeSpins) toast(`Mais ${res.freeSpins} giros grátis!`);
      setTimeout(b.left > 0 ? runBonus : endBonus, total ? 900 : 450);
    } else if (autoLeft > 0) {
      autoLeft--;
      if (auto.stopsOn(total, bet)) autoLeft = 0;
      renderControls();
      if (autoLeft > 0) setTimeout(() => { if (autoLeft > 0 && !busy) spin(); }, total ? 900 : 350);
    }
  }

  /* ---------------------------------------------------------
     Bônus
  --------------------------------------------------------- */
  function announceBonus(kicker) {
    const b = S.bonus;
    if (!b) return;
    kingPose('party', 2200);
    confetti(200, el.stage);
    overlay({ kicker, title: 'Bônus do Rei!', amount: `${b.left} giros grátis`, hint: 'Cada bola soma no multiplicador total' }, 2800, () => {
      b.pending = false;
      save();
      renderAll();
      runBonus();
    });
    renderAll();
  }
  function runBonus() {
    const b = S.bonus;
    if (!b || b.pending || busy || !el.overlay.hidden) return;
    if (b.left <= 0) return endBonus();
    spin();
  }
  function endBonus() {
    const b = S.bonus;
    if (!b) return;
    S.bonus = null;
    log(`Bônus encerrado: ${b.played} giros grátis renderam ${fmt(b.total)} (multiplicador final x${b.accum}).`, 'win');
    save();
    const x = b.total / b.bet;
    kingPose('party', 2200);
    if (x >= 10) confetti(x >= 100 ? 300 : 180, el.stage);
    overlay({ kicker: 'Fim do bônus', title: x >= 200 ? 'Folia épica!' : x >= 50 ? 'Bônus gigante!' : x >= 15 ? 'Que bônus!' : 'Bônus encerrado', amount: fmt(b.total), hint: `${b.played} giros · multiplicador final x${b.accum}` }, 3600);
    renderAll();
  }

  function openBuy() {
    if (busy || S.bonus || autoLeft) return;
    renderBuy();
    el.buyDialog.showModal();
  }
  function renderBuy() {
    const i = BETS.indexOf(S.bet), cost = S.bet * F.BUY_COST, ok = cost <= wallet.balance;
    el.bdBet.textContent = fmt(S.bet);
    el.bdMinus.disabled = i <= 0;
    el.bdPlus.disabled = i >= BETS.length - 1;
    el.bdCost.textContent = fmt(cost);
    el.bdBalance.classList.toggle('warn', !ok);
    el.bdBalance.innerHTML = ok ? `Suas fichas: <b>${fmt(wallet.balance)}</b> → <b>${fmt(wallet.balance - cost)}</b>`
      : `Fichas insuficientes: você tem <b>${fmt(wallet.balance)}</b>. Diminua a aposta.`;
    el.buyConfirm.textContent = `Comprar · ${fmt(cost)}`;
    el.buyConfirm.disabled = !ok;
  }
  function buyBonus() {
    const cost = S.bet * F.BUY_COST;
    el.buyDialog.close();
    if (busy || S.bonus || cost > wallet.balance) return;
    wallet.add(-cost);
    S.net -= cost;
    S.bonus = { left: F.FREE_SPINS, played: 0, total: 0, accum: 0, bet: S.bet, bought: true, pending: true };
    save();
    log(`Bônus comprado por ${fmt(cost)}.`, 'me');
    announceBonus('Bônus comprado');
  }

  /* ---------------------------------------------------------
     Avisos grandes
  --------------------------------------------------------- */
  let ovTimer = 0, ovDone = null;
  function overlay({ kicker, title, amount, hint }, ms, done) {
    clearTimeout(ovTimer);
    ovDone = done || null;
    el.ovKicker.textContent = kicker || '';
    el.ovTitle.textContent = title;
    el.ovAmount.textContent = amount || '';
    el.ovHint.textContent = hint || 'Toque para continuar';
    el.overlay.hidden = false;
    ovTimer = setTimeout(closeOverlay, ms);
  }
  function closeOverlay() {
    clearTimeout(ovTimer);
    if (el.overlay.hidden) return;
    el.overlay.hidden = true;
    const d = ovDone;
    ovDone = null;
    if (d) d();
  }
  function bigWin(total, bet) {
    const x = total / bet;
    confetti(x >= 50 ? 280 : 180, el.stage);
    kingPose('party', 2000);
    return new Promise(res => overlay({ kicker: '', title: x >= 200 ? 'Prêmio épico!' : x >= 50 ? 'Mega prêmio!' : 'Grande prêmio!', amount: fmt(total), hint: `${Math.floor(x)}x a aposta` }, 2800, res));
  }

  /* ---------------------------------------------------------
     Controles e telas de apoio
  --------------------------------------------------------- */
  function stopAuto() { autoLeft = 0; renderControls(); }
  function toggleAuto() {
    if (autoLeft > 0) return stopAuto();
    if (S.bonus) return;
    if (S.bet > wallet.balance) return toast('Fichas insuficientes para o giro automático.');
    auto.open(el.btnAuto, n => {
      if (autoLeft > 0 || S.bonus) return;
      if (S.bet > wallet.balance) return toast('Fichas insuficientes para o giro automático.');
      autoLeft = n;
      renderControls();
      if (!busy) spin();
    });
  }
  const locked = () => busy || autoLeft > 0 || !!S.bonus;
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
    const b = S.bonus, inFs = !!b && !b.pending;
    el.stage.classList.toggle('in-bonus', inFs);
    el.stage.classList.toggle('turbo', turbo());
    el.fsbar.hidden = !inFs;
    el.totalBox.hidden = !inFs;
    if (inFs) {
      el.fsCount.textContent = `${b.played}/${b.played + b.left}`;
      el.fsTotal.textContent = fmt(b.total);
      if (!busy) el.totalMult.textContent = `x${b.accum}`;
    }
  }
  function renderControls() {
    const i = BETS.indexOf(S.bet), b = S.bonus;
    el.betValue.textContent = fmt(b ? b.bet : S.bet);
    el.betMinus.disabled = locked() || i <= 0;
    el.betPlus.disabled = locked() || i >= BETS.length - 1;
    el.btnTurbo.setAttribute('aria-pressed', S.turbo ? 'true' : 'false');
    el.btnAuto.setAttribute('aria-pressed', autoLeft > 0 ? 'true' : 'false');
    el.btnAuto.textContent = autoLeft > 0 ? `Parar · ${auto.label(autoLeft)}` : 'Auto';
    el.btnAuto.disabled = !!b;
    el.buyPrice.textContent = fmt(S.bet * F.BUY_COST);
    el.btnBuy.disabled = locked() || S.bet * F.BUY_COST > wallet.balance;
    el.btnSpin.disabled = busy || autoLeft > 0 || !!b;
    el.spinLabel.textContent = b ? `Giros grátis · ${b.left}` : busy ? 'Girando…' : `Girar · ${fmt(S.bet)}`;
    el.status.textContent = b ? (b.pending ? 'Bônus ativado!' : `Giros grátis: faltam ${b.left} · multiplicador total x${b.accum}`)
      : autoLeft > 0 ? (autoLeft === Infinity ? 'Giro automático sem limite' : `Giro automático: faltam ${autoLeft}`)
      : wallet.balance < BETS[0] ? 'Sem fichas: use o + no topo para recarregar'
      : S.bet > wallet.balance ? 'Aposta maior que suas fichas: diminua o valor'
      : busy ? '' : '8 ou mais símbolos iguais em qualquer lugar pagam';
  }

  /* Quanto paga: valores já calculados para a aposta */
  function renderPays() {
    const bet = S.bonus ? S.bonus.bet : S.bet;
    el.paysBet.textContent = `aposta ${fmt(bet)}`;
    const icon = s => symImg(s);
    const rows = [
      `<div class="pay-row special bonus" data-s="scatter"><span class="pay-icon">${icon('scatter')}</span><div class="pay-info">` +
      `<small class="pay-note"><b>Bônus:</b> 4 ou mais sóis em qualquer lugar</small>` +
      `<div class="pay-text">${F.FREE_SPINS} giros grátis com multiplicador acumulado · 4 sóis pagam ${fmt(F.SCATTER_PAYS[4] * bet)}, 5 pagam ${fmt(F.SCATTER_PAYS[5] * bet)}, 6 pagam ${fmt(F.SCATTER_PAYS[6] * bet)}</div></div></div>`,
      `<div class="pay-row special" data-s="orb"><span class="pay-icon">${orbHtml(25, ' style="width:46px;font-size:12px"')}</span><div class="pay-info">` +
      `<small class="pay-note"><b>Bolas de multiplicador</b> (2x a 500x)</small>` +
      `<div class="pay-text">Multiplicam o prêmio do giro. No bônus, se somam ao multiplicador total.</div></div></div>`,
    ];
    F.SYMBOLS.forEach(s => {
      const p = F.PAYS[s];
      rows.push(`<div class="pay-row" data-s="${s}"><span class="pay-icon">${icon(s)}</span><div class="pay-info"><div class="pay-cells">` +
        `<span class="pay-cell"><small>8-9</small><b>${fmt(p[0] * bet)}</b></span>` +
        `<span class="pay-cell"><small>10-11</small><b>${fmt(p[1] * bet)}</b></span>` +
        `<span class="pay-cell"><small>12+</small><b>${fmt(p[2] * bet)}</b></span></div></div></div>`);
    });
    el.pays.innerHTML = rows.join('');
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
      stage: $('#stage'), king: $('#king'), grid: $('#grid'), fx: $('#fx'),
      totalBox: $('#total-box'), totalMult: $('#total-mult'), fsbar: $('#fsbar'), fsCount: $('#fs-count'), fsTotal: $('#fs-total'),
      winLabel: $('#win-label'), winAmount: $('#win-amount'),
      overlay: $('#overlay'), ovKicker: $('#ov-kicker'), ovTitle: $('#ov-title'), ovAmount: $('#ov-amount'), ovHint: $('#ov-hint'),
      betMinus: $('#bet-minus'), betPlus: $('#bet-plus'), betValue: $('#bet-value'),
      btnAuto: $('#btn-auto'), btnTurbo: $('#btn-turbo'), btnBuy: $('#btn-buy'), buyPrice: $('#buy-price'),
      btnSpin: $('#btn-spin'), spinLabel: $('#spin-label'), status: $('#status'),
      pays: $('#pays'), paysBet: $('#pays-bet'),
      buyDialog: $('#buy-dialog'), buyConfirm: $('#buy-confirm'), bdBet: $('#bd-bet'), bdMinus: $('#bd-minus'), bdPlus: $('#bd-plus'),
      bdCost: $('#bd-cost'), bdBalance: $('#bd-balance'),
      spins: $('#info-spins'), best: $('#info-best'), net: $('#info-net'), log: $('#log'),
    });
    king = window.Rei2D.mount(el.king);

    const saved = loadSave();
    S = saved || fresh();
    S.logs.forEach(([m, c]) => appendLog(m, c));
    if (!saved) log('Bem-vindo à festa do Rei! 8 ou mais iguais em qualquer lugar pagam.', 'sep');

    // grade inicial só para enfeitar (sem prêmio)
    const demo = F.playSpin(rand, S.bet, 'base');
    dropIn(demo.steps[0].grid);

    el.btnSpin.addEventListener('click', spin);
    el.betMinus.addEventListener('click', () => changeBet(-1));
    el.betPlus.addEventListener('click', () => changeBet(1));
    el.btnAuto.addEventListener('click', toggleAuto);
    el.btnTurbo.addEventListener('click', () => { S.turbo = !S.turbo; save(); renderAll(); });
    el.btnBuy.addEventListener('click', openBuy);
    el.buyConfirm.addEventListener('click', buyBonus);
    el.bdMinus.addEventListener('click', () => { changeBet(-1); renderBuy(); });
    el.bdPlus.addEventListener('click', () => { changeBet(1); renderBuy(); });
    el.buyDialog.addEventListener('click', e => { if (e.target === el.buyDialog || e.target.closest('[data-close]')) el.buyDialog.close(); });
    el.overlay.addEventListener('click', closeOverlay);
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
      const onControl = e.target.closest && e.target.closest('button, input');
      if ((e.key === ' ' || e.key === 'Enter') && !onControl) {
        e.preventDefault();
        if (!el.overlay.hidden) closeOverlay();
        else if (!autoLeft && !S.bonus) spin();
      }
    });

    wallet.setRefillGuard(() => (locked() ? 'Espere o giro (e o bônus) terminarem para recarregar.' : null));
    wallet.onChange(() => renderControls());

    save();
    renderAll();
    setWin('Boa folia!', '');

    // voltou com um bônus no meio: continua de onde parou
    const b = S.bonus;
    if (b) {
      toast('Bônus retomado de onde você parou');
      if (b.pending) setTimeout(() => announceBonus(b.bought ? 'Bônus comprado' : 'Sóis!'), 900);
      else setTimeout(runBonus, 1200);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
