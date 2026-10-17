/* ==========================================================
   Casino Fest · Crash "Space Fest"
   O multiplicador sobe até o astronauta sumir num ponto sorteado.
   Retire antes de ele sumir para ganhar aposta × multiplicador.
   Matemática: P(sumir em x ou mais) = 0,96 / x → retorno de 96%
   para qualquer momento de retirada. Vela máxima de 10.000x: quem
   ainda está no ar recebe o teto (o retorno continua 96%). As fichas são as da carteira
   única do cassino (casino.js).
   ========================================================== */
(() => {
  'use strict';

  const { fmt, $, toast, confetti, wallet, avatarImg, sfx } = window.Casino;

  /* ---------------------------------------------------------
     Constantes
  --------------------------------------------------------- */
  const RTP = 0.96;
  const K = 0.00011;            // velocidade de subida: m(t) = e^(K·t), t em ms (2x em ~6s, 10x em ~21s)
  const BET_MS = 6000;          // janela de apostas
  const PAUSE_MS = 3200;        // pausa depois do estouro
  const CAP = 10000;            // vela máxima: ao chegar aqui a rodada termina e quem está no ar recebe 10.000x
  const MAX_TARGET = CAP;
  const SAVE_KEY = 'casinofest:crash:v1';
  const BOTS = [
    { name: 'Barão', avatar: 'av-baron', ring: 'ring-baron', bold: 0.4 },
    { name: 'Lola', avatar: 'av-lola', ring: 'ring-lola', bold: 1 },
    { name: 'Kenji', avatar: 'av-kenji', ring: 'ring-kenji', bold: 0.7 },
    { name: 'Duda', avatar: 'av-dealer', ring: 'ring-dealer', bold: 0.55 },
  ];

  const multAt = ms => Math.exp(K * Math.max(0, ms));
  const timeFor = m => Math.log(m) / K;
  const fmtX = m => `${m.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // sorteio do ponto de estouro (gerador criptográfico)
  function rollCrash() {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    const u = (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53;       // uniforme [0, 1)
    return Math.min(CAP, Math.max(1, Math.floor((RTP / (1 - u)) * 100) / 100));
  }

  /* ---------------------------------------------------------
     Estado salvo e estado da rodada
  --------------------------------------------------------- */
  let C = null;                 // estado salvo
  let phase = 'betting';        // betting · flying · crashed
  let phaseEnd = 0;             // fim da janela de apostas ou da pausa
  let round = null;             // { start, crash, bots: [...] }
  const el = {};
  let stars = [];
  const P = [];                 // elementos de cada painel de aposta
  const tag = i => (C.second ? ` (aposta ${i + 1})` : '');
  const flying = s => !!(s.active && !s.active.cashedAt);

  // cada aposta (Aposta 1 e Aposta 2) tem valor, retirada automática e situação próprios
  const freshSlot = (bet = 10) => ({
    bet, autoOn: false, autoTarget: 2,
    placed: null,     // aposta feita na janela atual (já descontada)
    queued: null,     // aposta para a próxima rodada (ainda não descontada)
    active: null,     // aposta no voo: { start, crash, bet, auto, cashedAt }
  });
  const fresh = () => ({
    v: 2, slots: [freshSlot(), freshSlot()], second: false,
    history: [], rounds: 0, best: 0, net: 0, logs: [],
  });
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(C)); } catch (e) { /* sem armazenamento */ }
  }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s || !Array.isArray(s.history)) return null;
      if (s.v === 1) {
        // save antigo (uma aposta só): vira a Aposta 1
        s.slots = [{ bet: s.bet || 10, autoOn: !!s.autoOn, autoTarget: s.autoTarget || 2, placed: s.placed || null, queued: s.queued || null, active: s.active || null }, freshSlot()];
        s.second = false;
        s.v = 2;
        ['bet', 'autoOn', 'autoTarget', 'placed', 'queued', 'active'].forEach(k => delete s[k]);
      }
      return s.v === 2 && Array.isArray(s.slots) ? s : null;
    } catch (e) { return null; }
  }
  function log(msg, cls = '') {
    C.logs.push([msg, cls]);
    if (C.logs.length > 80) C.logs.splice(0, C.logs.length - 80);
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

  /* ---------------------------------------------------------
     Fases da rodada
  --------------------------------------------------------- */
  function startBetting() {
    phase = 'betting';
    phaseEnd = Date.now() + BET_MS;
    round = null;
    el.stage.className = 'cr-stage betting';
    el.boom.hidden = true;
    // jogadores simulados escolhem aposta e alvo
    const n = 2 + Math.floor(Math.random() * 3);
    const bots = [...BOTS].sort(() => Math.random() - 0.5).slice(0, n).map(b => ({
      ...b,
      bet: [10, 20, 25, 50, 100, 150, 200, 500][Math.floor(Math.random() * 8)],
      target: Math.round((1.15 + Math.pow(Math.random(), 2.2) * 9 * b.bold) * 100) / 100,
      cashedAt: null,
    }));
    round = { start: 0, crash: 0, bots };
    // apostas deixadas para esta rodada
    C.slots.forEach((s, i) => {
      if (!s.queued) return;
      const q = s.queued;
      s.queued = null;
      if (q.bet <= wallet.balance) placeBet(i, q.bet, q.auto, true);
      else toast('Fichas insuficientes para a aposta que estava na fila.');
    });
    save();
    renderAll();
  }

  function startFlight() {
    phase = 'flying';
    const crash = rollCrash();
    round.start = Date.now();
    round.crash = crash;
    el.stage.className = 'cr-stage flying';
    let any = false;
    C.slots.forEach(s => {
      if (!s.placed) return;
      s.active = { start: round.start, crash, bet: s.placed.bet, auto: s.placed.auto, cashedAt: null };
      s.placed = null;
      any = true;
    });
    if (any) { C.rounds++; save(); }
    renderAll();
  }

  function doCrash() {
    phase = 'crashed';
    phaseEnd = Date.now() + PAUSE_MS;
    const crash = round.crash;
    const maxed = crash >= CAP;
    el.stage.className = `cr-stage crashed${maxed ? ' maxed' : ''}`;
    if (maxed) confetti(300, el.stage);
    C.history.unshift(crash);
    C.history = C.history.slice(0, 24);
    sfx.play(C.slots.some(flying) ? 'crash' : 'click');
    C.slots.forEach((s, i) => {
      if (flying(s)) log(`Sumiu em ${fmtX(crash)}: você perdeu ${fmt(s.active.bet)}${tag(i)}.`);
      s.active = null;
    });
    save();
    // o astronauta dispara para longe e some num clarão de estrelas
    const tip = tipPoint(timeFor(crash));
    el.boom.style.left = `${tip.x}px`;
    el.boom.style.top = `${tip.y}px`;
    el.boom.style.setProperty('--ang', `${rocketAng}deg`);
    el.boom.innerHTML = '<i class="cr-flash"></i><i class="cr-ring"></i><i class="cr-ring r2"></i>' +
      Array.from({ length: 10 }, (_, i) => `<b style="--a:${Math.round(i * 36 + Math.random() * 14)}deg;--d:${Math.round(46 + Math.random() * 46)}px"></b>`).join('') +
      '<img class="cr-away" src="crash/astronauta.webp" alt="">';
    el.boom.hidden = false;
    renderAll();
    draw();
  }

  /* ---------------------------------------------------------
     Apostas e retirada
  --------------------------------------------------------- */
  const readBet = i => clamp(Math.floor(Number(P[i].betInput.value) || 0), 1, 1e9);
  const readTarget = i => clamp(Math.round((Number(String(P[i].autoInput.value).replace(',', '.')) || 2) * 100) / 100, 1.01, MAX_TARGET);

  function placeBet(i, bet, auto, fromQueue = false) {
    if (bet < 1) return toast('Escolha um valor de aposta.');
    if (bet > wallet.balance) return toast(wallet.balance < 1 ? 'Sem fichas: use o + no topo para recarregar.' : 'Fichas insuficientes para essa aposta.');
    wallet.add(-bet);
    C.net -= bet;
    C.slots[i].placed = { bet, auto };
    log(`${fromQueue ? 'Aposta da fila' : 'Você apostou'} ${fmt(bet)}${auto ? ` com retirada automática em ${fmtX(auto)}` : ''}${tag(i)}.`, 'me');
    save();
  }

  function cashOut(i, at) {
    const a = C.slots[i].active;
    if (!a || a.cashedAt || phase !== 'flying') return;
    const m = Math.floor(at * 100) / 100;
    const win = Math.floor(a.bet * m);
    a.cashedAt = m;
    C.net += win;
    C.best = Math.max(C.best, m);
    wallet.add(win);
    log(`Retirou em ${fmtX(m)}: ganhou ${fmt(win)} (lucro de ${fmt(win - a.bet)})${tag(i)}.`, 'win');
    save();
    el.cashpop.textContent = `+${fmt(win)} · ${fmtX(m)}`;
    el.cashpop.hidden = false;
    el.cashpop.style.animation = 'none';
    void el.cashpop.offsetWidth;
    el.cashpop.style.animation = '';
    setTimeout(() => { el.cashpop.hidden = true; }, 2400);
    if (m >= 5) confetti(m >= 20 ? 240 : 140, el.stage);
    renderAll();
  }

  // um botão por aposta, conforme a fase
  function mainAction(i) {
    const s = C.slots[i];
    if (phase === 'betting') {
      if (s.placed) {
        wallet.add(s.placed.bet);
        C.net += s.placed.bet;
        log(`Aposta de ${fmt(s.placed.bet)} cancelada${tag(i)}.`);
        s.placed = null;
        save();
      } else placeBet(i, readBet(i), s.autoOn ? readTarget(i) : null);
    } else if (phase === 'flying' && flying(s)) {
      cashOut(i, multAt(Date.now() - round.start));
    } else if (s.queued) {
      s.queued = null;
      save();
    } else {
      const bet = readBet(i);
      if (bet > wallet.balance) return toast('Fichas insuficientes para essa aposta.');
      s.queued = { bet, auto: s.autoOn ? readTarget(i) : null };
      save();
    }
    renderAll();
  }

  /* ---------------------------------------------------------
     Relógio: tudo é calculado pelo horário (funciona até com a aba em segundo plano)
  --------------------------------------------------------- */
  function tick() {
    const now = Date.now();
    if (phase === 'betting') {
      if (now >= phaseEnd) startFlight();
    } else if (phase === 'flying') {
      const m = multAt(now - round.start);
      // retirada automática no alvo exato, se ele vier antes de o astronauta sumir
      C.slots.forEach((s, i) => { const a = s.active; if (flying(s) && a.auto && a.auto <= round.crash && m >= a.auto) cashOut(i, a.auto); });
      // jogadores simulados
      round.bots.forEach(b => { if (!b.cashedAt && b.target <= round.crash && m >= b.target) { b.cashedAt = b.target; renderPlayers(); } });
      if (m >= round.crash) {
        if (round.crash >= CAP) {
          C.slots.forEach((s, i) => { if (flying(s)) cashOut(i, CAP); });
          round.bots.forEach(b => { if (!b.cashedAt) b.cashedAt = CAP; });
        }
        doCrash();
      }
    } else if (phase === 'crashed') {
      if (now >= phaseEnd) startBetting();
    }
  }

  /* ---------------------------------------------------------
     Desenho do gráfico
  --------------------------------------------------------- */
  const PAD = { l: 52, r: 26, t: 22, b: 34 };
  let view = { w: 0, h: 0, tMax: 8000, yMax: 2 };

  function tipPoint(t) {
    const { w, h, tMax, yMax } = view;
    const pw = w - PAD.l - PAD.r, ph = h - PAD.t - PAD.b;
    return {
      x: PAD.l + (t / tMax) * pw,
      y: h - PAD.b - ((multAt(t) - 1) / (yMax - 1)) * ph,
    };
  }

  function resize() {
    const r = el.stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = r.width;
    view.h = r.height;
    el.canvas.width = Math.round(r.width * dpr);
    el.canvas.height = Math.round(r.height * dpr);
    el.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.3, p: Math.random() * 6 }));
    draw();
  }

  function niceStep(range) {
    for (const s of [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]) if (range / s <= 4.5) return s;
    return 1000;
  }

  function draw() {
    const ctx = el.ctx, { w, h } = view;
    if (!w) return;
    const now = Date.now();
    let t = 0;
    if (phase === 'flying') t = now - round.start;
    else if (phase === 'crashed' && round) t = timeFor(round.crash);
    const m = multAt(t);
    view.tMax = Math.max(8000, t * 1.18);
    view.yMax = Math.max(2, 1 + (m - 1) * 1.25);

    ctx.clearRect(0, 0, w, h);
    // estrelas piscando
    stars.forEach(s => {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(now / 700 + s.p);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * (h - PAD.b), s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // grade e eixo do multiplicador
    const pw = w - PAD.l - PAD.r, ph = h - PAD.t - PAD.b;
    const step = niceStep(view.yMax - 1);
    ctx.font = '700 12px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    // marcas redondas: 1x e depois múltiplos do passo (1,25x · 1,5x… ou 1.000x · 2.000x…)
    const marks = [1];
    for (let v = Math.floor(1 / step + 1) * step; v <= view.yMax + 1e-9; v += step) marks.push(v);
    for (const v of marks) {
      const y = h - PAD.b - ((v - 1) / (view.yMax - 1)) * ph;
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillText(fmtX(v).replace(',00x', 'x'), PAD.l - 8, y);
    }
    // eixo do tempo
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tStep = view.tMax > 30000 ? 10000 : view.tMax > 14000 ? 5000 : 2000;
    for (let s = 0; s <= view.tMax; s += tStep) {
      const x = PAD.l + (s / view.tMax) * pw;
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillText(`${Math.round(s / 1000)}s`, x, h - PAD.b + 8);
    }

    if (phase === 'betting' || !round) {
      placeRocket(PAD.l, h - PAD.b, -12);
      return;
    }

    // curva com brilho e área preenchida
    const N = 80, pts = [];
    for (let i = 0; i <= N; i++) pts.push(tipPoint((t * i) / N));
    const crashed = phase === 'crashed';
    const grad = ctx.createLinearGradient(PAD.l, 0, w - PAD.r, 0);
    grad.addColorStop(0, crashed ? '#ff5468' : '#ff3d7f');
    grad.addColorStop(1, crashed ? '#ff8a8a' : '#ffc940');
    const fill = ctx.createLinearGradient(0, pts[pts.length - 1].y, 0, h - PAD.b);
    fill.addColorStop(0, crashed ? 'rgba(255,84,104,.35)' : 'rgba(255,201,64,.32)');
    fill.addColorStop(1, 'rgba(255,61,127,0)');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, h - PAD.b);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, h - PAD.b);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = crashed ? 'rgba(255,84,104,.8)' : 'rgba(255,201,64,.8)';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = grad;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // marca da retirada automática de cada aposta
    C.slots.forEach((s, i) => {
      const a = s.active;
      if (!flying(s) || !a.auto || a.auto >= view.yMax) return;
      const y = h - PAD.b - ((a.auto - 1) / (view.yMax - 1)) * ph;
      const color = i ? '255,95,162' : '25,211,162';
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = `rgba(${color},.7)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgb(${color})`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`retirada automática${C.second ? ` ${i + 1}` : ''} ${fmtX(a.auto)}`, w - PAD.r - 4, y - 4);
    });

    const tip = pts[pts.length - 1], prev = pts[pts.length - 4] || pts[0];
    const ang = Math.atan2(tip.y - prev.y, tip.x - prev.x) * 180 / Math.PI;
    if (crashed) el.rocket.style.opacity = '0';
    else placeRocket(tip.x, tip.y, ang);
  }

  let rocketAng = -12;          // direção do voo (para o astronauta sair na mesma direção)
  function placeRocket(x, y, ang) {
    rocketAng = ang;
    el.rocket.style.opacity = '1';
    el.rocket.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${ang}deg)`;
  }

  /* ---------------------------------------------------------
     Tela
  --------------------------------------------------------- */
  function setMult(text) {
    if (el.mult.textContent !== text) el.mult.textContent = text;
    el.mult.classList.toggle('long', text.length > 7);
  }

  function renderHud() {
    const now = Date.now();
    if (phase === 'betting') {
      const left = Math.max(0, phaseEnd - now);
      setMult('1,00x');
      el.sub.textContent = `Decolagem em ${Math.ceil(left / 1000)}s`;
      el.countFill.style.width = `${(left / BET_MS) * 100}%`;
    } else if (phase === 'flying') {
      setMult(fmtX(multAt(now - round.start)));
      const act = C.slots.map(s => s.active).filter(Boolean);
      el.sub.textContent = !act.length ? 'Voando…' : act.some(a => !a.cashedAt) ? 'Retire antes de ele sumir!'
        : `Você retirou em ${fmtX(Math.max(...act.map(a => a.cashedAt)))}`;
    } else {
      setMult(fmtX(round.crash));
      el.sub.textContent = round.crash >= CAP ? 'Vela máxima! Todos receberam 10.000x' : 'Sumiu no espaço!';
    }
    renderButtons();
  }

  function renderButtons() { P.forEach((_, i) => renderButton(i)); }
  function renderButton(i) {
    const s = C.slots[i], b = P[i].btn;
    let label, sub = '', cls = '';
    const a = s.active;
    if (phase === 'betting') {
      if (s.placed) {
        cls = 'cancel';
        label = 'Cancelar aposta';
        sub = `${fmt(s.placed.bet)}${s.placed.auto ? ` · retira em ${fmtX(s.placed.auto)}` : ''}`;
      } else {
        label = 'Apostar';
        sub = fmt(readBet(i));
      }
    } else if (phase === 'flying' && flying(s)) {
      cls = 'cashout';
      label = 'Retirar';
      sub = fmt(Math.floor(a.bet * multAt(Date.now() - round.start)));
    } else if (s.queued) {
      cls = 'cancel';
      label = 'Cancelar';
      sub = `aposta de ${fmt(s.queued.bet)} na próxima rodada`;
    } else {
      cls = 'waiting';
      label = 'Apostar na próxima';
      sub = fmt(readBet(i));
    }
    b.classList.toggle('cashout', cls === 'cashout');
    b.classList.toggle('cancel', cls === 'cancel');
    b.classList.toggle('waiting', cls === 'waiting');
    if (P[i].label.textContent !== label) P[i].label.textContent = label;
    if (P[i].sub.textContent !== sub) P[i].sub.textContent = sub;
  }

  function renderPlayers() {
    const rows = [];
    const crashed = phase === 'crashed';
    C.slots.forEach((s, i) => {
      const a = s.active, meBet = a ? a.bet : s.placed ? s.placed.bet : 0;
      if (!meBet) return;
      let res = 'apostou', cls = 'me';
      if (a && a.cashedAt) { res = `${fmtX(a.cashedAt)} · +${fmt(Math.floor(a.bet * a.cashedAt))}`; cls += ' won'; }
      rows.push({ name: C.second ? `Você · ${i + 1}` : 'Você', avatar: 'av-you', ring: 'ring-you', bet: meBet, res, cls });
    });
    if (round) round.bots.forEach(bt => {
      let res = phase === 'betting' ? 'apostou' : '—', cls = '';
      if (bt.cashedAt) { res = `${fmtX(bt.cashedAt)} · +${fmt(Math.floor(bt.bet * bt.cashedAt))}`; cls = 'won'; }
      else if (crashed) { res = 'perdeu'; cls = 'lost'; }
      rows.push({ ...bt, res, cls });
    });
    el.playersCount.textContent = rows.length ? `${rows.length} jogadores` : '';
    el.players.innerHTML = rows.length ? rows.map(r =>
      `<li class="cr-player ${r.cls}"><span class="avatar ${r.ring}">${avatarImg(r.avatar)}</span>` +
      `<span class="pl-name"><b>${r.name}</b><small>${fmt(r.bet)}</small></span><span class="pl-result">${r.res}</span></li>`).join('')
      : '<li class="cr-player-empty">Ninguém apostou ainda</li>';
  }

  function renderAll() {
    el.history.innerHTML = C.history.length
      ? C.history.map(x => `<span class="cr-hist ${x >= 10 ? 'high' : x >= 2 ? 'mid' : 'low'}">${fmtX(x)}</span>`).join('')
      : '<span class="cr-hist">ainda não teve rodada</span>';
    el.rounds.textContent = C.rounds;
    el.best.textContent = C.best ? fmtX(C.best) : '–';
    el.net.textContent = (C.net > 0 ? '+' : C.net < 0 ? '−' : '') + fmt(Math.abs(C.net));
    el.net.style.color = C.net > 0 ? 'var(--teal)' : C.net < 0 ? '#ff8fab' : '';

    // valores de cada aposta ficam travados enquanto ela está em jogo
    C.slots.forEach((s, i) => {
      const locked = !!s.placed || flying(s) || !!s.queued;
      P[i].controls.forEach(x => { x.disabled = locked; });
      P[i].autoField.classList.toggle('off', !s.autoOn);
      if (P[i].remove) P[i].remove.disabled = locked;
    });
    // a Aposta 2 só aparece quando a pessoa pede
    P[1].root.hidden = !C.second;
    el.dock.classList.toggle('two', C.second);
    el.addBet.hidden = C.second;

    const anyPlaced = C.slots.some(s => s.placed), anyFlying = C.slots.some(flying);
    el.status.textContent = phase === 'betting' ? (anyPlaced ? 'Aposta feita! Espere a decolagem' : 'Apostas abertas: escolha o valor e aposte')
      : phase === 'flying' ? (anyFlying ? 'Clique em Retirar antes de o astronauta sumir' : 'Rodada em andamento')
      : 'O astronauta sumiu no espaço. Nova rodada em instantes';
    el.status.classList.toggle('mine', phase === 'flying' && anyFlying);
    renderPlayers();
    renderHud();
  }

  function loop() {
    tick();
    renderHud();
    draw();
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------
     Início e retomada
  --------------------------------------------------------- */
  // astronauta (arte em crash/astronauta.webp) com as chamas da mochila a jato
  function rocketHtml() {
    const flame = cls => `<svg class="cr-flame ${cls}" viewBox="0 0 60 40" aria-hidden="true">
      <g class="flame">
        <path d="M60 20C44 2 14 6 0 20c14 14 44 18 60 0z" fill="url(#cr-flame)"/>
        <path d="M60 20c-10-8-24-8-32 0 8 8 22 8 32 0z" fill="#fff6c8"/>
      </g>
    </svg>`;
    return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <linearGradient id="cr-flame" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff6c8"/><stop offset=".3" stop-color="#ffc940"/><stop offset=".7" stop-color="#ff6a2b"/><stop offset="1" stop-color="#ff3d7f" stop-opacity="0"/></linearGradient>
    </defs></svg>${flame('f1')}${flame('f2')}<img src="crash/astronauta.webp" alt="" draggable="false">`;
  }

  // painel de uma aposta: valor, retirada automática e o botão
  function panelHtml(i) {
    const quick = (list, k) => `<div class="cr-quick" data-k="${k}">${list.map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>`;
    return `<div class="cr-bet" data-i="${i}"${i ? ' hidden' : ''}>
      <div class="cr-bet-head"><b>Aposta ${i + 1}</b>${i ? '<button type="button" class="cr-bet-remove" aria-label="Fechar a Aposta 2">×</button>' : ''}</div>
      <div class="cr-bet-body">
        <div class="cr-field">
          <span class="cr-label">Valor</span>
          <div class="cr-amount">
            <button type="button" class="sl-step" data-k="half" aria-label="Metade">½</button>
            <input type="number" data-k="bet" min="1" step="1" inputmode="numeric" aria-label="Valor da aposta ${i + 1}">
            <button type="button" class="sl-step" data-k="double" aria-label="Dobrar">2x</button>
          </div>
          ${quick([[10, '$10'], [50, '$50'], [100, '$100'], [500, '$500']], 'bet-quick')}
        </div>
        <div class="cr-field">
          <label class="cr-label cr-auto-toggle"><input type="checkbox" data-k="auto-on"><span>Retirada automática</span></label>
          <div class="cr-amount">
            <button type="button" class="sl-step" data-k="minus" aria-label="Diminuir alvo">−</button>
            <input type="number" data-k="auto" min="1.01" max="10000" step="0.1" inputmode="decimal" aria-label="Retirar automaticamente em (aposta ${i + 1})">
            <span class="cr-x">x</span>
            <button type="button" class="sl-step" data-k="plus" aria-label="Aumentar alvo">+</button>
          </div>
          ${quick([[1.5, '1,5x'], [2, '2x'], [5, '5x'], [10, '10x']], 'auto-quick')}
        </div>
      </div>
      <button type="button" class="btn cr-main"><span class="cr-main-label">Apostar</span><small class="cr-main-sub"></small></button>
    </div>`;
  }

  function setupPanel(i) {
    const root = el.dock.querySelector(`.cr-bet[data-i="${i}"]`);
    const q = k => root.querySelector(`[data-k="${k}"]`);
    const p = {
      root, betInput: q('bet'), autoInput: q('auto'), autoOn: q('auto-on'),
      autoField: q('auto-on').closest('.cr-field'),
      btn: root.querySelector('.cr-main'), label: root.querySelector('.cr-main-label'), sub: root.querySelector('.cr-main-sub'),
      remove: root.querySelector('.cr-bet-remove'),
    };
    p.controls = [p.betInput, p.autoInput, p.autoOn, ...root.querySelectorAll('.cr-amount button, .cr-quick button')];
    P[i] = p;
    const s = C.slots[i];
    p.betInput.value = s.bet;
    p.autoInput.value = s.autoTarget.toFixed(2);
    p.autoOn.checked = s.autoOn;
    const setBet = v => { s.bet = clamp(Math.floor(v) || 1, 1, 1e9); p.betInput.value = s.bet; save(); renderButton(i); };
    const setTarget = v => { s.autoTarget = clamp(Math.round(v * 100) / 100, 1.01, MAX_TARGET); p.autoInput.value = s.autoTarget.toFixed(2); save(); renderButton(i); };
    p.betInput.addEventListener('change', () => setBet(Number(p.betInput.value)));
    p.betInput.addEventListener('input', () => renderButton(i));
    q('half').addEventListener('click', () => setBet(Math.max(1, Math.floor(readBet(i) / 2))));
    q('double').addEventListener('click', () => setBet(Math.min(readBet(i) * 2, Math.max(1, wallet.balance))));
    q('bet-quick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => setBet(Number(b.dataset.v))));
    p.autoInput.addEventListener('change', () => setTarget(readTarget(i)));
    q('minus').addEventListener('click', () => setTarget(readTarget(i) - (readTarget(i) > 3 ? 0.5 : 0.1)));
    q('plus').addEventListener('click', () => setTarget(readTarget(i) + (readTarget(i) >= 3 ? 0.5 : 0.1)));
    q('auto-quick').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      setTarget(Number(b.dataset.v));
      if (!s.autoOn) { s.autoOn = true; p.autoOn.checked = true; save(); renderAll(); }
    }));
    p.autoOn.addEventListener('change', () => { s.autoOn = p.autoOn.checked; save(); renderAll(); });
    p.btn.addEventListener('click', () => mainAction(i));
    if (p.remove) p.remove.addEventListener('click', () => {
      if (s.placed || flying(s) || s.queued) return;
      C.second = false;
      save();
      renderAll();
    });
  }

  function init() {
    Object.assign(el, {
      stage: $('#stage'), canvas: $('#canvas'), rocket: $('#rocket'), boom: $('#boom'),
      mult: $('#mult'), sub: $('#sub'), countFill: $('#countdown-fill'), cashpop: $('#cashpop'),
      history: $('#history'), players: $('#players'), playersCount: $('#players-count'), log: $('#log'),
      dock: $('#bets'), addBet: $('#add-bet'),
      status: $('#status'), rounds: $('#info-rounds'), best: $('#info-best'), net: $('#info-net'),
    });
    el.ctx = el.canvas.getContext('2d');
    el.rocket.innerHTML = rocketHtml();

    const saved = loadSave();
    C = saved || fresh();
    C.logs.forEach(([m, c]) => appendLog(m, c));
    if (!saved) log('Bem-vindo ao Space Fest! Aposte e retire antes de o astronauta sumir no espaço.', 'sep');

    // os dois painéis de aposta (o segundo só aparece com "+ Aposta 2")
    el.dock.innerHTML = panelHtml(0) + panelHtml(1);
    setupPanel(0);
    setupPanel(1);
    el.addBet.addEventListener('click', () => { C.second = true; save(); renderAll(); P[1].betInput.focus(); });
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const onControl = e.target.closest && e.target.closest('button, input, label');
      if ((e.key === ' ' || e.key === 'Enter') && !onControl) { e.preventDefault(); mainAction(0); }
    });

    wallet.setRefillGuard(() => (C.slots.some(flying) ? 'Espere a rodada terminar para recarregar.' : null));
    wallet.onChange(() => renderButtons());

    // voltou com aposta no ar: resolve pelo relógio ou continua o voo
    const live = C.slots.map((s, i) => [s, i]).filter(([s]) => s.active);
    if (live.length) {
      const a0 = live[0][0].active;
      phase = 'flying';
      round = { start: a0.start, crash: a0.crash, bots: [] };
      if (Date.now() - a0.start < timeFor(a0.crash)) {
        el.stage.className = 'cr-stage flying';
        toast('Seu astronauta ainda está no ar!');
      } else {
        // a retirada automática (ou a vela máxima) teria pago antes de ele sumir
        live.forEach(([s, i]) => {
          const a = s.active;
          const payAt = a.auto && a.auto <= a.crash ? a.auto : a.crash >= CAP ? CAP : 0;
          if (!a.cashedAt && payAt) cashOut(i, payAt);
          else if (!a.cashedAt) log(`Enquanto você estava fora, o astronauta sumiu em ${fmtX(a.crash)}: perdeu ${fmt(a.bet)}${tag(i)}.`);
        });
        C.history.unshift(a0.crash);
        C.history = C.history.slice(0, 24);
        C.slots.forEach(s => { s.active = null; });
        save();
        startBetting();
      }
    } else startBetting();

    new ResizeObserver(resize).observe(el.stage);
    resize();
    renderAll();
    setInterval(() => { tick(); renderHud(); }, 250);   // mantém a rodada certa mesmo sem animação (aba em segundo plano)
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
