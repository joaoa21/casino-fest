/* ==========================================================
   Casino Fest · Poker Texas Hold'em: você contra 3 bots
   Usa a base compartilhada (casino.js): carteira, cartas, fichas.
   ========================================================== */
(() => {
  'use strict';

  const {
    fmt, $, rnd, toast, confetti, wallet, SUITS, rl, newDeck, shuffle,
    setCard, chipStack, chipColumns, showBanner, avatarImg,
  } = window.Casino;

  /* ---------------------------------------------------------
     Constantes
  --------------------------------------------------------- */
  const START_STACK = 1000;   // fichas de cada adversário ao abrir a mesa
  const BLIND_LEVELS = [[10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400]];
  const HANDS_PER_LEVEL = 8;
  const CANCEL = Symbol('cancel');

  const rankNome = r => ({ 14: 'Ases', 13: 'Reis', 12: 'Damas', 11: 'Valetes' }[r] || String(r));
  const round5 = x => Math.max(5, Math.round(x / 5) * 5);

  /* ---------------------------------------------------------
     Avaliação de mãos
     score = categoria * 15^5 + 5 "kickers" em base 15
  --------------------------------------------------------- */
  function eval5(c) {
    const r = [c[0].r, c[1].r, c[2].r, c[3].r, c[4].r].sort((a, b) => b - a);
    const flush = c[0].s === c[1].s && c[1].s === c[2].s && c[2].s === c[3].s && c[3].s === c[4].s;

    let straight = 0;
    if (r[0] !== r[1] && r[1] !== r[2] && r[2] !== r[3] && r[3] !== r[4]) {
      if (r[0] - r[4] === 4) straight = r[0];
      else if (r[0] === 14 && r[1] === 5) straight = 5; // A-2-3-4-5
    }

    const cnt = new Array(15).fill(0);
    for (const x of r) cnt[x]++;
    const g = [];
    for (let v = 14; v >= 2; v--) if (cnt[v]) g.push([v, cnt[v]]);
    g.sort((a, b) => b[1] - a[1] || b[0] - a[0]);

    let cat, ks;
    if (straight && flush) { cat = 8; ks = [straight]; }
    else if (g[0][1] === 4) { cat = 7; ks = [g[0][0], g[1][0]]; }
    else if (g[0][1] === 3 && g[1][1] === 2) { cat = 6; ks = [g[0][0], g[1][0]]; }
    else if (flush) { cat = 5; ks = r; }
    else if (straight) { cat = 4; ks = [straight]; }
    else if (g[0][1] === 3) { cat = 3; ks = [g[0][0], g[1][0], g[2][0]]; }
    else if (g[0][1] === 2 && g[1][1] === 2) { cat = 2; ks = [g[0][0], g[1][0], g[2][0]]; }
    else if (g[0][1] === 2) { cat = 1; ks = g.map(x => x[0]); }
    else { cat = 0; ks = r; }

    let score = cat;
    for (let i = 0; i < 5; i++) score = score * 15 + (ks[i] || 0);
    return score;
  }

  const COMBOS = {};
  function combos(n) {
    if (COMBOS[n]) return COMBOS[n];
    const out = [];
    (function rec(start, cur) {
      if (cur.length === 5) { out.push(cur.slice()); return; }
      for (let i = start; i < n; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
    })(0, []);
    return (COMBOS[n] = out);
  }

  function bestScore(cards) {
    const cs = combos(cards.length);
    let best = -1;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      const sc = eval5([cards[c[0]], cards[c[1]], cards[c[2]], cards[c[3]], cards[c[4]]]);
      if (sc > best) best = sc;
    }
    return best;
  }

  function bestHand(cards) {
    const cs = combos(cards.length);
    let best = -1, pick = null;
    for (const c of cs) {
      const five = [cards[c[0]], cards[c[1]], cards[c[2]], cards[c[3]], cards[c[4]]];
      const sc = eval5(five);
      if (sc > best) { best = sc; pick = five; }
    }
    return { score: best, cards: pick };
  }

  function handName(score) {
    const cat = Math.floor(score / 759375);          // 15^5
    const top = Math.floor(score / 50625) % 15;      // 15^4
    switch (cat) {
      case 0: return `Carta alta (${rl(top)})`;
      case 1: return `Par de ${rankNome(top)}`;
      case 2: return 'Dois pares';
      case 3: return `Trinca de ${rankNome(top)}`;
      case 4: return `Sequência até ${rl(top)}`;
      case 5: return 'Flush';
      case 6: return 'Full House';
      case 7: return `Quadra de ${rankNome(top)}`;
      default: return top === 14 ? 'Royal Flush' : 'Straight Flush';
    }
  }

  /* Equity por Monte Carlo contra mãos aleatórias */
  function equity(hole, board, nOpp, sims) {
    const known = new Set([...hole, ...board].map(c => c.id));
    const rest = newDeck().filter(c => !known.has(c.id));
    const need = nOpp * 2 + (5 - board.length);
    let total = 0;
    for (let s = 0; s < sims; s++) {
      for (let i = 0; i < need; i++) {
        const j = i + Math.floor(Math.random() * (rest.length - i));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      let k = 0;
      const opps = [];
      for (let o = 0; o < nOpp; o++) opps.push([rest[k++], rest[k++]]);
      const full = board.slice();
      while (full.length < 5) full.push(rest[k++]);
      const mine = bestScore([...hole, ...full]);
      let ties = 0, lost = false;
      for (const oh of opps) {
        const sc = bestScore([...oh, ...full]);
        if (sc > mine) { lost = true; break; }
        if (sc === mine) ties++;
      }
      if (!lost) total += 1 / (1 + ties);
    }
    return total / sims;
  }

  /* ---------------------------------------------------------
     Estado do jogo
  --------------------------------------------------------- */
  let G = null;          // estado atual
  let runId = 0;         // invalida partidas antigas ao reiniciar
  let pending = null;    // promessa aguardando clique do jogador
  let seatEls = [];
  const el = {};

  function makePlayers() {
    const base = [
      { id: 0, name: 'Você', avatar: 'av-you', ring: 'ring-you', human: true },
      { id: 1, name: 'Barão', avatar: 'av-baron', ring: 'ring-baron', style: { tight: 0.03, aggr: 0.55, bluff: 0.05 } },
      { id: 2, name: 'Lola', avatar: 'av-lola', ring: 'ring-lola', style: { tight: -0.04, aggr: 0.8, bluff: 0.14 } },
      { id: 3, name: 'Kenji', avatar: 'av-kenji', ring: 'ring-kenji', style: { tight: -0.07, aggr: 0.35, bluff: 0.04 } },
    ];
    return base.map(p => ({
      ...p, stack: START_STACK, hole: [], bet: 0, totalBet: 0,
      folded: false, allIn: false, acted: false, out: false,
      reveal: false, tag: '', win: 0, best: null,
    }));
  }

  function sleep(ms) {
    const id = runId;
    return new Promise((res, rej) => setTimeout(() => (id === runId ? res() : rej(CANCEL)), ms));
  }
  function waitUI() { return new Promise((res, rej) => { pending = { res, rej }; }); }
  function resolvePending(v) {
    if (!pending) return;
    const p = pending; pending = null; p.res(v);
  }

  const pot = () => G.players.reduce((s, p) => s + p.totalBet, 0);
  const liveCount = () => G.players.filter(p => !p.folded).length;
  const canActCount = () => G.players.filter(p => !p.folded && !p.allIn).length;
  function nextSeat(from, pred) {
    const n = G.players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (from + i) % n;
      if (pred(G.players[idx])) return idx;
    }
    return -1;
  }

  /* ---------------------------------------------------------
     Salvamento automático (localStorage)
     O estado só é gravado em pontos seguros do fluxo: depois de cada
     jogada, ao abrir cada rodada de apostas e entre as mãos.
  --------------------------------------------------------- */
  const SAVE_KEY = 'casinofest:poker:v1';

  function save(resumeIdx) {
    if (!G) return;
    if (resumeIdx !== undefined) G.resumeIdx = resumeIdx;
    try {
      const snap = { ...G, hl: [...G.hl], waiting: false, turn: -1, status: '', raiseTo: null };
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, savedAt: Date.now(), game: snap }));
    } catch (e) { /* sem armazenamento (aba anônima, cota cheia): segue sem salvar */ }
  }
  function loadSave() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      const s = data && data.v === 1 && data.game;
      if (!s || !Array.isArray(s.players) || s.players.length !== 4 || !['play', 'next', 'over'].includes(s.mode)) return null;
      return s;
    } catch (e) { return null; }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignora */ }
  }

  function log(msg, cls = '') {
    if (G) {
      (G.logs = G.logs || []).push([msg, cls]);
      if (G.logs.length > 80) G.logs.splice(0, G.logs.length - 80);
    }
    const li = document.createElement('li');
    if (cls) li.className = cls;
    li.textContent = msg;
    el.log.appendChild(li);
    while (el.log.children.length > 80) el.log.removeChild(el.log.firstChild);
    el.log.scrollTop = el.log.scrollHeight;
  }

  /* ---------------------------------------------------------
     Renderização
  --------------------------------------------------------- */
  const TAG_KIND = { Fold: 'fold', Check: 'check', Pagou: 'call', Apostou: 'raise', Aumentou: 'raise', 'All-in': 'allin' };

  /* Dica da sua mão atual, mostrada embaixo do seu nome */
  function handHint(p) {
    if (p.hole.length < 2 || p.out) return '';
    if (G.board.length >= 3) return handName(bestScore([...p.hole, ...G.board]));
    const [a, b] = p.hole[0].r >= p.hole[1].r ? p.hole : [p.hole[1], p.hole[0]];
    if (a.r === b.r) return `Par de ${rankNome(a.r)}`;
    return `${rl(a.r)}-${rl(b.r)}${a.s === b.s ? ' do mesmo naipe' : ''}`;
  }

  function buildSeats() {
    const host = $('#seats');
    host.innerHTML = '';
    seatEls = G.players.map(p => {
      const d = document.createElement('div');
      d.className = `seat seat-${p.id}`;
      d.innerHTML =
        `<div class="bet"></div>` +
        `<div class="hole"><div class="card"></div><div class="card"></div></div>` +
        `<div class="plate"><span class="avatar ${p.ring}">${avatarImg(p.avatar)}</span>` +
        `<div class="who"><b class="name">${p.name}</b>` +
        (p.human ? '' : `<span class="stack"></span>`) +
        `<span class="tag"></span></div>` +
        `<div class="dealer-btn" hidden title="Dealer">D</div></div>`;
      host.appendChild(d);
      return d;
    });
  }

  function render() {
    if (!G) return;
    // Pote: só as fichas já recolhidas das rodadas anteriores ficam no centro
    const total = pot();
    const inFront = G.players.reduce((s, p) => s + p.bet, 0);
    const collected = total - inFront;
    el.potAmount.textContent = fmt(total);
    if (el.potChips.dataset.v !== String(collected)) {
      el.potChips.dataset.v = String(collected);
      el.potChips.innerHTML = chipColumns(collected);
    }
    el.pot.classList.toggle('empty', collected <= 0);
    el.pot.classList.toggle('paid', !!G.paid);

    // Barra da mesa
    const hand = Math.max(G.hand, 1);
    const lvl = Math.min(Math.floor((hand - 1) / HANDS_PER_LEVEL), BLIND_LEVELS.length - 1);
    const lastLvl = lvl === BLIND_LEVELS.length - 1;
    const left = HANDS_PER_LEVEL - ((hand - 1) % HANDS_PER_LEVEL);
    el.infoHand.textContent = hand;
    el.infoBlinds.textContent = `${G.sb}/${G.bb}`;
    el.infoLevel.textContent = `Nível ${lvl + 1}`;
    el.infoNext.textContent = lastLvl ? 'nível máximo' : (left === 1 ? 'sobe na próxima mão' : `sobe em ${left} mãos`);
    el.levelFill.style.width = lastLvl ? '100%' : `${((HANDS_PER_LEVEL - left + 1) / HANDS_PER_LEVEL) * 100}%`;

    // suas fichas na mesa são as fichas da carteira (valem em todos os jogos)
    if (G.players[0].stack !== wallet.balance) wallet.set(G.players[0].stack, { silent: true });

    const boardSlots = el.board.children;
    for (let i = 0; i < 5; i++) setCard(boardSlots[i], G.board[i], true, G.board[i] && G.hl.has(G.board[i].id));
    el.table.classList.toggle('has-hl', G.hl.size > 0);

    G.players.forEach((p, i) => {
      const s = seatEls[i];
      s.classList.toggle('turn', G.turn === p.id);
      s.classList.toggle('folded', p.folded && !p.out);
      s.classList.toggle('out', p.out);
      s.classList.toggle('winner', G.winners.includes(p.id));
      const stackEl = $('.stack', s);
      if (stackEl) stackEl.textContent = p.out ? 'Eliminado' : fmt(p.stack);

      const tagEl = $('.tag', s);
      const thinking = !p.human && G.turn === p.id;
      let tagText = p.out ? (p.human ? 'Eliminado' : '') : p.tag;
      let kind = TAG_KIND[tagText] || 'info';
      if (!tagText && p.human && !p.out) { tagText = handHint(p); kind = 'hint'; }
      const tagKey = thinking ? '…' : tagText;
      if (tagEl.dataset.key !== tagKey) {
        tagEl.dataset.key = tagKey;
        tagEl.dataset.kind = thinking ? 'think' : kind;
        if (thinking) tagEl.innerHTML = '<span class="dots" aria-label="pensando"><i></i><i></i><i></i></span>';
        else tagEl.textContent = tagText;
      }

      const betEl = $('.bet', s);
      const betKey = String(p.bet);
      if (betEl.dataset.v !== betKey) {
        betEl.dataset.v = betKey;
        betEl.hidden = p.bet <= 0;
        betEl.innerHTML = p.bet > 0 ? `${chipStack(p.bet)}<b>${fmt(p.bet)}</b>` : '';
      }
      $('.dealer-btn', s).hidden = !(G.dealer === p.id && !p.out && G.hand > 0);
      const slots = $('.hole', s).children;
      for (let k = 0; k < 2; k++) {
        const c = p.hole[k];
        if (!c || (p.folded && !p.human)) setCard(slots[k], null);
        else setCard(slots[k], c, p.human || p.reveal, G.hl.has(c.id));
      }
    });

    showBanner(el.banner, G.banner, G.bannerLose);
    renderControls();
  }

  function renderControls() {
    const me = G.players[0];
    const play = G.mode === 'play';
    el.actions.hidden = !play;
    el.raiseBox.hidden = !play;
    el.nextRow.hidden = play;

    if (!play) {
      el.btnNext.innerHTML = G.mode !== 'over' ? 'Próxima mão <kbd>Enter</kbd>'
        : (wallet.balance < BLIND_LEVELS[0][1] ? `Ganhar ${fmt(wallet.REFILL_AMOUNT)} e jogar` : 'Abrir nova mesa');
      el.status.textContent = '';
      el.status.classList.remove('mine');
      el.controls.classList.remove('my-turn', 'disabled');
      return;
    }

    const on = !!G.waiting;
    el.controls.classList.toggle('disabled', !on);
    el.controls.classList.toggle('my-turn', on);
    [el.btnFold, el.btnCall, el.btnRaise, el.range, el.minus, el.plus, ...el.quick].forEach(b => { b.disabled = !on; });
    el.status.textContent = G.status || '';
    el.status.classList.toggle('mine', on);
    if (!on) return;

    const diff = G.currentBet - me.bet;
    const toCall = Math.min(diff, me.stack);
    const maxTo = me.bet + me.stack;
    const minTo = Math.min(G.currentBet + G.minRaise, maxTo);
    const canRaise = me.stack > diff && maxTo > G.currentBet;

    el.callLabel.textContent = diff <= 0 ? 'Check' : (toCall >= me.stack ? `All-in ${fmt(me.stack)}` : `Pagar ${fmt(toCall)}`);
    el.btnRaise.hidden = !canRaise;
    el.raiseBox.hidden = !canRaise;
    el.actions.style.gridTemplateColumns = canRaise ? '' : '1fr 1.6fr';
    if (!canRaise) return;

    el.range.min = minTo;
    el.range.max = maxTo;
    if (G.raiseTo == null) G.raiseTo = minTo;
    G.raiseTo = Math.max(minTo, Math.min(maxTo, G.raiseTo));
    el.range.value = G.raiseTo;
    updateRaiseLabel();
  }

  function updateRaiseLabel() {
    const me = G.players[0];
    const maxTo = me.bet + me.stack;
    el.raiseLabel.textContent = G.raiseTo >= maxTo
      ? `All-in ${fmt(maxTo)}`
      : `${G.currentBet === 0 ? 'Apostar' : 'Aumentar para'} ${fmt(G.raiseTo)}`;
  }

  function setRaiseTo(v) {
    if (!G.waiting) return;
    const me = G.players[0];
    const maxTo = me.bet + me.stack;
    const minTo = Math.min(G.currentBet + G.minRaise, maxTo);
    G.raiseTo = Math.max(minTo, Math.min(maxTo, Math.round(v)));
    el.range.value = G.raiseTo;
    updateRaiseLabel();
  }

  /* ---------------------------------------------------------
     Mecânica de apostas
  --------------------------------------------------------- */
  function commit(p, amt) {
    amt = Math.max(0, Math.min(amt, p.stack));
    p.stack -= amt; p.bet += amt; p.totalBet += amt;
    if (p.stack === 0) p.allIn = true;
  }

  function applyAction(p, a) {
    const toCall = G.currentBet - p.bet;
    if (a.type === 'raise' && a.to <= G.currentBet) a = { type: 'call' };

    const cls = p.human ? 'me' : '';
    if (a.type === 'fold') {
      p.folded = true; p.tag = 'Fold';
      log(`${p.name} desistiu.`, cls);
    } else if (a.type === 'call') {
      const amt = Math.min(toCall, p.stack);
      commit(p, amt);
      if (toCall <= 0) { p.tag = 'Check'; log(`${p.name} deu check.`, cls); }
      else if (p.allIn) { p.tag = 'All-in'; log(`${p.name} pagou ${fmt(amt)} e foi all-in.`, cls); }
      else { p.tag = 'Pagou'; log(`${p.name} pagou ${fmt(amt)}.`, cls); }
    } else {
      const maxTo = p.bet + p.stack;
      const minTo = Math.min(G.currentBet + G.minRaise, maxTo);
      const to = Math.max(minTo, Math.min(a.to, maxTo));
      const wasOpen = G.currentBet === 0;
      commit(p, to - p.bet);
      const size = to - G.currentBet;
      if (size >= G.minRaise) G.minRaise = size;
      G.currentBet = to;
      G.streetRaises = (G.streetRaises || 0) + 1;
      G.players.forEach(q => { if (q !== p && !q.folded && !q.allIn) q.acted = false; });
      if (p.allIn) { p.tag = 'All-in'; log(`${p.name} foi all-in com ${fmt(to)}!`, cls); }
      else { p.tag = wasOpen ? 'Apostou' : 'Aumentou'; log(`${p.name} ${wasOpen ? 'apostou' : 'aumentou para'} ${fmt(to)}.`, cls); }
    }
    p.acted = true;
  }

  const thinkTime = () => (G.players[0].folded || G.players[0].out ? rnd(250, 600) : rnd(650, 1300));

  async function takeTurn(p) {
    G.turn = p.id;
    G.status = p.human ? 'Sua vez' : `${p.name} está pensando…`;
    render();
    let action;
    if (p.human) {
      save(p.id);
      G.waiting = true;
      G.raiseTo = null;
      render();
      action = await waitUI();
      G.waiting = false;
    } else {
      await sleep(thinkTime());
      action = botDecide(p);
    }
    G.turn = -1;
    G.status = '';
    applyAction(p, action);
    save((p.id + 1) % G.players.length);
    render();
    if (!p.human) await sleep(220);
  }

  async function bettingRound(startIdx) {
    let i = startIdx;
    for (;;) {
      const live = G.players.filter(p => !p.folded);
      if (live.length <= 1) return;
      const canAct = live.filter(p => !p.allIn);
      if (canAct.length === 0) return;
      if (canAct.length === 1 && canAct[0].bet >= G.currentBet) return;
      if (canAct.every(p => p.acted && p.bet === G.currentBet)) return;

      const p = G.players[i];
      if (!p.folded && !p.allIn && !(p.acted && p.bet === G.currentBet)) await takeTurn(p);
      i = (i + 1) % G.players.length;
    }
  }

  function newStreet() {
    G.players.forEach(p => {
      p.bet = 0; p.acted = false;
      if (!p.folded && !p.allIn) p.tag = '';
    });
    G.currentBet = 0;
    G.minRaise = G.bb;
    G.streetRaises = 0;
  }

  /* ---------------------------------------------------------
     IA dos bots
  --------------------------------------------------------- */
  // Categoria da mão que usa as cartas do bot (0 se a mão vem toda da mesa)
  // 1 par · 2 dois pares · 3 trinca · 4 sequência · 5 flush · 6 full house · 7 quadra · 8 straight flush
  function madeCategory(p) {
    if (G.board.length < 3) return p.hole[0].r === p.hole[1].r ? 1 : 0;
    const cat = Math.floor(bestScore([...p.hole, ...G.board]) / 759375);
    const cnt = {};
    G.board.forEach(c => { cnt[c.r] = (cnt[c.r] || 0) + 1; });
    const m = Object.values(cnt).sort((a, b) => b - a);
    const boardCat = m[0] >= 4 ? 7 : m[0] === 3 ? (m[1] >= 2 ? 6 : 3) : m[0] === 2 ? (m[1] === 2 ? 2 : 1) : 0;
    return cat > boardCat ? cat : 0;
  }

  function botDecide(p) {
    const st = p.style;
    const diff = G.currentBet - p.bet;
    const toCall = Math.min(diff, p.stack);
    const pt = pot();
    const opp = G.players.filter(q => !q.folded && q !== p).length;
    const street = G.board.length;                       // 0 pré-flop · 3 flop · 4 turn · 5 river
    const eq = equity(p.hole, G.board, opp, street === 0 ? 300 : 400);
    const base = 1 / (opp + 1);
    // força relativa: 1 = mão média contra esse número de rivais; o estilo do bot mexe na régua
    const rel = eq / base + rnd(-0.08, 0.08) - st.tight * 3;
    const made = madeCategory(p);

    const maxTo = p.bet + p.stack;
    const minTo = Math.min(G.currentBet + G.minRaise, maxTo);
    const canRaise = p.stack > diff && maxTo > G.currentBet && (G.streetRaises || 0) < 4;
    const chance = x => Math.random() < x;

    const mkRaise = frac => {
      let to = G.currentBet + round5(frac * (pt + toCall));
      to = Math.max(minTo, Math.min(to, maxTo));
      if (to >= maxTo * 0.8) to = maxTo; // compromete a pilha → all-in
      return { type: 'raise', to };
    };

    // monstro: trinca ou melhor (ou AA/KK no pré-flop) · forte: dois pares, par alto · médio: par fraco
    const monster = made >= 3 || (street === 0 ? rel >= 2.2 : rel >= 3.2);
    const strong = monster || made === 2 || (made === 1 && street > 0 && rel >= 1.6) || rel >= 1.8;
    const medium = strong || (made === 1 && street > 0) || rel >= 1.15;

    // Ninguém apostou: aposta por valor com mão boa (em vez de só dar check)
    if (diff <= 0) {
      if (!canRaise) return { type: 'call' };
      if (monster) return chance(street < 5 ? 0.82 : 0.92) ? mkRaise(rnd(0.55, 0.9)) : { type: 'call' }; // às vezes faz slowplay
      if (strong) return chance(0.45 + 0.35 * st.aggr) ? mkRaise(rnd(0.4, 0.7)) : { type: 'call' };
      if (medium && street > 0) return chance(0.15 + 0.25 * st.aggr) ? mkRaise(rnd(0.33, 0.5)) : { type: 'call' };
      if (opp <= 2 && street > 0 && chance(st.bluff * 2)) return mkRaise(rnd(0.45, 0.6)); // blefe
      return { type: 'call' };
    }

    // Enfrentando uma aposta: equity mínima = odds do pote + margem (mais exigente contra apostas grandes)
    const potOdds = toCall / Math.max(pt + toCall, 1);
    const betSize = toCall / Math.max(pt - toCall, 1);   // aposta em relação ao pote antes dela
    let need = potOdds + 0.03 + st.tight + Math.min(0.12, betSize * 0.08);
    if (toCall >= p.stack) need += 0.06;                 // pagar all-in exige mais
    // pré-flop, pagar pouco para ver o flop com mão razoável é normal
    if (street === 0 && toCall <= G.bb * 3) need = Math.min(need, base * 1.15 + st.tight);

    if (canRaise && monster && chance(0.4 + 0.35 * st.aggr)) return mkRaise(rnd(0.8, 1.15));
    if (canRaise && strong && street > 0 && toCall <= pt * 0.4 && chance(0.12 * st.aggr)) return mkRaise(rnd(0.7, 1));
    if (canRaise && street > 0 && street < 5 && toCall <= pt * 0.5 && chance(st.bluff)) return mkRaise(0.8); // semi-blefe
    if (eq >= need) return { type: 'call' };
    if (made >= 2 && toCall <= pt * 0.75) return { type: 'call' };      // dois pares ou melhor não larga fácil
    if (made === 1 && toCall <= pt * 0.35) return { type: 'call' };      // par paga aposta pequena
    if (street === 0 && toCall <= G.bb && eq > base * 0.65 && chance(0.3 - st.tight * 2)) return { type: 'call' }; // olhadinha barata
    return { type: 'fold' };
  }

  /* ---------------------------------------------------------
     Fluxo de uma mão
  --------------------------------------------------------- */
  function postBlind(p, amt) {
    commit(p, amt);
    p.tag = p.allIn ? 'All-in' : '';
  }

  async function playHand(resume = false) {
    if (!resume) await startHand();

    // Pré-flop, flop, turn e river. Ao retomar, continua da rua e do jogador salvos.
    const streets = [['preflop', 0], ['flop', 3], ['turn', 1], ['river', 1]];
    for (let si = Math.max(0, streets.findIndex(s => s[0] === G.stage)); si < streets.length; si++) {
      const [name, count] = streets[si];
      if (!resume && name !== 'preflop') {
        if (liveCount() <= 1) break;
        await openStreet(name, count);
      }
      resume = false;
      await bettingRound(G.resumeIdx);
    }

    await sleep(500);
    settle();
    render();
  }

  async function startHand() {
    const players = G.players;
    G.hand++;
    const lvl = Math.min(Math.floor((G.hand - 1) / HANDS_PER_LEVEL), BLIND_LEVELS.length - 1);
    [G.sb, G.bb] = BLIND_LEVELS[lvl];

    players.forEach(p => {
      p.hole = []; p.bet = 0; p.totalBet = 0; p.folded = p.out; p.allIn = false;
      p.acted = false; p.reveal = false; p.tag = ''; p.win = 0; p.best = null;
    });
    G.board = []; G.winners = []; G.hl = new Set(); G.banner = null; G.bannerLose = false; G.paid = false;
    G.turn = -1; G.waiting = false; G.status = '';
    G.deck = shuffle(newDeck());
    G.dealer = nextSeat(G.dealer, p => !p.out);

    log(`── Mão ${G.hand} · Blinds ${G.sb}/${G.bb} ──`, 'sep');
    render();
    await sleep(350);

    // Blinds
    const alive = players.filter(p => !p.out);
    let sbP, bbP;
    if (alive.length === 2) {
      sbP = players[G.dealer];
      bbP = players[nextSeat(G.dealer, p => !p.out)];
    } else {
      sbP = players[nextSeat(G.dealer, p => !p.out)];
      bbP = players[nextSeat(sbP.id, p => !p.out)];
    }
    postBlind(sbP, G.sb);
    postBlind(bbP, G.bb);
    G.currentBet = G.bb;
    G.minRaise = G.bb;
    G.streetRaises = 0;
    log(`${sbP.name} pagou o small blind (${fmt(sbP.bet)}) e ${bbP.name} o big blind (${fmt(bbP.bet)}).`);

    // Distribuição das cartas
    for (let round = 0; round < 2; round++) {
      let idx = G.dealer;
      for (let k = 0; k < players.length; k++) {
        idx = (idx + 1) % players.length;
        const p = players[idx];
        if (p.out) continue;
        p.hole.push(G.deck.pop());
        render();
        await sleep(110);
      }
    }
    await sleep(250);

    G.stage = 'preflop';
    G.revealed = false;
    save(nextSeat(bbP.id, p => !p.folded && !p.allIn));
  }

  async function openStreet(name, count) {
    G.stage = name;
    newStreet();
    render();
    await sleep(450);
    if (!G.revealed && canActCount() <= 1) {
      G.revealed = true;
      G.players.forEach(p => { if (!p.folded) p.reveal = true; });
      log('Todos all-in: as cartas vão para a mesa!');
      render();
      await sleep(900);
    }
    G.deck.pop(); // queima uma carta
    for (let k = 0; k < count; k++) {
      G.board.push(G.deck.pop());
      render();
      await sleep(count > 1 ? 170 : 0);
    }
    log(`${{ flop: 'Flop', turn: 'Turn', river: 'River' }[name]}: ${G.board.map(c => rl(c.r) + SUITS[c.s]).join(' ')}`);
    save(nextSeat(G.dealer, p => !p.folded && !p.allIn));
    await sleep(300);
  }

  /* ---------------------------------------------------------
     Pots, showdown e premiação
  --------------------------------------------------------- */
  function buildPots() {
    const contrib = G.players.filter(p => p.totalBet > 0);
    const levels = [...new Set(contrib.map(p => p.totalBet))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    for (const lvl of levels) {
      const payers = contrib.filter(p => p.totalBet >= lvl);
      const amount = (lvl - prev) * payers.length;
      const eligible = payers.filter(p => !p.folded);
      if (eligible.length === 0 && pots.length) pots[pots.length - 1].amount += amount;
      else pots.push({ amount, eligible: eligible.length ? eligible : G.players.filter(p => !p.folded) });
      prev = lvl;
    }
    return pots;
  }

  function settle() {
    const players = G.players;
    const live = players.filter(p => !p.folded);
    const total = pot();
    let msg, title;

    if (live.length === 1) {
      const w = live[0];
      w.stack += total; w.win = total;
      G.winners = [w.id];
      w.tag = `+${fmt(total)}`;
      msg = `${w.human ? 'Você levou' : w.name + ' levou'} ${fmt(total)}: todos desistiram.`;
      title = w.human ? 'Você levou o pote!' : `${w.name} levou o pote`;
      G.banner = { kicker: 'Todos desistiram', title, amount: (w.human ? '+' : '') + fmt(total) };
    } else {
      live.forEach(p => {
        p.reveal = true;
        p.best = bestHand([...p.hole, ...G.board]);
        p.tag = handName(p.best.score);
      });
      for (const potObj of buildPots()) {
        let top = -1, winners = [];
        for (const p of potObj.eligible) {
          if (p.best.score > top) { top = p.best.score; winners = [p]; }
          else if (p.best.score === top) winners.push(p);
        }
        winners.sort((a, b) => ((a.id - G.dealer + 4) % 4) - ((b.id - G.dealer + 4) % 4));
        const share = Math.floor(potObj.amount / winners.length);
        let rem = potObj.amount - share * winners.length;
        winners.forEach(w => {
          const extra = rem > 0 ? 1 : 0; rem -= extra;
          w.stack += share + extra; w.win += share + extra;
        });
      }
      const ws = live.filter(p => p.win > 0);
      G.winners = ws.map(p => p.id);
      ws.forEach(p => {
        p.best.cards.forEach(c => G.hl.add(c.id));
        p.tag = `${handName(p.best.score)} · +${fmt(p.win)}`;
      });
      if (ws.length === 1) {
        const w = ws[0];
        msg = `${w.human ? 'Você ganhou' : w.name + ' ganhou'} ${fmt(w.win)} com ${handName(w.best.score)}.`;
        G.banner = {
          kicker: handName(w.best.score),
          title: w.human ? 'Você ganhou!' : `${w.name} venceu`,
          amount: (w.human ? '+' : '') + fmt(w.win),
        };
      } else {
        msg = 'Pote dividido: ' + ws.map(w => `${w.name} (${fmt(w.win)})`).join(' e ') + '.';
        // quem dividiu vai na etiqueta; o valor mostra só a sua parte (ou quanto cada um levou)
        const names = ws.map(w => (w.human ? 'Você' : w.name));
        const list = names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
        const me = ws.find(w => w.human);
        const even = ws.every(w => Math.abs(w.win - ws[0].win) <= 1);
        G.banner = {
          kicker: `${handName(ws[0].best.score)} · ${list}`,
          title: 'Pote dividido',
          amount: me ? '+' + fmt(me.win) : even ? `${fmt(ws[0].win)} cada` : '',
        };
      }
    }

    G.bannerLose = !G.winners.includes(0);
    G.paid = true;
    players.forEach(p => { p.bet = 0; });
    log(msg, 'win');
    if (!G.bannerLose) setTimeout(() => confetti(G.winners.length > 1 ? 70 : 150, el.table), 120);

    players.forEach(p => {
      if (!p.out && p.stack <= 0) {
        p.out = true; p.stack = 0; p.tag = '';
        log(`${p.name} ficou sem fichas e foi eliminado.`);
      }
    });
  }

  /* ---------------------------------------------------------
     Partida
  --------------------------------------------------------- */
  async function runGame(resume = false) {
    try {
      for (;;) {
        // ao retomar entre mãos (ou com o jogo encerrado), só mostra o resultado salvo
        if (!(resume && G.mode !== 'play')) {
          await playHand(resume);
          const alive = G.players.filter(p => !p.out);
          if (G.players[0].out) {
            G.mode = 'over';
            G.banner = { kicker: 'Suas fichas acabaram', title: 'Fim de jogo', amount: '' };
            G.bannerLose = true;
          } else if (alive.length === 1) {
            G.mode = 'over';
            G.banner = { kicker: `Mesa vencida em ${G.hand} mãos`, title: 'Campeão da mesa!', amount: fmt(G.players[0].stack) };
            G.bannerLose = false;
            setTimeout(() => confetti(260, el.table), 300);
          } else {
            G.mode = 'next';
          }
        }
        resume = false;
        render();
        save();
        if (G.mode === 'over') return;
        await waitUI();
        G.mode = 'play';
        G.banner = null;
      }
    } catch (e) {
      if (e !== CANCEL) console.error(e);
    }
  }

  function newGame() {
    // sem fichas para o big blind: ganha a recarga grátis antes de sentar
    if (wallet.balance < BLIND_LEVELS[0][1]) wallet.requestRefill(true);
    runId++;
    if (pending) { const p = pending; pending = null; p.rej(CANCEL); }
    clearSave();
    const players = makePlayers();
    players[0].stack = wallet.balance;
    G = {
      players, board: [], deck: [], dealer: 3,
      currentBet: 0, minRaise: 20, sb: 10, bb: 20, hand: 0,
      mode: 'play', waiting: false, turn: -1, banner: null, bannerLose: false,
      status: '', winners: [], hl: new Set(), raiseTo: null, paid: false,
      stage: 'preflop', resumeIdx: 0, revealed: false, logs: [],
    };
    el.log.innerHTML = '';
    confetti.stop();
    buildSeats();
    render();
    log(`Nova mesa! Você senta com ${fmt(players[0].stack)} e cada adversário com ${fmt(START_STACK)}.`, 'sep');
    runGame();
  }

  /* As fichas podem mudar fora da mesa (outro jogo, recarga): a mesa acompanha a carteira */
  function syncFromWallet() {
    const me = G.players[0];
    me.stack = wallet.balance;
    if (me.stack > 0 && me.out) me.out = false;
    // no meio da mão, sem fichas sobrando = all-in com o que já apostou
    if (G.mode === 'play' && me.stack === 0 && !me.folded && me.totalBet > 0) me.allIn = true;
  }

  /* Volta exatamente para onde a partida salva parou */
  function restoreGame(saved) {
    runId++;
    if (pending) { const p = pending; pending = null; p.rej(CANCEL); }
    // dados fixos (nome, avatar, estilo) vêm do código; o resto vem do save
    const base = makePlayers();
    const players = base.map((b, i) => ({
      ...b, ...saved.players[i],
      id: b.id, name: b.name, avatar: b.avatar, ring: b.ring, style: b.style, human: b.human,
    }));
    const logs = saved.logs || [];
    G = { ...saved, players, hl: new Set(saved.hl || []), logs: [], waiting: false, turn: -1, status: '', raiseTo: null };
    el.log.innerHTML = '';
    logs.forEach(([m, c]) => log(m, c));
    confetti.stop();
    syncFromWallet();
    buildSeats();
    render();
    log('Partida retomada de onde você parou.', 'sep');
    toast('Partida retomada de onde você parou');
    runGame(true);
  }

  /* ---------------------------------------------------------
     Interação
  --------------------------------------------------------- */
  function humanAct(a) {
    if (!G || G.mode !== 'play' || !G.waiting) return;
    G.waiting = false;
    renderControls();
    resolvePending(a);
  }
  function nextHand() {
    if (!G) return;
    if (G.mode === 'over') {
      newGame();
    } else if (G.mode === 'next') resolvePending();
  }

  function init() {
    Object.assign(el, {
      table: $('#table'), pot: $('#pot'), potChips: $('#pot-chips'), potAmount: $('#pot-amount'),
      board: $('#board'), banner: $('#banner'),
      infoLevel: $('#info-level'), infoNext: $('#info-next'), levelFill: $('#level-fill'),
      controls: $('#controls'), status: $('#status'),
      raiseBox: $('#raise-box'), actions: $('#actions'), nextRow: $('#next-row'),
      btnFold: $('#btn-fold'), btnCall: $('#btn-call'), btnRaise: $('#btn-raise'), btnNext: $('#btn-next'),
      callLabel: $('#call-label'), raiseLabel: $('#raise-label'),
      range: $('#raise-range'), minus: $('#amt-minus'), plus: $('#amt-plus'),
      quick: [...document.querySelectorAll('.quick button')],
      log: $('#log'), infoHand: $('#info-hand'), infoBlinds: $('#info-blinds'),
    });

    for (let i = 0; i < 5; i++) {
      const c = document.createElement('div');
      c.className = 'card empty';
      el.board.appendChild(c);
    }

    el.btnFold.addEventListener('click', () => humanAct({ type: 'fold' }));
    el.btnCall.addEventListener('click', () => humanAct({ type: 'call' }));
    el.btnRaise.addEventListener('click', () => humanAct({ type: 'raise', to: G.raiseTo }));
    el.btnNext.addEventListener('click', nextHand);
    $('#btn-new').addEventListener('click', () => {
      const inHand = G && G.mode === 'play' && G.hand > 0;
      if (inHand && !confirm('Abrir uma nova mesa? As fichas já apostadas nesta mão ficam no pote.')) return;
      newGame();
    });

    // recarga só entre as mãos; depois dela a mesa usa o novo saldo
    wallet.setRefillGuard(() => (G && G.mode === 'play' ? 'Termine a mão atual para recarregar as fichas.' : null));
    wallet.onChange(() => {
      if (!G) return;
      syncFromWallet();
      render();
      save();
    });

    el.range.addEventListener('input', () => setRaiseTo(Number(el.range.value)));
    el.minus.addEventListener('click', () => setRaiseTo((G.raiseTo || 0) - G.bb));
    el.plus.addEventListener('click', () => setRaiseTo((G.raiseTo || 0) + G.bb));
    el.quick.forEach(b => b.addEventListener('click', () => {
      if (!G.waiting) return;
      const me = G.players[0];
      const maxTo = me.bet + me.stack;
      if (b.dataset.frac === 'max') return setRaiseTo(maxTo);
      const toCall = Math.min(G.currentBet - me.bet, me.stack);
      setRaiseTo(G.currentBet + round5(Number(b.dataset.frac) * (pot() + toCall)));
    }));

    document.addEventListener('keydown', e => {
      if (!G || e.ctrlKey || e.metaKey || e.altKey) return;
      const onControl = e.target.closest && e.target.closest('button, input');
      if (G.mode === 'next' || G.mode === 'over') {
        if ((e.key === 'Enter' || e.key === ' ') && !onControl) { e.preventDefault(); nextHand(); }
        return;
      }
      if (!G.waiting) return;
      const k = e.key.toLowerCase();
      if (k === 'f') humanAct({ type: 'fold' });
      else if (k === 'c') humanAct({ type: 'call' });
      else if ((k === 'r' || (k === 'enter' && !onControl)) && !el.btnRaise.hidden) humanAct({ type: 'raise', to: G.raiseTo });
    });

    const saved = loadSave();
    if (!saved) return newGame();
    try { restoreGame(saved); }
    catch (e) { console.error(e); newGame(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
