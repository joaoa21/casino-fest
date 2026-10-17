/* ==========================================================
   Casino Fest · Slots — tela, animação e modo bônus
   Máquinas e matemática ficam em slots-math.js.
   As fichas são as da carteira única do cassino (casino.js).
   ========================================================== */
(() => {
  'use strict';

  const { fmt, $, toast, confetti, wallet, auto, sfx } = window.Casino;
  const { MACHINES } = window.SlotsMath;

  const SAVE_KEY = 'casinofest:slots:v1';
  const LINE_COLORS = ['#ffc940', '#ff3d7f', '#19d3a2', '#7b9bff', '#ff8a2a', '#c77dff', '#3fd6f0', '#ff5468', '#9cff57', '#ffffff'];
  const NAMES = { cherry: 'Cereja', lemon: 'Limão', grape: 'Uva', bell: 'Sino', bar: 'BAR', diamond: 'Diamante', seven: 'Sete', crown: 'Coroa', star: 'Estrela', wheel: 'Roda', blank: '' };
  const PLURAL = { cherry: 'Cerejas', lemon: 'Limões', grape: 'Uvas', bell: 'Sinos', bar: 'BAR', diamond: 'Diamantes', seven: 'Setes', crown: 'Coroas', star: 'Estrelas', wheel: 'Rodas' };

  // como cada máquina aparece na tela
  const META = {
    coroa: { sub: '5 rolos · 10 linhas · com modo bônus', pick: '5 rolos · bônus', art: {} },
    classico: { sub: '3 rolos · 5 linhas · a coroa dobra o prêmio', pick: '3 rolos · clássica', art: { crown: 'crown2' } },
  };

  /* ---------------------------------------------------------
     Símbolos (SVG próprios, no estilo da marca)
  --------------------------------------------------------- */
  const O = '#3d0f68';
  const starPath = (cx, cy, R, r) => Array.from({ length: 10 }, (_, k) => {
    const a = (-90 + k * 36) * Math.PI / 180, rad = k % 2 ? r : R;
    return `${k ? 'L' : 'M'}${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`;
  }).join('') + 'Z';
  const ribbon = (txt, size) => `<rect x="12" y="66" width="76" height="23" rx="11.5" fill="url(#sl-pink)" stroke="${O}" stroke-width="3"/>` +
    `<text x="50" y="83.5" text-anchor="middle" font-family="'Luckiest Guy', 'Lilita One', sans-serif" font-size="${size}" letter-spacing="1" fill="#fff" stroke="${O}" stroke-width="3" paint-order="stroke">${txt}</text>`;

  document.body.insertAdjacentHTML('afterbegin', `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="sl-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7183"/><stop offset=".55" stop-color="#e3203f"/><stop offset="1" stop-color="#a30f2b"/></linearGradient>
    <linearGradient id="sl-yellow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7a8"/><stop offset=".5" stop-color="#ffd61f"/><stop offset="1" stop-color="#e99a00"/></linearGradient>
    <linearGradient id="sl-purple" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfa8ff"/><stop offset=".5" stop-color="#8a4dff"/><stop offset="1" stop-color="#4f1fb8"/></linearGradient>
    <linearGradient id="sl-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8cf5b4"/><stop offset="1" stop-color="#159c55"/></linearGradient>
    <linearGradient id="sl-cyan" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4fdff"/><stop offset=".45" stop-color="#4fdcf5"/><stop offset="1" stop-color="#1679c4"/></linearGradient>
    <linearGradient id="sl-pink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc2df"/><stop offset=".5" stop-color="#ff3d9a"/><stop offset="1" stop-color="#b80f63"/></linearGradient>

    <symbol id="sym-cherry" viewBox="0 0 100 100">
      <path d="M36 56C38 40 48 28 62 17M66 58c-2-17-3-30-4-41" fill="none" stroke="#1f7a43" stroke-width="5" stroke-linecap="round"/>
      <path d="M62 17c9-8 24-7 29 2-10 6-21 6-29-2z" fill="url(#sl-green)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="35" cy="68" r="18" fill="url(#sl-red)" stroke="${O}" stroke-width="4"/>
      <circle cx="67" cy="71" r="18" fill="url(#sl-red)" stroke="${O}" stroke-width="4"/>
      <ellipse cx="28" cy="61" rx="6" ry="4" fill="#fff" opacity=".75" transform="rotate(-35 28 61)"/>
      <ellipse cx="60" cy="64" rx="6" ry="4" fill="#fff" opacity=".75" transform="rotate(-35 60 64)"/>
    </symbol>
    <symbol id="sym-lemon" viewBox="0 0 100 100">
      <ellipse cx="13" cy="60" rx="7" ry="5" fill="url(#sl-yellow)" stroke="${O}" stroke-width="3.5" transform="rotate(-15 13 60)"/>
      <ellipse cx="87" cy="40" rx="7" ry="5" fill="url(#sl-yellow)" stroke="${O}" stroke-width="3.5" transform="rotate(-15 87 40)"/>
      <ellipse cx="50" cy="50" rx="36" ry="27" fill="url(#sl-yellow)" stroke="${O}" stroke-width="4" transform="rotate(-15 50 50)"/>
      <path d="M30 40c6-8 16-12 26-12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".75"/>
      <g fill="#e99a00" opacity=".45"><circle cx="58" cy="58" r="1.8"/><circle cx="66" cy="50" r="1.8"/><circle cx="44" cy="62" r="1.8"/><circle cx="72" cy="60" r="1.8"/></g>
    </symbol>
    <symbol id="sym-grape" viewBox="0 0 100 100">
      <path d="M50 26c1-6 4-11 8-14" fill="none" stroke="#7a4a1c" stroke-width="5" stroke-linecap="round"/>
      <path d="M56 20c8-9 22-8 28 1-10 6-20 6-28-1z" fill="url(#sl-green)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <g fill="url(#sl-purple)" stroke="${O}" stroke-width="3.5">
        <circle cx="30" cy="38" r="12"/><circle cx="50" cy="36" r="12"/><circle cx="70" cy="38" r="12"/>
        <circle cx="40" cy="56" r="12"/><circle cx="60" cy="56" r="12"/><circle cx="50" cy="74" r="12"/>
      </g>
      <g fill="#fff" opacity=".7"><circle cx="26" cy="33" r="3"/><circle cx="46" cy="31" r="3"/><circle cx="66" cy="33" r="3"/><circle cx="36" cy="51" r="3"/><circle cx="56" cy="51" r="3"/><circle cx="46" cy="69" r="3"/></g>
    </symbol>
    <symbol id="sym-bell" viewBox="0 0 100 100">
      <circle cx="50" cy="13" r="6" fill="url(#lg-gold)" stroke="${O}" stroke-width="3.5"/>
      <circle cx="50" cy="83" r="8" fill="url(#lg-gold)" stroke="${O}" stroke-width="3.5"/>
      <path d="M50 17c-20 0-28 16-28 34v12L13 74h74l-9-11V51c0-18-8-34-28-34z" fill="url(#lg-gold)" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
      <rect x="12" y="71" width="76" height="9" rx="4.5" fill="url(#lg-gold)" stroke="${O}" stroke-width="3.5"/>
      <path d="M34 31c-4 8-5 18-5 28" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>
    </symbol>
    <symbol id="sym-bar" viewBox="0 0 100 100">
      <rect x="7" y="27" width="86" height="46" rx="11" fill="#1d1533" stroke="url(#lg-gold)" stroke-width="5"/>
      <rect x="13" y="33" width="74" height="34" rx="7" fill="none" stroke="rgba(255,201,64,.4)" stroke-width="1.5"/>
      <text x="50" y="62" text-anchor="middle" font-family="'Lilita One', sans-serif" font-size="30" letter-spacing="2" fill="url(#lg-gold)" stroke="${O}" stroke-width="3" paint-order="stroke">BAR</text>
    </symbol>
    <symbol id="sym-diamond" viewBox="0 0 100 100">
      <path d="M29 20h42l20 21-41 47L9 41z" fill="url(#sl-cyan)" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M9 41h82M29 20l11 21 10 47 10-47 11-21M40 41l10-21 10 21" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linejoin="round"/>
      <use href="#sparkle" x="70" y="6" width="18" height="18" color="#fff"/>
    </symbol>
    <symbol id="sym-seven" viewBox="0 0 100 100">
      <text x="50" y="86" text-anchor="middle" font-family="'Luckiest Guy', 'Lilita One', sans-serif" font-size="92" fill="${O}" stroke="${O}" stroke-width="10" stroke-linejoin="round">7</text>
      <text x="50" y="86" text-anchor="middle" font-family="'Luckiest Guy', 'Lilita One', sans-serif" font-size="92" fill="url(#sl-red)" stroke="url(#lg-gold)" stroke-width="2.5" stroke-linejoin="round" paint-order="stroke">7</text>
    </symbol>
    <symbol id="sym-crown" viewBox="0 0 100 100">
      <use href="#crown" x="11" y="10" width="78" height="52"/>${ribbon('CORINGA', 15)}
    </symbol>
    <symbol id="sym-crown2" viewBox="0 0 100 100">
      <use href="#crown" x="11" y="10" width="78" height="52"/>${ribbon('DOBRA 2X', 14)}
    </symbol>
    <symbol id="sym-wheel" viewBox="0 0 100 100">
      <circle cx="50" cy="44" r="34" fill="url(#lg-gold)" stroke="${O}" stroke-width="4"/>
      <g stroke="${O}" stroke-width="1.5">
        <path d="M50 44 50 14A30 30 0 0 1 71.2 22.8Z" fill="#ff3d7f"/><path d="M50 44 71.2 22.8A30 30 0 0 1 80 44Z" fill="#7b4dff"/>
        <path d="M50 44 80 44A30 30 0 0 1 71.2 65.2Z" fill="#19d3a2"/><path d="M50 44 71.2 65.2A30 30 0 0 1 50 74Z" fill="#ff8a2a"/>
        <path d="M50 44 50 74A30 30 0 0 1 28.8 65.2Z" fill="#ff3d7f"/><path d="M50 44 28.8 65.2A30 30 0 0 1 20 44Z" fill="#7b4dff"/>
        <path d="M50 44 20 44A30 30 0 0 1 28.8 22.8Z" fill="#19d3a2"/><path d="M50 44 28.8 22.8A30 30 0 0 1 50 14Z" fill="#ff8a2a"/>
      </g>
      <circle cx="50" cy="44" r="8" fill="url(#lg-gold)" stroke="${O}" stroke-width="3"/>
      <path d="M43 6h14l-7 11z" fill="#fff" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      ${ribbon('BÔNUS', 16)}
    </symbol>
    <symbol id="sym-star" viewBox="0 0 100 100">
      <path d="${starPath(50, 53, 44, 20)}" fill="url(#sl-pink)" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
      <path d="${starPath(50, 53, 24, 11)}" fill="#ffd6ea" opacity=".55"/>
      <use href="#sparkle" x="74" y="4" width="18" height="18" color="#ffc940"/>
      <use href="#sparkle" x="6" y="12" width="12" height="12" color="#fff"/>
    </symbol>
  </defs></svg>`);

  let mach = null;                                       // máquina atual (matemática)
  const art = s => (META[mach.id].art[s] || s);
  const symSvg = s => (s === 'blank' ? '' : `<svg viewBox="0 0 100 100" aria-label="${NAMES[s]}"><use href="#sym-${art(s)}"/></svg>`);

  /* ---------------------------------------------------------
     Estado e salvamento
  --------------------------------------------------------- */
  let S = null;
  const el = {};
  let spinning = false, autoLeft = 0;
  let cycleTimer = 0, overlayTimer = 0, overlayDone = null, bonusTimer = 0;
  let lastItems = null;      // prêmios do último giro (para acender a tabela)

  const cur = () => S.m[mach.id];
  const isWheel = b => !!b && b.type === 'wheel';
  // o resultado da roda é sorteado e salvo na hora em que o bônus abre
  const newWheelBonus = (bet, bought) => ({ type: 'wheel', bet, bought, pending: true, spun: false, result: randInt(mach.bonus.wheel.length) });
  let wheelAngle = 0;
  const freshMachine = m => ({ bet: m.bets[0], spins: 0, net: 0, best: 0, stops: m.randomStops(randInt), bonusStops: false, bonus: null });

  function fresh() {
    return { v: 2, current: 'coroa', turbo: false, logs: [], m: Object.fromEntries(Object.entries(MACHINES).map(([id, m]) => [id, freshMachine(m)])) };
  }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s) return null;
      if (s.v === 1) {
        // versão antiga (só a Coroa da Sorte): aproveita aposta e números
        const n = fresh();
        Object.assign(n.m.coroa, { bet: MACHINES.coroa.bets.includes(s.bet) ? s.bet : 10, spins: s.spins || 0, net: s.net || 0, best: s.best || 0 });
        n.turbo = !!s.turbo;
        n.logs = Array.isArray(s.logs) ? s.logs : [];
        return n;
      }
      if (s.v !== 2 || !s.m || !MACHINES[s.current]) return null;
      for (const [id, m] of Object.entries(MACHINES)) {
        const st = s.m[id];
        if (!st || !Array.isArray(st.stops) || st.stops.length !== m.reels) s.m[id] = freshMachine(m);
        else if (!m.bets.includes(st.bet)) st.bet = m.bets[0];
      }
      return s;
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* sem armazenamento */ }
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

  // sorteio sem viés com o gerador criptográfico do navegador
  function randInt(n) {
    const a = new Uint32Array(1), lim = 4294967296 - (4294967296 % n);
    do crypto.getRandomValues(a); while (a[0] >= lim);
    return a[0] % n;
  }

  /* ---------------------------------------------------------
     Rolos
  --------------------------------------------------------- */
  const cellHtml = s => `<div class="cell" data-s="${s}">${symSvg(s)}</div>`;

  function buildReels() {
    const st = cur();
    const grid = mach.gridFromStops(st.stops, st.bonusStops);
    el.reels.style.setProperty('--reels', mach.reels);
    el.reels.innerHTML = grid.map(col => `<div class="reel"><div class="strip">${col.map(cellHtml).join('')}</div></div>`).join('');
    el.strips = [...el.reels.querySelectorAll('.strip')];
    el.paylines.setAttribute('viewBox', `0 0 ${mach.reels * 100} ${mach.rows * 100}`);
  }

  // a fita desce mostrando símbolos de passagem e para no resultado
  function spinReel(r, finalCol, duration, fillers, bonus) {
    return new Promise(resolve => {
      const strip = el.strips[r];
      const current = [...strip.children].slice(0, mach.rows).map(c => c.dataset.s);
      const tape = (bonus ? mach.bonusStrips : mach.strips)[r];
      const filler = Array.from({ length: fillers }, () => tape[randInt(tape.length)]);
      strip.innerHTML = [...finalCol, ...filler, ...current].map(cellHtml).join('');
      const cell = strip.parentElement.clientHeight / mach.rows;
      strip.style.transition = 'none';
      strip.style.transform = `translateY(${-(fillers + mach.rows) * cell}px)`;
      void strip.offsetHeight;
      strip.classList.add('moving');
      strip.style.transition = `transform ${duration}ms cubic-bezier(.12, .62, .22, 1.04)`;
      strip.style.transform = 'translateY(0)';
      const unblur = setTimeout(() => strip.classList.remove('moving'), Math.max(0, duration - 260));
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(unblur);
        strip.classList.remove('moving');
        strip.style.transition = 'none';
        strip.style.transform = 'none';
        strip.innerHTML = finalCol.map(cellHtml).join('');
        resolve();
      };
      strip.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, duration + 150);   // garante o fim mesmo com a aba em segundo plano
    });
  }

  /* ---------------------------------------------------------
     Giro (normal ou grátis)
  --------------------------------------------------------- */
  async function spin() {
    if (spinning) return;
    const st = cur(), m = mach;
    if (isWheel(st.bonus)) return;
    const free = !!st.bonus && !st.bonus.pending;
    if (st.bonus && !free) return;
    const bet = free ? st.bonus.bet : st.bet;
    if (!free && bet > wallet.balance) {
      stopAuto();
      return toast(wallet.balance < m.bets[0] ? 'Sem fichas: use o + no topo para recarregar.' : 'Fichas insuficientes para essa aposta. Diminua o valor.');
    }
    clearWin();

    // resultado e pagamento decididos e salvos antes da animação
    const stops = m.randomStops(randInt, free);
    const grid = m.gridFromStops(stops, free);
    const res = m.evaluate(grid, bet, free ? m.bonus.mult : 1);
    st.stops = stops;
    st.bonusStops = free;
    if (free) {
      st.bonus.left--;
      st.bonus.played++;
      st.bonus.total += res.total;
      if (res.bonusSpins) st.bonus.left += res.bonusSpins;
    } else {
      st.spins++;
      st.net -= bet;
      wallet.add(-bet);
      if (res.bonusSpins) st.bonus = { left: res.bonusSpins, played: 0, total: 0, bet, bought: false, pending: true };
      else if (res.bonusTrigger && m.bonus && m.bonus.type === 'wheel') st.bonus = newWheelBonus(bet, false);
    }
    st.net += res.total;
    st.best = Math.max(st.best, res.total);
    save();

    const turbo = S.turbo || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const durations = grid.map((_, r) => (turbo ? 340 + r * 85 : 900 + r * (m.reels === 3 ? 380 : 260)));
    const total = durations[durations.length - 1];
    if (res.total > 0) wallet.add(res.total, { delay: total });

    spinning = true;
    sfx.play('spin');
    setWinbar(null, 'Girando…');
    renderControls();
    await Promise.all(grid.map((col, r) => spinReel(r, col, durations[r], turbo ? 6 + r * 2 : 14 + r * 5, free)));
    spinning = false;

    lastItems = null;
    present(res, bet, free);
    renderAll();
    if (lastItems) highlightPays(lastItems);
    afterSpin(res, bet, free);
  }

  function afterSpin(res, bet, free) {
    const st = cur();
    const pause = res.total ? 1500 : 500;
    if (isWheel(st.bonus)) {
      stopAuto();
      log('3 rodas! A Roda da Fortuna foi liberada.', 'win');
      setTimeout(() => announceWheel('3 rodas!'), pause);
    } else if (st.bonus && st.bonus.pending) {
      // 3 estrelas: anuncia o bônus e começa os giros grátis
      stopAuto();
      log(`3 estrelas! Bônus de ${st.bonus.left} giros grátis com prêmios x${mach.bonus.mult}.`, 'win');
      setTimeout(() => announceBonus('3 estrelas!'), pause);
    } else if (st.bonus) {
      if (free && res.bonusSpins) toast(`Mais ${res.bonusSpins} giros grátis!`);
      if (st.bonus.left > 0) bonusTimer = setTimeout(runBonus, pause);
      else bonusTimer = setTimeout(endBonus, pause);
    } else if (autoLeft > 0) {
      autoLeft--;
      if (auto.stopsOn(res.total, bet)) autoLeft = 0;
      renderControls();
      if (autoLeft > 0) setTimeout(() => { if (autoLeft > 0 && !spinning) spin(); }, pause);
    }
  }

  /* ---------------------------------------------------------
     Modo bônus
  --------------------------------------------------------- */
  function announceBonus(kicker) {
    const st = cur();
    if (!st.bonus) return;
    confetti(160, el.machine);
    showOverlay({ kicker, title: 'Bônus!', amount: `${st.bonus.left} giros grátis`, hint: `Todos os prêmios valem x${mach.bonus.mult}` }, 2600, () => {
      st.bonus.pending = false;
      save();
      renderAll();
      runBonus();
    });
    renderAll();
  }
  function runBonus() {
    clearTimeout(bonusTimer);
    const st = cur();
    if (!st.bonus || isWheel(st.bonus) || st.bonus.pending || spinning || !el.overlay.hidden) return;
    if (st.bonus.left <= 0) return endBonus();
    spin();
  }
  function endBonus() {
    const st = cur();
    if (!st.bonus) return;
    const b = st.bonus;
    st.bonus = null;
    log(`Bônus encerrado: ${b.played} giros grátis renderam ${fmt(b.total)}.`, 'win');
    save();
    const x = b.total / b.bet;
    if (x >= 10) confetti(x >= 50 ? 260 : 160, el.machine);
    showOverlay({
      kicker: 'Fim do bônus',
      title: x >= 50 ? 'Bônus gigante!' : x >= 15 ? 'Que bônus!' : 'Bônus encerrado',
      amount: fmt(b.total),
      hint: `${b.played} giros grátis`,
    }, 3200);
    renderAll();
  }

  /* Roda da Fortuna */
  function buildWheel() {
    const vals = mach.bonus.wheel, n = vals.length, step = 360 / n, C = 200, R = 182;
    const p = (r, a) => `${(C + r * Math.sin(a * Math.PI / 180)).toFixed(1)} ${(C - r * Math.cos(a * Math.PI / 180)).toFixed(1)}`;
    const palette = ['#ff3d7f', '#7b4dff', '#19d3a2', '#ff8a2a', '#3fd6f0', '#c77dff'];
    let seg = '', txt = '', bulbs = '';
    vals.forEach((v, i) => {
      const a0 = i * step - step / 2, a1 = a0 + step;
      const fill = v >= 250 ? '#1c0736' : v >= 100 ? 'url(#lg-gold)' : palette[i % palette.length];
      seg += `<path d="M${C} ${C}L${p(R, a0)}A${R} ${R} 0 0 1 ${p(R, a1)}Z" fill="${fill}"/>`;
      const color = v >= 250 ? 'url(#lg-gold)' : '#fff';
      txt += `<text transform="rotate(${i * step} ${C} ${C})" x="${C}" y="${C - R + 46}" text-anchor="middle" font-family="'Luckiest Guy', sans-serif" font-size="${v >= 100 ? 30 : 27}" fill="${color}" stroke="#3d0f68" stroke-width="5" paint-order="stroke">${v}x</text>`;
      bulbs += `<circle cx="${p(R + 8, a0).split(' ')[0]}" cy="${p(R + 8, a0).split(' ')[1]}" r="4.5" fill="#fff6c8"/>`;
    });
    el.wheelDisc.innerHTML = `<svg viewBox="0 0 400 400" aria-hidden="true">
      <circle cx="200" cy="200" r="196" fill="#2a0d55" stroke="url(#lg-gold)" stroke-width="6"/>
      <g stroke="#3d0f68" stroke-width="2">${seg}</g>${txt}${bulbs}
      <circle cx="200" cy="200" r="44" fill="url(#lg-gold)" stroke="#3d0f68" stroke-width="5"/>
      <use href="#crown" x="170" y="182" width="60" height="40"/></svg>`;
    el.wheelDisc.style.transition = 'none';
    el.wheelDisc.style.transform = `rotate(${wheelAngle}deg)`;
  }
  function announceWheel(kicker) {
    const st = cur();
    if (!isWheel(st.bonus)) return;
    confetti(160, el.machine);
    const top = Math.max(...mach.bonus.wheel);
    showOverlay({ kicker, title: 'Roda da Fortuna!', amount: `Até ${top}x a aposta`, hint: 'Toque para ir para a roda' }, 2400, () => {
      st.bonus.pending = false;
      save();
      openWheel();
    });
    renderAll();
  }
  function openWheel() {
    buildWheel();
    el.wheelTitle.textContent = 'Gire a roda!';
    el.wheelSpin.disabled = false;
    el.wheelSpin.hidden = false;
    el.wheelPanel.classList.remove('done');
    el.wheelPanel.hidden = false;
    renderAll();
  }
  function spinWheel() {
    const st = cur(), b = st.bonus;
    if (!isWheel(b) || b.pending || b.spun || el.wheelPanel.hidden) return;
    const vals = mach.bonus.wheel, step = 360 / vals.length;
    const mult = vals[b.result], win = mult * b.bet;
    b.spun = true;
    st.net += win;
    st.best = Math.max(st.best, win);
    save();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduced ? 900 : 4800;
    wallet.add(win, { delay: dur });
    // para com a fatia sorteada embaixo do ponteiro, num ponto aleatório dela
    const jitter = (Math.random() - 0.5) * step * 0.7;
    const targetMod = ((-b.result * step + jitter) % 360 + 360) % 360;
    const curMod = ((wheelAngle % 360) + 360) % 360;
    wheelAngle += 360 * 6 + ((targetMod - curMod + 360) % 360);
    el.wheelSpin.disabled = true;
    el.wheelTitle.textContent = 'Girando…';
    el.wheelDisc.style.transition = `transform ${dur}ms cubic-bezier(.15, .7, .2, 1)`;
    el.wheelDisc.style.transform = `rotate(${wheelAngle}deg)`;
    renderAll();
    setTimeout(() => finishWheel(mult, win), dur + 150);
  }
  function finishWheel(mult, win) {
    const st = cur(), b = st.bonus;
    if (!isWheel(b)) return;
    el.wheelTitle.textContent = `${mult}x!`;
    el.wheelSpin.hidden = true;
    el.wheelPanel.classList.add('done');
    confetti(mult >= 50 ? 260 : 160, el.machine);
    log(`Roda da Fortuna: ${mult}x a aposta = ${fmt(win)}.`, 'win');
    st.bonus = null;
    save();
    setTimeout(() => {
      el.wheelPanel.hidden = true;
      showOverlay({ kicker: 'Roda da Fortuna', title: mult >= 100 ? 'Prêmio gigante!' : mult >= 30 ? 'Que roda!' : 'Você ganhou!', amount: fmt(win), hint: `${mult}x a aposta de ${fmt(b.bet)}` }, 3200);
      renderAll();
    }, 1800);
  }

  function openBuy() {
    const st = cur();
    if (!mach.bonus || spinning || st.bonus || autoLeft) return;
    renderBuy();
    el.buyDialog.showModal();
  }
  // preenche a janela de compra com o preço da aposta atual e o saldo depois da compra
  function renderBuy() {
    const st = cur(), b = mach.bonus, bets = mach.bets, i = bets.indexOf(st.bet);
    const cost = st.bet * b.buyCost, enough = cost <= wallet.balance;
    const wheel = b.type === 'wheel';
    if (wheel) {
      const vals = b.wheel, avg = vals.reduce((x, y) => x + y, 0) / vals.length;
      el.bdHeroUse.setAttribute('href', '#sym-wheel');
      el.bdHeroText.textContent = 'Gire a Roda da Fortuna agora, sem esperar as 3 rodas.';
      el.bdSpins.textContent = '1';
      el.bdP1.textContent = 'giro na Roda da Fortuna';
      el.bdMult.textContent = `${Math.max(...vals)}x`;
      el.bdP2.textContent = 'prêmio máximo da roda';
      el.bdP3Use.setAttribute('href', '#sym-wheel');
      el.bdP3.textContent = `${vals.length} fatias de ${Math.min(...vals)}x a ${Math.max(...vals)}x (média de ${Math.round(avg)}x)`;
    } else {
      el.bdHeroUse.setAttribute('href', '#sym-star');
      el.bdHeroText.textContent = 'Entre direto nos giros grátis, sem esperar as 3 estrelas.';
      el.bdSpins.textContent = b.spins;
      el.bdP1.textContent = 'giros grátis';
      el.bdMult.textContent = `x${b.mult}`;
      el.bdP2.textContent = 'em todos os prêmios';
      el.bdP3Use.setAttribute('href', '#sym-crown');
      el.bdP3.textContent = 'coroas extras nos rolos';
    }
    el.bdBet.textContent = fmt(st.bet);
    el.bdMinus.disabled = i <= 0;
    el.bdPlus.disabled = i >= bets.length - 1;
    el.bdCost.textContent = fmt(cost);
    el.bdCostX.textContent = `${b.buyCost}× a aposta`;
    el.bdBalance.classList.toggle('warn', !enough);
    el.bdBalance.innerHTML = enough
      ? `Suas fichas: <b>${fmt(wallet.balance)}</b> → <b>${fmt(wallet.balance - cost)}</b>`
      : `Fichas insuficientes: você tem <b>${fmt(wallet.balance)}</b>. Diminua a aposta.`;
    el.buyConfirm.textContent = `Comprar · ${fmt(cost)}`;
    el.buyConfirm.disabled = !enough;
  }
  function buyBonus() {
    const st = cur();
    const cost = st.bet * mach.bonus.buyCost;
    el.buyDialog.close();
    if (spinning || st.bonus || cost > wallet.balance) return;
    wallet.add(-cost);
    st.net -= cost;
    const wheel = mach.bonus.type === 'wheel';
    st.bonus = wheel ? newWheelBonus(st.bet, true) : { left: mach.bonus.spins, played: 0, total: 0, bet: st.bet, bought: true, pending: true };
    save();
    log(`${wheel ? 'Roda da Fortuna comprada' : 'Bônus comprado'} por ${fmt(cost)}.`, 'me');
    clearWin();
    (wheel ? announceWheel : announceBonus)('Bônus comprado');
  }

  /* ---------------------------------------------------------
     Apresentação do prêmio: linhas, etiquetas e visor
  --------------------------------------------------------- */
  // cada prêmio vira um "item" que o visor mostra em sequência
  function winItems(res, bet) {
    const items = res.wins.map(w => ({
      kind: 'line', line: w.line, symbol: w.symbol, cells: w.cells, amount: w.amount, color: LINE_COLORS[w.line],
      title: `Linha ${w.line + 1} · ${w.count}× ${w.count > 1 ? PLURAL[w.symbol] : NAMES[w.symbol]}`,
      detail: w.symbol !== mach.wild && w.wilds && mach.wildMult ? `coroa dobrou ${w.wilds > 1 ? `${2 ** w.wilds}x` : ''}`.trim() : '',
    }));
    if (res.scatter) {
      items.push({
        kind: 'scatter', symbol: mach.scatter, cells: res.scatter.cells, amount: res.scatter.amount, color: '#ff3d9a',
        title: `${res.scatter.count} ${PLURAL[mach.scatter].toLowerCase()}`,
        detail: res.bonusSpins ? `+${res.bonusSpins} giros grátis` : res.bonusTrigger && isWheel({ type: mach.bonus.type }) ? 'Roda da Fortuna!' : '',
      });
    }
    return items;
  }

  function present(res, bet, free) {
    const items = winItems(res, bet);
    if (!items.length) {
      setWinbar(null, free ? 'Giro grátis sem prêmio' : 'Não foi dessa vez');
      log(free ? `Giro grátis ${cur().bonus ? cur().bonus.played : ''}: sem prêmio.` : `Giro ${cur().spins}: sem prêmio.`);
      save();
      return;
    }
    el.machine.classList.add('machine-has-win', 'machine-win');
    setTimeout(() => el.machine.classList.remove('machine-win'), 2400);
    el.wbTotal.hidden = !res.total;
    el.wbTotalLabel.textContent = free ? 'Neste giro' : 'Prêmio';
    el.wbAmount.textContent = '+' + fmt(res.total);

    // primeiro todas as linhas juntas, depois uma de cada vez com o valor
    lastItems = items;
    showItems(items, null);
    setWinbar(items[0]);
    let i = -1;
    clearInterval(cycleTimer);
    cycleTimer = setInterval(() => {
      i = (i + 1) % items.length;
      showItems(items, i);
    }, items.length > 1 ? 1700 : 99999);
    setTimeout(() => { if (i === -1) { i = 0; showItems(items, 0); } }, 900);

    const desc = items.map(it => `${it.title} (${fmt(it.amount)})`).join(', ');
    if (res.total) log(`${free ? 'Giro grátis' : `Giro ${cur().spins}`}: ganhou ${fmt(res.total)} · ${desc}.`, 'win');
    save();

    const x = res.total / bet;
    const bigAt = free ? 25 : 15;
    if (x >= bigAt) {
      confetti(x >= 50 ? 260 : 180, el.machine);
      showOverlay({ kicker: free ? 'No giro grátis' : '', title: x >= 50 ? 'Mega prêmio!' : 'Grande prêmio!', amount: fmt(res.total), countUp: true, hint: '' }, free ? 2000 : 3400);
    } else if (x >= 5) confetti(80, el.window);
  }

  const centerOf = ([reel, row]) => [reel * 100 + 50, row * 100 + 50];
  const pct = ([reel, row]) => [((reel + 0.5) / mach.reels) * 100, ((row + 0.5) / mach.rows) * 100];

  // idx = null mostra tudo; um número mostra só aquele prêmio, com etiqueta e visor
  function showItems(items, idx) {
    const shown = idx === null ? items : [items[idx]];
    el.reels.querySelectorAll('.cell.win').forEach(c => c.classList.remove('win'));
    shown.forEach(it => it.cells.forEach(([reel, row]) => el.strips[reel].children[row].classList.add('win')));

    el.paylines.innerHTML = shown.filter(it => it.kind === 'line' && it.cells.length > 1).map(it => {
      const pts = it.cells.map(centerOf).map(p => p.join(',')).join(' ');
      return `<g style="--c:${it.color}"><polyline class="pl-glow" points="${pts}"/><polyline class="pl-core" points="${pts}"/><polyline class="pl-shine" points="${pts}"/></g>`;
    }).join('');

    el.tags.innerHTML = idx === null ? '' : shown.map(it => {
      const last = it.cells[it.cells.length - 1], first = it.cells[0];
      const [lx, ly] = pct(last), [fx, fy] = pct(first);
      const num = it.kind === 'line' ? `<span class="pl-num" style="left:${fx - 50 / mach.reels + 2}%;top:${fy}%;--c:${it.color}">${it.line + 1}</span>` : '';
      return `${num}<span class="pl-tag" style="left:${lx}%;top:${ly}%;--c:${it.color}">${it.amount > 0 ? fmt(it.amount) : 'BÔNUS'}</span>`;
    }).join('');

    if (idx !== null) setWinbar(items[idx]);
  }

  function setWinbar(item, text) {
    if (!item) {
      el.wbIcon.innerHTML = '';
      el.wbTitle.textContent = text || '';
      el.wbDetail.textContent = '';
      el.wbTotal.hidden = true;
      return;
    }
    el.wbIcon.innerHTML = symSvg(item.symbol);
    el.wbIcon.style.setProperty('--c', item.color);
    el.wbTitle.textContent = item.title;
    el.wbDetail.textContent = item.amount > 0 ? `paga ${fmt(item.amount)}${item.detail ? ' · ' + item.detail : ''}` : item.detail;
  }

  function highlightPays(items) {
    const syms = new Set(items.map(it => it.symbol));
    el.pays.querySelectorAll('.pay-row').forEach(r => r.classList.toggle('hit', syms.has(r.dataset.s)));
    setTimeout(() => el.pays.querySelectorAll('.pay-row.hit').forEach(r => r.classList.remove('hit')), 3000);
  }

  function clearWin() {
    clearInterval(cycleTimer);
    el.paylines.innerHTML = '';
    el.tags.innerHTML = '';
    el.reels.querySelectorAll('.cell.win').forEach(c => c.classList.remove('win'));
    el.machine.classList.remove('machine-has-win');
    setWinbar(null, '');
  }

  /* ---------------------------------------------------------
     Aviso grande (prêmio grande, entrada e fim do bônus)
  --------------------------------------------------------- */
  function showOverlay({ kicker, title, amount, hint, countUp }, ms, done) {
    clearTimeout(overlayTimer);
    overlayDone = done || null;
    el.ovKicker.textContent = kicker || '';
    el.ovKicker.hidden = !kicker;
    el.ovTitle.textContent = title;
    el.ovHint.textContent = hint || 'Toque para continuar';
    el.overlay.hidden = false;
    if (countUp) {
      const target = Number(String(amount).replace(/\D/g, '')) || 0, t0 = performance.now();
      const tick = now => {
        const k = Math.min(1, (now - t0) / 1400);
        el.ovAmount.textContent = fmt(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1 && !el.overlay.hidden) requestAnimationFrame(tick);
        else el.ovAmount.textContent = amount;
      };
      requestAnimationFrame(tick);
    } else el.ovAmount.textContent = amount;
    overlayTimer = setTimeout(hideOverlay, ms);
  }
  function hideOverlay() {
    clearTimeout(overlayTimer);
    if (el.overlay.hidden) return;
    el.overlay.hidden = true;
    const done = overlayDone;
    overlayDone = null;
    if (done) done();
    else if (cur().bonus && !cur().bonus.pending && !spinning) bonusTimer = setTimeout(runBonus, 300);
  }

  /* ---------------------------------------------------------
     Controles e telas de apoio
  --------------------------------------------------------- */
  function stopAuto() { autoLeft = 0; renderControls(); }
  function toggleAuto() {
    if (autoLeft > 0) return stopAuto();
    if (cur().bonus) return;
    if (cur().bet > wallet.balance) return toast('Fichas insuficientes para o giro automático.');
    auto.open(el.btnAuto, n => {
      if (autoLeft > 0 || cur().bonus) return;
      if (cur().bet > wallet.balance) return toast('Fichas insuficientes para o giro automático.');
      autoLeft = n;
      renderControls();
      if (!spinning) spin();
    });
  }
  const busy = () => spinning || autoLeft > 0 || !!cur().bonus;
  function changeBet(dir) {
    if (busy()) return;
    const st = cur(), bets = mach.bets;
    st.bet = bets[Math.max(0, Math.min(bets.length - 1, bets.indexOf(st.bet) + dir))];
    save();
    renderAll();
  }
  function switchMachine(id) {
    if (id === mach.id) return;
    if (busy()) return toast('Termine o giro (ou o bônus) antes de trocar de máquina.');
    S.current = id;
    mach = MACHINES[id];
    save();
    clearWin();
    buildReels();
    renderAll();
    setWinbar(null, 'Boa sorte!');
  }

  // o Rei da Folia e o Rei da Fortuna moram em páginas próprias
  const FOLIA_PICK = `<a class="sl-pick" href="folia.html"><img src="folia/scatter.webp" alt=""><span><b>Rei da Folia</b><small>6×5 · multiplicadores</small></span></a>` +
    `<a class="sl-pick" href="fortuna.html"><img src="fortuna/coin.webp" alt=""><span><b>Rei da Fortuna</b><small>3×3 · bônus da Fortuna</small></span></a>`;
  const ALL_PICK = '<a class="sl-pick sl-pick-all" href="slots.html"><svg><use href="#i-slots"/></svg><span><b>Todos</b><small>os slots</small></span></a>';
  function buildPicker() {
    el.picker.innerHTML = ALL_PICK + Object.values(MACHINES).map(m => {
      const icon = m.id === 'coroa' ? '<svg><use href="#crown"/></svg>' : '<svg viewBox="0 0 100 100"><use href="#sym-seven"/></svg>';
      return `<button type="button" class="sl-pick" data-id="${m.id}" aria-pressed="false">${icon}<span><b>${m.name}</b><small>${META[m.id].pick}</small></span></button>`;
    }).join('') + FOLIA_PICK;
    el.picker.querySelectorAll('button.sl-pick').forEach(b => b.addEventListener('click', () => switchMachine(b.dataset.id)));
  }
  function renderPicker() {
    el.picker.querySelectorAll('button.sl-pick').forEach(b => {
      const on = b.dataset.id === mach.id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderStats() {
    const st = cur();
    el.mTitle.textContent = mach.name;
    el.mSub.textContent = META[mach.id].sub;
    el.mMarquee.textContent = mach.name;
    Object.keys(MACHINES).forEach(id => el.machine.classList.toggle(`theme-${id}`, id === mach.id));
    el.machine.classList.toggle('in-bonus', !!st.bonus && !st.bonus.pending);
    el.spins.textContent = st.spins;
    el.best.textContent = fmt(st.best);
    el.net.textContent = (st.net > 0 ? '+' : st.net < 0 ? '−' : '') + fmt(Math.abs(st.net));
    el.net.style.color = st.net > 0 ? 'var(--teal)' : st.net < 0 ? '#ff8fab' : '';
    const b = st.bonus;
    el.bonusbar.hidden = !b || b.pending || isWheel(b);
    if (b && !isWheel(b)) {
      el.bonusCount.textContent = `${b.played}/${b.played + b.left}`;
      el.bonusMult.textContent = `x${mach.bonus.mult}`;
      el.bonusTotal.textContent = fmt(b.total);
    }
  }

  function renderControls() {
    const st = cur(), bets = mach.bets, i = bets.indexOf(st.bet), b = st.bonus;
    el.betValue.textContent = fmt(b ? b.bet : st.bet);
    el.betMinus.disabled = busy() || i <= 0;
    el.betPlus.disabled = busy() || i >= bets.length - 1;
    el.btnTurbo.setAttribute('aria-pressed', S.turbo ? 'true' : 'false');
    el.btnAuto.setAttribute('aria-pressed', autoLeft > 0 ? 'true' : 'false');
    el.btnAuto.textContent = autoLeft > 0 ? `Parar · ${auto.label(autoLeft)}` : 'Auto';
    el.btnAuto.disabled = !!b;
    el.btnBuy.hidden = !mach.bonus;
    if (mach.bonus) {
      el.buyPrice.textContent = fmt(st.bet * mach.bonus.buyCost);
      el.btnBuy.disabled = busy() || st.bet * mach.bonus.buyCost > wallet.balance;
    }
    el.btnSpin.disabled = spinning || autoLeft > 0 || !!b;
    el.spinLabel.textContent = isWheel(b) ? 'Roda da Fortuna!' : b ? `Giros grátis · ${b.left}` : spinning ? 'Girando…' : `Girar · ${fmt(st.bet)}`;
    el.status.textContent = isWheel(b) ? (b.spun ? 'A roda está girando…' : 'Gire a Roda da Fortuna!')
      : b ? (b.pending ? 'Bônus ativado!' : `Giros grátis: faltam ${b.left} · prêmios x${mach.bonus.mult}`)
      : autoLeft > 0 ? (autoLeft === Infinity ? 'Giro automático sem limite' : `Giro automático: faltam ${autoLeft}`)
      : wallet.balance < bets[0] ? 'Sem fichas: use o + no topo para recarregar'
      : st.bet > wallet.balance ? 'Aposta maior que suas fichas: diminua o valor'
      : spinning ? '' : 'Escolha a aposta e gire';
    el.picker.querySelectorAll('.sl-pick').forEach(p => { p.disabled = busy() && p.dataset.id !== mach.id; });
  }

  /* Quanto paga: sempre visível, com os valores já calculados para a aposta */
  function renderPays() {
    const st = cur(), bet = st.bonus ? st.bonus.bet : st.bet;
    const lineBet = bet / mach.lines.length;
    el.paysBet.textContent = `aposta ${fmt(bet)}`;
    const order = ['crown', 'seven', 'diamond', 'bar', 'bell', 'grape', 'lemon', 'cherry'].filter(s => mach.pays[s]);
    const rows = order.map(s => {
      const cells = Object.entries(mach.pays[s]).map(([n, x]) => `<span class="pay-cell"><small>${n}×</small><b>${fmt(x * lineBet)}</b></span>`).join('');
      let note = '';
      if (s === mach.wild) note = mach.wildMult ? 'Coringa: substitui qualquer símbolo e dobra o prêmio da linha' : 'Coringa: substitui qualquer símbolo, menos a estrela';
      if (s === 'cherry' && mach.pays.cherry[1]) note = 'Paga até com uma só, no primeiro rolo';
      return `<div class="pay-row${s === mach.wild ? ' special' : ''}" data-s="${s}"><span class="pay-icon">${symSvg(s)}</span>` +
        `<div class="pay-info">${note ? `<small class="pay-note">${note}</small>` : ''}<div class="pay-cells">${cells}</div></div></div>`;
    });
    if (mach.scatter && mach.bonus.type === 'wheel') {
      const vals = mach.bonus.wheel, lo = Math.min(...vals), hi = Math.max(...vals);
      rows.splice(1, 0, `<div class="pay-row special bonus" data-s="${mach.scatter}"><span class="pay-icon">${symSvg(mach.scatter)}</span>` +
        `<div class="pay-info"><small class="pay-note"><b>Bônus:</b> uma roda em cada um dos 3 rolos</small>` +
        `<div class="pay-text">Roda da Fortuna: de <b>${lo}x</b> a <b>${hi}x</b> a aposta (${fmt(lo * bet)} a ${fmt(hi * bet)})</div></div></div>`);
    } else if (mach.scatter) {
      const pay = Object.entries(mach.scatterPays || {}).map(([n, x]) => `${n} estrelas pagam ${fmt(x * bet)}`).join('');
      rows.splice(1, 0, `<div class="pay-row special bonus" data-s="star"><span class="pay-icon">${symSvg('star')}</span>` +
        `<div class="pay-info"><small class="pay-note"><b>Bônus:</b> estrela nos rolos 1, 3 e 5 ao mesmo tempo</small>` +
        `<div class="pay-text">${mach.bonus.spins} giros grátis com prêmios <b>x${mach.bonus.mult}</b>${pay ? ' · ' + pay : ''}</div></div></div>`);
    }
    el.pays.innerHTML = rows.join('');
  }

  function renderLines() {
    el.ptLines.style.setProperty('--reels', mach.reels);
    el.ptLines.innerHTML = mach.lines.map((line, i) =>
      `<div class="pt-line" style="--c:${LINE_COLORS[i]};--reels:${mach.reels}"><span>${i + 1}</span>${Array.from({ length: mach.rows }, (_, row) =>
        line.map(r => `<i class="${r === row ? 'on' : ''}"></i>`).join('')).join('')}</div>`).join('');
    el.linesFoot.textContent = `${mach.lines.length} linhas · a aposta é dividida igualmente entre elas (${fmt(cur().bet / mach.lines.length)} por linha).`;
  }

  function renderAll() {
    renderStats();
    renderControls();
    renderPays();
    renderPicker();
  }

  /* ---------------------------------------------------------
     Início
  --------------------------------------------------------- */
  function init() {
    Object.assign(el, {
      machine: $('#machine'), window: $('#window'), reels: $('#reels'), paylines: $('#paylines'), tags: $('#tags'),
      bulbs: $('#bulbs'), mTitle: $('#m-title'), mSub: $('#m-sub'), mMarquee: $('#m-marquee'), picker: $('#picker'),
      bonusbar: $('#bonusbar'), bonusCount: $('#bonus-count'), bonusMult: $('#bonus-mult'), bonusTotal: $('#bonus-total'),
      wbIcon: $('#wb-icon'), wbTitle: $('#wb-title'), wbDetail: $('#wb-detail'), wbTotal: $('#wb-total'), wbAmount: $('#wb-amount'),
      wbTotalLabel: $('#wb-total span'),
      overlay: $('#bigwin'), ovKicker: $('#bigwin-kicker'), ovTitle: $('#bigwin-title'), ovAmount: $('#bigwin-amount'), ovHint: $('#bigwin-hint'),
      betMinus: $('#bet-minus'), betPlus: $('#bet-plus'), betValue: $('#bet-value'),
      btnAuto: $('#btn-auto'), btnTurbo: $('#btn-turbo'), btnBuy: $('#btn-buy'), buyPrice: $('#buy-price'),
      btnSpin: $('#btn-spin'), spinLabel: $('#spin-label'), status: $('#status'),
      pays: $('#pays'), paysBet: $('#pays-bet'), ptLines: $('#pt-lines'), linesFoot: $('#lines-foot'),
      linesDialog: $('#lines-dialog'), buyDialog: $('#buy-dialog'), buyConfirm: $('#buy-confirm'),
      bdSpins: $('#bd-spins'), bdMult: $('#bd-mult'), bdBet: $('#bd-bet'), bdMinus: $('#bd-minus'), bdPlus: $('#bd-plus'),
      bdCost: $('#bd-cost'), bdCostX: $('#bd-cost-x'), bdBalance: $('#bd-balance'),
      bdHeroUse: $('#bd-hero-use'), bdHeroText: $('#bd-hero-text'), bdP1: $('#bd-p1'), bdP2: $('#bd-p2'), bdP3: $('#bd-p3'), bdP3Use: $('#bd-p3-use'),
      wheelPanel: $('#wheel-bonus'), wheelDisc: $('#wheel-disc'), wheelTitle: $('#wheel-title'), wheelSpin: $('#wheel-spin'),
      spins: $('#info-spins'), best: $('#info-best'), net: $('#info-net'), log: $('#log'),
    });

    // lâmpadas do letreiro (em cima e embaixo)
    const bulbs = '<i></i>'.repeat(22);
    el.bulbs.innerHTML = bulbs;
    el.bulbs.insertAdjacentHTML('afterend', `<div class="sm-bulbs bottom" aria-hidden="true">${bulbs}</div>`);

    const saved = loadSave();
    S = saved || fresh();
    // maquinas.html?m=coroa|classico abre direto na máquina escolhida
    const want = new URLSearchParams(location.search).get('m');
    if (want && MACHINES[want] && want !== S.current && !S.m[S.current].bonus) S.current = want;
    mach = MACHINES[S.current];
    S.logs.forEach(([m, c]) => appendLog(m, c));
    if (!saved) log('Bem-vindo aos Slots! Escolha uma máquina e boa sorte.', 'sep');
    buildPicker();
    buildReels();

    el.btnSpin.addEventListener('click', spin);
    el.betMinus.addEventListener('click', () => changeBet(-1));
    el.betPlus.addEventListener('click', () => changeBet(1));
    el.btnAuto.addEventListener('click', toggleAuto);
    el.btnTurbo.addEventListener('click', () => { S.turbo = !S.turbo; save(); renderControls(); });
    el.btnBuy.addEventListener('click', openBuy);
    el.buyConfirm.addEventListener('click', buyBonus);
    el.bdMinus.addEventListener('click', () => { changeBet(-1); renderBuy(); });
    el.bdPlus.addEventListener('click', () => { changeBet(1); renderBuy(); });
    $('#btn-lines').addEventListener('click', () => { renderLines(); el.linesDialog.showModal(); });
    document.querySelectorAll('.sl-dialog, .sl-buy-dialog').forEach(d => {
      d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
    });
    el.overlay.addEventListener('click', hideOverlay);
    el.wheelSpin.addEventListener('click', spinWheel);

    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
      const onControl = e.target.closest && e.target.closest('button, input');
      if ((e.key === ' ' || e.key === 'Enter') && !onControl) {
        e.preventDefault();
        if (!el.overlay.hidden) hideOverlay();
        else if (!el.wheelPanel.hidden) spinWheel();
        else if (!autoLeft && !cur().bonus) spin();
      }
    });

    wallet.setRefillGuard(() => (busy() ? 'Espere os rolos (e o bônus) terminarem para recarregar.' : null));
    wallet.onChange(() => renderControls());

    save();
    renderAll();
    setWinbar(null, 'Boa sorte!');

    // voltou com um bônus no meio: continua de onde parou
    const b = cur().bonus;
    if (isWheel(b)) {
      toast('Roda da Fortuna retomada de onde você parou');
      if (b.pending) setTimeout(() => announceWheel(b.bought ? 'Bônus comprado' : '3 rodas!'), 800);
      else if (!b.spun) setTimeout(openWheel, 600);
      else {
        // a roda já tinha sido girada (e paga): só mostra o resultado
        const mult = mach.bonus.wheel[b.result];
        setTimeout(() => { openWheel(); finishWheel(mult, mult * b.bet); }, 600);
      }
    } else if (b) {
      toast('Bônus retomado de onde você parou');
      if (b.pending) setTimeout(() => announceBonus(b.bought ? 'Bônus comprado' : '3 estrelas!'), 800);
      else bonusTimer = setTimeout(runBonus, 1200);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
