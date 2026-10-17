/* ==========================================================
   Casino Fest · Bac Bo — dados no estilo bacará
   Jogador e Banca jogam dois dados cada; a maior soma vence.
   Jogador ou Banca paga 1:1 (no empate devolve 90%: retorno 98,88%).
   Empate paga conforme a soma, de 4:1 a 88:1 (retorno 95,5%).
   As fichas são as da carteira única do cassino (casino.js).
   ========================================================== */
(() => {
  'use strict';

  const { fmt, $, toast, confetti, wallet, chipSvg, showBanner, sfx } = window.Casino;

  /* ---------------------------------------------------------
     Constantes
  --------------------------------------------------------- */
  const CHIPS = [1, 5, 10, 25, 100, 500];
  const CHIP_COLORS = [1000, 500, 250, 100, 50, 25, 10, 5, 1];
  const LIMIT = { player: 2000, banker: 2000, tie: 500 };
  const NAMES = { player: 'Jogador', banker: 'Banca', tie: 'Empate' };
  const TIE_REFUND = 0.9;                       // no empate, Jogador e Banca devolvem 90%
  // empate: quanto paga (x a aposta, além dela) conforme a soma
  const TIE_PAYS = { 2: 88, 12: 88, 3: 25, 11: 25, 4: 10, 10: 10, 5: 6, 9: 6, 6: 4, 7: 4, 8: 4 };
  const SAVE_KEY = 'casinofest:bacbo:v1';
  const BEADS = 180;                            // placar: 6 linhas × 30 colunas

  let B = null;          // estado da mesa
  const el = {};
  let rolling = false;
  let selected = 10;
  let shakers = null;    // copos em 3D, quando o bacbo3d.js carrega

  const fresh = () => ({
    v: 1, phase: 'bet', bets: {}, undo: [], lastBets: {}, history: [],
    round: 0, net: 0, last: null, outcome: null, banner: null, bannerLose: false, logs: [],
  });
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(B)); } catch (e) { /* sem armazenamento */ } }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return s && s.v === 1 && typeof s.bets === 'object' && Array.isArray(s.history) ? s : null;
    } catch (e) { return null; }
  }
  function log(msg, cls = '') {
    B.logs.push([msg, cls]);
    if (B.logs.length > 80) B.logs.splice(0, B.logs.length - 80);
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
  const staked = (bets = B.bets) => Object.values(bets).reduce((s, v) => s + v, 0);

  // dado sem viés (gerador criptográfico)
  function d6() {
    const a = new Uint32Array(1);
    let x;
    do { crypto.getRandomValues(a); x = a[0]; } while (x >= 4294967296 - (4294967296 % 6));
    return 1 + (x % 6);
  }

  /* ---------------------------------------------------------
     Dados em 3D (cubo com as 6 faces)
  --------------------------------------------------------- */
  const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  // em que face fica cada valor e a rotação que leva essa face para a frente
  const FACES = [['front', 1], ['back', 6], ['right', 3], ['left', 4], ['top', 5], ['bottom', 2]];
  const SHOW = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 2: [90, 0] };
  const dice = {};   // id → { cube, rx, ry }

  function buildDie(node) {
    node.innerHTML = `<div class="cube">${FACES.map(([f, v]) =>
      `<div class="face ${f}">${Array.from({ length: 9 }, (_, i) => `<i${PIPS[v].includes(i + 1) ? ' class="on"' : ''}></i>`).join('')}</div>`).join('')}</div>`;
    const d = { node, cube: node.firstChild, rx: -18, ry: 22 };
    d.cube.style.transform = `rotateX(${d.rx}deg) rotateY(${d.ry}deg)`;
    dice[node.id] = d;
  }
  // gira até mostrar o valor na frente, com voltas extras sorteadas (cada lance é diferente)
  function rollDie(id, value, ms) {
    const d = dice[id];
    const [tx, ty] = SHOW[value];
    const turnsX = 2 + Math.floor(Math.random() * 2), turnsY = 2 + Math.floor(Math.random() * 2);
    const next = (cur, target, turns) => {
      const base = cur + 360 * turns;
      return base + ((((target - base) % 360) + 360) % 360);
    };
    d.rx = next(d.rx, tx, turnsX);
    d.ry = next(d.ry, ty, turnsY);
    d.node.classList.remove('throw');
    void d.node.offsetWidth;
    d.node.style.setProperty('--ms', `${ms}ms`);
    d.node.classList.add('throw');
    d.cube.style.transitionDuration = `${ms}ms`;
    d.cube.style.transform = `rotateX(${d.rx}deg) rotateY(${d.ry}deg)`;
  }
  // depois do lance, leve inclinação para o dado parecer apoiado na mesa
  function settleDie(id) {
    const d = dice[id];
    d.cube.style.transitionDuration = '400ms';
    d.cube.style.transform = `rotateX(${d.rx - 14}deg) rotateY(${d.ry + 16}deg)`;
  }

  /* ---------------------------------------------------------
     Apostas
  --------------------------------------------------------- */
  function startNewBet() {
    if (B.phase !== 'result') return;
    B.phase = 'bet';
    B.bets = {};
    B.undo = [];
    B.banner = null;
  }
  function placeBet(key) {
    if (rolling) return;
    startNewBet();
    const cur = B.bets[key] || 0;
    const room = LIMIT[key] - cur;
    if (room <= 0) return toast(`Limite de ${fmt(LIMIT[key])} em ${NAMES[key]}.`);
    const free = wallet.balance - staked();
    if (free <= 0) return toast('Fichas insuficientes. Use o + no topo para recarregar.');
    const amt = Math.min(selected, room, free);
    B.bets[key] = cur + amt;
    B.undo.push([key, amt]);
    if (amt < selected) toast(amt === room ? `Limite de ${fmt(LIMIT[key])} em ${NAMES[key]}.` : 'Apostei o que restava das suas fichas.');
    commit();
  }
  function removeSpot(key) {
    if (rolling || B.phase !== 'bet' || !B.bets[key]) return;
    delete B.bets[key];
    B.undo = B.undo.filter(([k]) => k !== key);
    commit();
  }
  function undo() {
    if (rolling || B.phase !== 'bet' || !B.undo.length) return;
    const [key, amt] = B.undo.pop();
    B.bets[key] -= amt;
    if (B.bets[key] <= 0) delete B.bets[key];
    commit();
  }
  function clearBets() {
    if (rolling) return;
    startNewBet();
    B.bets = {};
    B.undo = [];
    commit();
  }
  function doubleBets() {
    if (rolling || B.phase !== 'bet' || !staked()) return;
    const next = {};
    for (const [k, v] of Object.entries(B.bets)) next[k] = Math.min(LIMIT[k], v * 2);
    if (staked(next) > wallet.balance) return toast('Fichas insuficientes para dobrar a aposta.');
    for (const [k, v] of Object.entries(next)) if (v > B.bets[k]) B.undo.push([k, v - B.bets[k]]);
    B.bets = next;
    commit();
  }
  function repeatBets() {
    if (rolling || !Object.keys(B.lastBets).length) return;
    if (staked(B.lastBets) > wallet.balance) return toast('Fichas insuficientes para repetir a última aposta.');
    startNewBet();
    B.bets = { ...B.lastBets };
    B.undo = Object.entries(B.bets);
    commit();
  }

  /* ---------------------------------------------------------
     Lance e pagamento
  --------------------------------------------------------- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function settle(bets, p, k) {
    const winner = p[0] + p[1] > k[0] + k[1] ? 'player' : p[0] + p[1] < k[0] + k[1] ? 'banker' : 'tie';
    const sum = p[0] + p[1];
    let win = 0;
    const winners = [];
    for (const [key, v] of Object.entries(bets)) {
      if (key === 'tie') {
        if (winner === 'tie') { win += v * (TIE_PAYS[sum] + 1); winners.push('tie'); }
      } else if (winner === 'tie') {
        win += Math.floor(v * TIE_REFUND);   // empate: devolve 90%
      } else if (key === winner) { win += v * 2; winners.push(key); }
    }
    return { winner, win, winners };
  }

  async function roll() {
    if (rolling) return;
    if (B.phase === 'result' && Object.keys(B.lastBets).length) repeatBets();
    if (B.phase !== 'bet') return;
    const total = staked();
    if (!total) return toast('Escolha uma ficha e clique em Jogador, Empate ou Banca.');
    if (total > wallet.balance) return toast('Você não tem fichas suficientes para essa aposta.');

    // resultado e pagamento são decididos e salvos antes da animação
    const p = [d6(), d6()], k = [d6(), d6()];
    const { winner, win, winners } = settle(B.bets, p, k);
    const net = win - total;
    wallet.add(-total);
    B.round++;
    B.lastBets = { ...B.bets };
    B.last = { p, k, winner };
    B.outcome = { winners, win, net, total };
    B.history.unshift({ w: winner, p: p[0] + p[1], k: k[0] + k[1] });
    B.history = B.history.slice(0, BEADS);
    B.net += net;
    B.phase = 'result';
    B.banner = makeBanner(winner, p, k, net, win);
    B.bannerLose = net < 0;
    save();

    log(`── Rodada ${B.round} · ${fmt(total)} na mesa ──`, 'sep');
    rolling = true;
    const fast = reduce();
    const ms = fast ? 300 : 1250 + Math.round(Math.random() * 450);
    clearDuel();
    render();
    say('Os dados estão rolando…');
    sfx.play('dice');

    if (shakers && !fast) {
      // os dois copos chacoalham; a Banca começa um pouco depois e assenta por último
      const pDone = shakers.player.roll(p, 1000 + Math.random() * 400);
      await sleep(380);
      sfx.play('dice');
      const kDone = shakers.banker.roll(k, 1300 + Math.random() * 400);
      if (win > 0) wallet.add(win, { delay: Math.max(pDone.ms, kDone.ms + 380) + 1200 });
      await pDone;
      showSum('player', p[0] + p[1]);
      say(`Jogador fez ${p[0] + p[1]}. Agora a Banca…`);
      await kDone;
      showSum('banker', k[0] + k[1]);
      await sleep(450);
      return finishRoll(p, k, winner, win, winners, net);
    }

    if (win > 0) wallet.add(win, { delay: fast ? 900 : ms * 2 + 1500 });
    if (shakers) { shakers.player.show(p); shakers.banker.show(k); }   // movimento reduzido: só mostra
    // primeiro o Jogador, depois a Banca
    rollDie('die-p1', p[0], ms);
    rollDie('die-p2', p[1], ms + 120);
    await sleep(ms + 200);
    settleDie('die-p1'); settleDie('die-p2');
    showSum('player', p[0] + p[1]);
    say(`Jogador fez ${p[0] + p[1]}. Agora a Banca…`);
    await sleep(fast ? 200 : 700);
    rollDie('die-b1', k[0], ms);
    rollDie('die-b2', k[1], ms + 120);
    await sleep(ms + 200);
    settleDie('die-b1'); settleDie('die-b2');
    showSum('banker', k[0] + k[1]);
    await sleep(fast ? 150 : 500);
    finishRoll(p, k, winner, win, winners, net);
  }

  function finishRoll(p, k, winner, win, winners, net) {
    rolling = false;
    if (shakers) {
      shakers.player.setWin(winner !== 'banker');
      shakers.banker.setWin(winner !== 'player');
    }

    el.sidePlayer.classList.toggle('won', winner === 'player' || winner === 'tie');
    el.sideBanker.classList.toggle('won', winner === 'banker' || winner === 'tie');
    el.duel.classList.toggle('tie', winner === 'tie');
    say(winner === 'tie' ? `Empate em ${p[0] + p[1]}!` : `${NAMES[winner]} vence, ${Math.max(p[0] + p[1], k[0] + k[1])} a ${Math.min(p[0] + p[1], k[0] + k[1])}.`);
    log(`Jogador ${p[0]}+${p[1]} = ${p[0] + p[1]} · Banca ${k[0]}+${k[1]} = ${k[0] + k[1]}: ${winner === 'tie' ? 'empate' : `${NAMES[winner]} venceu`}.`);
    if (winners.length) log(`Acertou: ${winners.map(w => NAMES[w]).join(', ')}. Recebeu ${fmt(win)}.`, 'win');
    else if (win > 0) log(`Empate: devolvidos ${fmt(win)} (90% das apostas em Jogador e Banca).`);
    log(net > 0 ? `Você ganhou ${fmt(net)} nesta rodada.` : net < 0 ? `Você perdeu ${fmt(-net)} nesta rodada.` : 'Você recuperou o que apostou.', net > 0 ? 'win' : '');
    save();
    render();
    if (net > 0) confetti(winners.includes('tie') ? 260 : 130, el.duel);
    mount3d();
  }

  // troca os dados em CSS pelos copos em 3D (nunca no meio de um lance)
  function mount3d() {
    if (shakers || rolling || !window.BacBo3D) return;
    const a = window.BacBo3D.mount($('#shaker-player'), 'player');
    const b = a && window.BacBo3D.mount($('#shaker-banker'), 'banker');
    if (!a || !b) return;
    shakers = { player: a, banker: b };
    el.duel.classList.add('has3d');
    a.show(B.last ? B.last.p : [5, 2]);
    b.show(B.last ? B.last.k : [3, 6]);
    if (B.last && B.phase === 'result') {
      a.setWin(B.last.winner !== 'banker');
      b.setWin(B.last.winner !== 'player');
    }
  }

  function makeBanner(winner, p, k, net) {
    const kicker = winner === 'tie' ? `Empate em ${p[0] + p[1]}` : `${NAMES[winner]} venceu · ${p[0] + p[1]} × ${k[0] + k[1]}`;
    if (net > 0) return { kicker, title: winner === 'tie' && B.bets.tie ? 'Empate certeiro!' : 'Você ganhou!', amount: '+' + fmt(net) };
    if (net === 0) return { kicker, title: 'Empatou', amount: '' };
    return { kicker, title: 'Não foi dessa vez', amount: '−' + fmt(-net) };
  }

  /* ---------------------------------------------------------
     Tela
  --------------------------------------------------------- */
  function say(text) { el.say.textContent = text; }
  function showSum(side, n) {
    const node = side === 'player' ? el.sumPlayer : el.sumBanker;
    node.textContent = n;
    node.classList.remove('pop');
    void node.offsetWidth;
    node.classList.add('pop');
  }
  function clearDuel() {
    el.sumPlayer.textContent = '–';
    el.sumBanker.textContent = '–';
    el.sidePlayer.classList.remove('won');
    el.sideBanker.classList.remove('won');
    el.duel.classList.remove('tie');
    if (shakers) { shakers.player.setWin(false); shakers.banker.setWin(false); }
  }

  function chipHtml(amount) {
    const v = CHIP_COLORS.find(c => c <= amount) || 1;
    const txt = amount >= 1000 ? `${Math.round(amount / 100) / 10}k`.replace('.', ',') : amount;
    return `<span class="spot-chip">${chipSvg(v)}<b>${txt}</b></span>`;
  }

  function render() {
    const total = staked();
    const showing = B.phase === 'result' && !rolling;

    // fichas nas apostas
    el.spots.forEach(s => {
      const k = s.dataset.k, v = B.bets[k] || 0;
      if (s.dataset.v !== String(v)) {
        s.dataset.v = String(v);
        s.querySelector('.bb-stake').innerHTML = v ? chipHtml(v) : '';
      }
      const won = showing && B.outcome && B.outcome.winners.includes(k);
      s.classList.toggle('won', !!won);
      s.classList.toggle('lost', showing && v > 0 && !won);
    });
    el.bets.classList.toggle('locked', rolling);
    showBanner(el.banner, showing ? B.banner : null, B.bannerLose);

    // placar (o mais antigo primeiro, enchendo as colunas de cima para baixo)
    const hist = (rolling ? B.history.slice(1) : B.history).slice().reverse();
    el.beads.innerHTML = Array.from({ length: BEADS }, (_, i) => {
      const h = hist[i];
      if (!h) return '<span class="bead empty"></span>';
      const n = h.w === 'banker' ? h.k : h.p;
      return `<span class="bead ${h.w}" title="Jogador ${h.p} × Banca ${h.k}">${n}</span>`;
    }).join('');
    // a rodada mais nova sempre à vista (sem rolar para as casas vazias)
    const lastBead = el.beads.children[Math.max(0, Math.min(hist.length, BEADS) - 1)];
    el.beads.scrollLeft = Math.max(0, lastBead.offsetLeft + lastBead.offsetWidth + 24 - el.beads.clientWidth);
    const count = { player: 0, banker: 0, tie: 0 };
    hist.forEach(h => { count[h.w]++; });
    const n = hist.length || 1;
    el.roadStats.innerHTML = hist.length
      ? ['player', 'tie', 'banker'].map(w => `<span class="rs ${w}"><i></i>${NAMES[w]} ${Math.round((count[w] / n) * 100)}%</span>`).join('')
      : '<span class="rs-empty">Ainda sem rodadas</span>';

    // barra da mesa
    el.round.textContent = B.round;
    el.staked.textContent = fmt(B.phase === 'bet' ? total : 0);
    el.net.textContent = (B.net > 0 ? '+' : B.net < 0 ? '−' : '') + fmt(Math.abs(B.net));
    el.net.style.color = B.net > 0 ? 'var(--teal)' : B.net < 0 ? '#ff8fab' : '';
    renderControls();
  }

  function renderControls() {
    const total = B.phase === 'bet' ? staked() : 0;
    const hasLast = Object.keys(B.lastBets).length > 0;
    el.trayChips.forEach(b => {
      const v = Number(b.dataset.v);
      b.classList.toggle('selected', v === selected);
      b.setAttribute('aria-checked', v === selected ? 'true' : 'false');
      b.disabled = rolling;
    });
    el.btnUndo.disabled = rolling || B.phase !== 'bet' || !B.undo.length;
    el.btnClear.disabled = rolling || !total;
    el.btnDouble.disabled = rolling || !total;
    el.btnRepeat.disabled = rolling || !hasLast;
    const repeatTotal = staked(B.lastBets);
    el.btnRoll.disabled = rolling || (!total && !(B.phase === 'result' && hasLast && repeatTotal <= wallet.balance));
    el.rollLabel.textContent = rolling ? 'Rolando…'
      : total ? `Lançar dados · ${fmt(total)}`
      : B.phase === 'result' && hasLast ? `Repetir e lançar · ${fmt(repeatTotal)}` : 'Lançar dados';
    el.controls.classList.toggle('disabled', rolling);
    el.status.textContent = rolling ? 'Os dados estão rolando…'
      : wallet.balance < 1 && !total ? 'Sem fichas: use o + no topo para recarregar'
      : B.phase === 'result' ? 'Clique numa aposta para jogar de novo, ou repita a última'
      : total ? 'Tudo pronto? Lance os dados' : 'Escolha uma ficha e aposte em Jogador, Empate ou Banca';
    el.status.classList.toggle('mine', !rolling && B.phase === 'bet' && total > 0);
  }

  function commit() { save(); render(); }

  /* ---------------------------------------------------------
     Início
  --------------------------------------------------------- */
  function init() {
    Object.assign(el, {
      duel: $('.bb-duel'), sidePlayer: $('#side-player'), sideBanker: $('#side-banker'),
      sumPlayer: $('#sum-player'), sumBanker: $('#sum-banker'), say: $('#dealer-say'), banner: $('#banner'),
      bets: $('#bets'), beads: $('#beads'), roadStats: $('#road-stats'), chipTray: $('#chip-tray'),
      btnUndo: $('#btn-undo'), btnClear: $('#btn-clear'), btnDouble: $('#btn-double'), btnRepeat: $('#btn-repeat'),
      btnRoll: $('#btn-roll'), rollLabel: $('#roll-label'), controls: $('#controls'), status: $('#status'), log: $('#log'),
      round: $('#info-round'), staked: $('#info-staked'), net: $('#info-net'),
    });
    el.spots = [...el.bets.querySelectorAll('.bb-spot')];

    const saved = loadSave();
    B = saved || fresh();
    B.logs.forEach(([m, c]) => appendLog(m, c));
    if (!saved) log('Mesa de Bac Bo aberta! Aposte em Jogador, Empate ou Banca e lance os dados.', 'sep');

    ['die-p1', 'die-p2', 'die-b1', 'die-b2'].forEach(id => buildDie($(`#${id}`)));
    // voltou depois de um lance: mostra os dados e as somas da última rodada
    if (B.last) {
      const { p, k, winner } = B.last;
      [['die-p1', p[0]], ['die-p2', p[1]], ['die-b1', k[0]], ['die-b2', k[1]]].forEach(([id, v]) => {
        const d = dice[id];
        [d.rx, d.ry] = SHOW[v];
        d.cube.style.transitionDuration = '0ms';
        settleDie(id);
      });
      el.sumPlayer.textContent = p[0] + p[1];
      el.sumBanker.textContent = k[0] + k[1];
      if (B.phase === 'result') {
        el.sidePlayer.classList.toggle('won', winner !== 'banker');
        el.sideBanker.classList.toggle('won', winner !== 'player');
        el.duel.classList.toggle('tie', winner === 'tie');
      }
    }

    mount3d();
    document.addEventListener('bacbo3d-ready', mount3d);

    el.chipTray.innerHTML = CHIPS.map(v =>
      `<button type="button" class="tray-chip c${v}" data-v="${v}" role="radio" aria-label="Ficha de ${fmt(v)}">${chipSvg(v)}<b>${v}</b></button>`).join('');
    el.trayChips = [...el.chipTray.querySelectorAll('.tray-chip')];
    el.trayChips.forEach(b => b.addEventListener('click', () => { selected = Number(b.dataset.v); renderControls(); }));

    el.spots.forEach(s => {
      s.addEventListener('click', () => placeBet(s.dataset.k));
      s.addEventListener('contextmenu', e => { e.preventDefault(); removeSpot(s.dataset.k); });
    });
    el.btnUndo.addEventListener('click', undo);
    el.btnClear.addEventListener('click', clearBets);
    el.btnDouble.addEventListener('click', doubleBets);
    el.btnRepeat.addEventListener('click', repeatBets);
    el.btnRoll.addEventListener('click', roll);
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const onControl = e.target.closest && e.target.closest('button, input');
      if ((e.key === 'Enter' || e.key === ' ') && !onControl) { e.preventDefault(); roll(); }
      else if (e.key === 'Backspace') undo();
      else if (/^[1-6]$/.test(e.key)) { selected = CHIPS[Number(e.key) - 1]; renderControls(); }
    });

    wallet.setRefillGuard(() => (rolling ? 'Espere os dados pararem para recarregar.' : null));
    wallet.onChange(() => renderControls());

    save();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
