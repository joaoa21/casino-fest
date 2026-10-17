/* ==========================================================
   Casino Fest · Paciência (Klondike)
   Sete colunas, monte, descarte e quatro pilhas do Ás ao Rei.
   Modo Clássico: grátis, com pontos, tempo e desfazer.
   Modo Vegas: a partida custa 52× o valor por carta e cada carta
   que sobe para as pilhas paga 5× (fichas da carteira única).
   ========================================================== */
(() => {
  'use strict';

  const { fmt, $, toast, wallet, cardHtml, BACK_HTML, showBanner, sfx } = window.Casino;

  /* ---------------------------------------------------------
     Constantes
  --------------------------------------------------------- */
  const SAVE_KEY = 'casinofest:paciencia:v1';
  const PREF_KEY = 'casinofest:paciencia:prefs';
  const STATS_KEY = 'casinofest:paciencia:stats';
  const STAKES = [1, 2, 5, 10];
  const VEGAS_PAY = 5;                    // cada carta nas pilhas paga 5× o valor por carta
  const VEGAS_RECYCLES = { 1: 0, 3: 2 };  // Vegas: comprar 1 = uma passada; comprar 3 = três passadas
  const HISTORY_MAX = 200;
  const SUIT_CHARS = ['♠︎', '♥︎', '♦︎', '♣︎'];
  const RANK_TXT = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  // carta = número de 0 a 51: naipe = id / 13, valor = id % 13 + 1 (Ás = 1)
  const suitOf = id => Math.floor(id / 13);
  const rankOf = id => (id % 13) + 1;
  const isRed = id => suitOf(id) === 1 || suitOf(id) === 2;
  const nameOf = id => RANK_TXT[rankOf(id)] + SUIT_CHARS[suitOf(id)];

  let G = null;          // partida
  let prefs = { mode: 'classic', draw: 1, stake: 1 };
  // recordes (ficam salvos no navegador): best = melhor tempo em segundos
  let stats = { played: 0, won: 0, best: 0, bestScore: 0, bestMoves: 0, bestVegas: 0, streak: 0, bestStreak: 0 };
  const el = {};
  const geo = {};        // medidas da mesa
  let drag = null;
  let busy = false;      // completando sozinho
  let newArmed = 0;      // confirmação para abandonar a partida

  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------------------------------------------------------
     Partida e salvamento
  --------------------------------------------------------- */
  function rand(n) {
    const a = new Uint32Array(1);
    let x;
    do { crypto.getRandomValues(a); x = a[0]; } while (x >= 4294967296 - (4294967296 % n));
    return x % n;
  }
  function newGame() {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) { const j = rand(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const up = Array(52).fill(false);
    const tab = Array.from({ length: 7 }, () => []);
    for (let row = 0; row < 7; row++) {
      for (let c = row; c < 7; c++) tab[c].push(deck.pop());
    }
    tab.forEach(col => { up[col[col.length - 1]] = true; });
    return {
      v: 1, mode: prefs.mode, draw: prefs.draw, stake: prefs.stake,
      stock: deck, waste: [], found: [[], [], [], []], tab, up,
      recycles: 0, moves: 0, score: 0, secs: 0,
      started: false, paidCards: 0, won: false, over: false, history: [],
    };
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { /* sem armazenamento */ } }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s || s.v !== 1 || !Array.isArray(s.tab) || s.tab.length !== 7) return null;
      const all = [...s.stock, ...s.waste, ...s.found.flat(), ...s.tab.flat()];
      return all.length === 52 && new Set(all).size === 52 ? s : null;
    } catch (e) { return null; }
  }
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { /* padrão */ }
  try { Object.assign(stats, JSON.parse(localStorage.getItem(STATS_KEY) || '{}')); } catch (e) { /* padrão */ }
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ok */ } };
  const saveStats = () => { try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) { /* ok */ } };

  /* ---------------------------------------------------------
     Regras
  --------------------------------------------------------- */
  const top = arr => arr[arr.length - 1];
  const foundCount = () => G.found.reduce((s, f) => s + f.length, 0);
  const vegas = () => G.mode === 'vegas';
  const buyIn = () => 52 * G.stake;
  const canRecycle = () => G.waste.length > 0 && (!vegas() || G.recycles < VEGAS_RECYCLES[G.draw]);

  function where(id) {
    let i = G.stock.indexOf(id);
    if (i >= 0) return { pile: 'stock', i: 0, idx: i };
    i = G.waste.indexOf(id);
    if (i >= 0) return { pile: 'waste', i: 0, idx: i };
    for (let f = 0; f < 4; f++) { i = G.found[f].indexOf(id); if (i >= 0) return { pile: 'found', i: f, idx: i }; }
    for (let c = 0; c < 7; c++) { i = G.tab[c].indexOf(id); if (i >= 0) return { pile: 'tab', i: c, idx: i }; }
    return null;
  }
  const pileOf = loc => (loc.pile === 'stock' ? G.stock : loc.pile === 'waste' ? G.waste : loc.pile === 'found' ? G.found[loc.i] : G.tab[loc.i]);

  function canFound(id, f) {
    const t = top(G.found[f]);
    return t === undefined ? rankOf(id) === 1 : suitOf(t) === suitOf(id) && rankOf(id) === rankOf(t) + 1;
  }
  function canTab(id, c) {
    const t = top(G.tab[c]);
    if (t === undefined) return rankOf(id) === 13;
    return G.up[t] && isRed(t) !== isRed(id) && rankOf(id) === rankOf(t) - 1;
  }
  // só dá para pegar: topo do descarte, topo de uma pilha ou cartas viradas da coluna
  function movable(id) {
    const loc = where(id);
    if (!loc || !G.up[id]) return null;
    const pile = pileOf(loc);
    if ((loc.pile === 'waste' || loc.pile === 'found') && loc.idx !== pile.length - 1) return null;
    if (loc.pile === 'stock') return null;
    return { loc, ids: pile.slice(loc.idx) };
  }
  function legal(ids, dest) {
    if (dest.pile === 'found') return ids.length === 1 && canFound(ids[0], dest.i);
    if (dest.pile === 'tab') return canTab(ids[0], dest.i);
    return false;
  }

  /* ---------------------------------------------------------
     Jogadas
  --------------------------------------------------------- */
  function snapshot() {
    if (vegas()) return;
    G.history.push(JSON.stringify({ stock: G.stock, waste: G.waste, found: G.found, tab: G.tab, up: G.up, recycles: G.recycles, score: G.score }));
    if (G.history.length > HISTORY_MAX) G.history.shift();
  }
  // a primeira jogada começa a partida (no Vegas, é aqui que a entrada é paga)
  function begin() {
    if (G.started) return true;
    if (vegas()) {
      if (wallet.balance < buyIn()) { toast(`A partida Vegas custa ${fmt(buyIn())}. Use o + no topo para recarregar.`); return false; }
      wallet.add(-buyIn());
    }
    G.started = true;
    stats.played++;
    saveStats();
    return true;
  }
  const addScore = n => { if (!vegas()) G.score = Math.max(0, G.score + n); };

  function drawStock() {
    if (busy || G.won) return;
    if (!G.stock.length) {
      if (!canRecycle()) {
        if (G.waste.length) toast(vegas() ? 'No Vegas o monte não volta mais nesta partida.' : 'O monte acabou.');
        return;
      }
      if (!begin()) return;
      snapshot();
      G.stock = G.waste.reverse();
      G.waste = [];
      G.stock.forEach(id => { G.up[id] = false; });
      G.recycles++;
      addScore(G.draw === 1 ? -100 : -20);
      G.moves++;
      return after();
    }
    if (!begin()) return;
    snapshot();
    sfx.play('card');
    for (let k = 0; k < G.draw && G.stock.length; k++) {
      const id = G.stock.pop();
      G.up[id] = true;
      G.waste.push(id);
    }
    G.moves++;
    after();
  }

  function moveCards(ids, dest) {
    if (!legal(ids, dest)) return false;
    if (!begin()) return false;
    snapshot();
    sfx.play('card');
    const loc = where(ids[0]);
    const from = pileOf(loc);
    from.splice(loc.idx, ids.length);
    const to = dest.pile === 'found' ? G.found[dest.i] : G.tab[dest.i];
    to.push(...ids);
    // pontos do modo Clássico (como no Windows)
    if (dest.pile === 'found' && loc.pile !== 'found') addScore(10);
    if (dest.pile === 'tab' && loc.pile === 'waste') addScore(5);
    if (dest.pile === 'tab' && loc.pile === 'found') addScore(-15);
    // vira a carta que ficou descoberta na coluna
    if (loc.pile === 'tab') {
      const t = top(G.tab[loc.i]);
      if (t !== undefined && !G.up[t]) { G.up[t] = true; addScore(5); }
    }
    G.moves++;
    after();
    return true;
  }

  // toque numa carta: sobe para a pilha se puder; senão vai para a melhor coluna
  function autoMove(id) {
    const m = movable(id);
    if (!m) return false;
    if (m.ids.length === 1 && m.loc.pile !== 'found') {
      for (let f = 0; f < 4; f++) if (canFound(id, f)) return moveCards(m.ids, { pile: 'found', i: f });
    }
    const order = [];
    for (let c = 0; c < 7; c++) if (!(m.loc.pile === 'tab' && m.loc.i === c)) order.push(c);
    // primeiro colunas com cartas; coluna vazia só se o Rei não estiver já na base
    const full = order.filter(c => G.tab[c].length && canTab(id, c));
    if (full.length) return moveCards(m.ids, { pile: 'tab', i: full[0] });
    const kingAtBase = m.loc.pile === 'tab' && m.loc.idx === 0;
    if (!kingAtBase) {
      const empty = order.find(c => !G.tab[c].length && canTab(id, c));
      if (empty !== undefined) return moveCards(m.ids, { pile: 'tab', i: empty });
    }
    return false;
  }

  function undo() {
    if (busy || G.won) return;
    if (vegas()) return toast('No modo Vegas não dá para desfazer.');
    const s = G.history.pop();
    if (!s) return;
    Object.assign(G, JSON.parse(s));
    G.moves++;
    after(true);
  }

  // dica: a primeira jogada útil que encontrar
  function findHint() {
    const tops = [];
    if (G.waste.length) tops.push(top(G.waste));
    G.tab.forEach(col => { if (col.length) tops.push(top(col)); });
    for (const id of tops) for (let f = 0; f < 4; f++) if (canFound(id, f)) return { ids: [id], dest: { pile: 'found', i: f } };
    // mover um bloco que descobre uma carta virada para baixo (ou esvazia a coluna para um Rei)
    for (let c = 0; c < 7; c++) {
      const col = G.tab[c];
      const k = col.findIndex(id => G.up[id]);
      if (k < 0) continue;
      if (k === 0 && rankOf(col[0]) === 13) continue;
      for (let d = 0; d < 7; d++) {
        if (d === c || !canTab(col[k], d)) continue;
        if (!G.tab[d].length && k === 0) continue;
        return { ids: col.slice(k), dest: { pile: 'tab', i: d } };
      }
    }
    if (G.waste.length) {
      const id = top(G.waste);
      for (let d = 0; d < 7; d++) if (canTab(id, d)) return { ids: [id], dest: { pile: 'tab', i: d } };
    }
    if (G.stock.length || canRecycle()) return { stock: true };
    return null;
  }
  function hint() {
    if (busy || G.won) return;
    const h = findHint();
    clearHint();
    if (!h) return toast('Não há mais jogadas. Comece um novo jogo.');
    if (h.stock) {
      el.slots.stock.classList.add('pc-hint');
      (G.stock.length ? el.cards[top(G.stock)] : el.slots.stock).classList.add('pc-hint');
      toast(G.stock.length ? 'Compre uma carta do monte.' : 'Vire o descarte de volta para o monte.');
    } else {
      h.ids.forEach(id => el.cards[id].classList.add('pc-hint'));
      const pile = h.dest.pile === 'found' ? G.found[h.dest.i] : G.tab[h.dest.i];
      (pile.length ? el.cards[top(pile)] : el.slots[h.dest.pile][h.dest.i]).classList.add('pc-hint', 'pc-target');
    }
    hintTimer = setTimeout(clearHint, 1600);
  }
  let hintTimer = 0;
  function clearHint() {
    clearTimeout(hintTimer);
    el.board.querySelectorAll('.pc-hint').forEach(n => n.classList.remove('pc-hint', 'pc-target'));
  }

  const canFinish = () => !G.won && !G.stock.length && !G.waste.length && G.tab.every(col => col.every(id => G.up[id]));

  async function finishAll() {
    if (busy || !canFinish()) return;
    busy = true;
    render();
    while (foundCount() < 52) {
      let best = null;
      G.tab.forEach(col => {
        const id = top(col);
        if (id === undefined) return;
        for (let f = 0; f < 4; f++) if (canFound(id, f) && (best === null || rankOf(id) < rankOf(best.id))) best = { id, f };
      });
      if (!best) break;
      busy = false;
      moveCards([best.id], { pile: 'found', i: best.f });
      busy = true;
      await sleep(reduce() ? 10 : 85);
    }
    busy = false;
    render();
  }

  /* ---------------------------------------------------------
     Depois de cada jogada: pagamento, vitória, tela
  --------------------------------------------------------- */
  function after(fromUndo = false) {
    newArmed = 0;
    clearHint();
    if (vegas()) {
      const n = foundCount();
      if (n > G.paidCards) {
        wallet.add((n - G.paidCards) * G.stake * VEGAS_PAY);
        G.paidCards = n;
      }
    }
    if (foundCount() === 52 && !G.won) win();
    else if (!fromUndo && vegas() && !G.over && !findHint()) { G.over = true; loseStreak(); }
    save();
    render();
  }

  function win() {
    G.won = true;
    const bonus = !vegas() && G.secs >= 30 ? Math.round(700000 / G.secs) : 0;
    G.score += bonus;
    stats.won++;
    stats.streak++;
    if (stats.played < stats.won) stats.played = stats.won;   // partida restaurada de um save antigo
    const net = G.paidCards * G.stake * VEGAS_PAY - buyIn();
    // recordes batidos nesta partida
    const beaten = [];
    if (!stats.best || G.secs < stats.best) { stats.best = G.secs; beaten.push('tempo'); }
    if (!stats.bestMoves || G.moves < stats.bestMoves) { stats.bestMoves = G.moves; beaten.push('jogadas'); }
    if (!vegas() && G.score > stats.bestScore) { stats.bestScore = G.score; beaten.push('pontos'); }
    if (vegas() && net > stats.bestVegas) { stats.bestVegas = net; beaten.push('ganho no Vegas'); }
    if (stats.streak > stats.bestStreak) { stats.bestStreak = stats.streak; if (stats.streak > 1) beaten.push('sequência'); }
    saveStats();
    const detail = `Tempo ${clock(G.secs)} · ${G.moves} jogadas`;
    G.banner = {
      kicker: beaten.length ? `Novo recorde: ${beaten.join(', ')}!` : detail,
      title: beaten.length ? 'Recorde!' : 'Paciência completa!',
      amount: vegas() ? '+' + fmt(net) : `${G.score.toLocaleString('pt-BR')} pontos`,
    };
    if (beaten.length) setTimeout(() => toast(`${detail} · recorde de ${beaten.join(', ')} salvo.`), 600);
    setTimeout(cascade, 350);
  }
  // partida perdida (abandonada ou sem jogadas no Vegas): zera a sequência
  function loseStreak() {
    if (!stats.streak) return;
    stats.streak = 0;
    saveStats();
  }
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');

  function renderRecords() {
    const tiles = [
      ['Vitórias', stats.played ? `${stats.won} de ${stats.played}` : '–', stats.played ? pct(stats.won, stats.played) : 'nenhuma partida'],
      ['Melhor tempo', stats.best ? clock(stats.best) : '–', 'partida completa'],
      ['Menos jogadas', stats.bestMoves || '–', 'partida completa'],
      ['Melhor pontuação', stats.bestScore ? stats.bestScore.toLocaleString('pt-BR') : '–', 'modo Clássico'],
      ['Maior ganho', stats.bestVegas ? '+' + fmt(stats.bestVegas) : '–', 'modo Vegas'],
      ['Sequência', stats.streak, `melhor: ${stats.bestStreak}`],
    ];
    el.records.innerHTML = tiles.map(([k, v, s]) => `<div class="pc-rec"><span>${k}</span><b>${v}</b><small>${s}</small></div>`).join('');
  }

  /* ---------------------------------------------------------
     Mesa: medidas e posições das cartas
  --------------------------------------------------------- */
  function measure() {
    const W = el.board.clientWidth;
    const gap = Math.max(5, Math.min(16, W * 0.018));
    const cw = Math.min(112, (W - gap * 6) / 7);
    Object.assign(geo, {
      W, gap, cw, ch: cw * 1.4,
      ox: (W - (cw * 7 + gap * 6)) / 2,
      down: cw * 0.13,
      upOff: cw * 0.3,
      fan: cw * 0.24,
    });
    geo.tabY = geo.ch + gap * 1.8;
    // altura fixa da área das colunas: cabe a maior coluna possível (6 viradas + 13 abertas)
    // ou o que couber na tela; colunas maiores que isso ficam mais apertadas
    geo.avail = Math.min(cw * 5.8, Math.max(geo.ch * 3.2, window.innerHeight * 0.66));
    el.board.style.setProperty('--cw', `${cw}px`);
  }
  const colX = i => geo.ox + i * (geo.cw + geo.gap);

  function positions() {
    const pos = {};
    const { cw, down, fan, tabY } = geo;
    G.stock.forEach((id, k) => { const d = Math.floor(k / 8); pos[id] = { x: colX(0) - d * 1.2, y: -d * 1.2, z: 1 + k, buried: k < G.stock.length - 2 }; });
    const fanFrom = G.draw === 3 ? Math.max(0, G.waste.length - 3) : G.waste.length;
    G.waste.forEach((id, k) => { pos[id] = { x: colX(1) + Math.max(0, k - fanFrom) * fan, y: 0, z: 100 + k, buried: k < G.waste.length - 3 }; });
    G.found.forEach((f, i) => f.forEach((id, k) => { pos[id] = { x: colX(3 + i), y: 0, z: 200 + k, buried: k < f.length - 2 }; }));
    G.tab.forEach((col, c) => {
      const downs = col.filter(id => !G.up[id]).length, ups = col.length - downs;
      let up = geo.upOff;
      const need = downs * down + Math.max(0, ups - 1) * up + geo.ch;
      if (need > geo.avail && ups > 1) up = Math.max(cw * 0.17, (geo.avail - geo.ch - downs * down) / (ups - 1));
      let y = tabY;
      col.forEach((id, k) => {
        pos[id] = { x: colX(c), y, z: 300 + k };
        y += G.up[id] ? up : down;
      });
    });
    geo.height = tabY + geo.avail + geo.gap;   // a mesa não cresce conforme as cartas descem
    return pos;
  }

  /* ---------------------------------------------------------
     Tela
  --------------------------------------------------------- */
  function buildBoard() {
    el.board.innerHTML = '';
    const slot = (cls, label = '') => {
      const n = document.createElement('div');
      n.className = `pc-slot ${cls}`;
      n.innerHTML = label;
      el.board.appendChild(n);
      return n;
    };
    el.slots = {
      stock: slot('stock', '<svg aria-hidden="true"><use href="#i-refresh"/></svg>'),
      found: [0, 1, 2, 3].map(() => slot('found', '<b>A</b>')),
      tab: Array.from({ length: 7 }, () => slot('tab', '<b>K</b>')),
    };
    el.cards = Array.from({ length: 52 }, (_, id) => {
      const n = document.createElement('div');
      n.dataset.id = id;
      n.setAttribute('aria-label', nameOf(id));
      el.board.appendChild(n);
      return n;
    });
  }

  // carta no estilo clássico da paciência: índice nos quatro cantos e naipes
  // mais perto das bordas, para dar para ler na faixa que aparece na coluna
  function faceHtml(id) {
    const html = cardHtml({ r: rankOf(id) === 1 ? 14 : rankOf(id), s: suitOf(id) });
    const corner = (html.match(/<i class="c-tl">(.*?)<\/i>/) || [])[1] || '';
    return html
      .replace(/top:([\d.]+)%/g, (_, t) => `top:${(12 + (Number(t) - 22) * (76 / 56)).toFixed(2)}%`)
      .replace(/left:(38|62)%/g, (_, x) => `left:${x === '38' ? 32 : 68}%`)   // colunas de naipes mais abertas
      + `<i class="c-tr">${corner}</i><i class="c-bl">${corner}</i>`;
  }

  function paintCard(id) {
    const n = el.cards[id], up = !!G.up[id];
    if (n._up === up) return;
    const was = n._up;
    n._up = up;
    n.className = `card pc-card ${up ? (isRed(id) ? 'red' : 'black') : 'back'}`;
    n.innerHTML = up ? faceHtml(id) : BACK_HTML;
    if (up && was === false && !reduce()) { void n.offsetWidth; n.classList.add('flip'); }
  }

  function render() {
    measure();
    const pos = positions();
    el.board.style.height = `${geo.height}px`;
    for (let id = 0; id < 52; id++) {
      paintCard(id);
      const n = el.cards[id], p = pos[id];
      if (drag && drag.ids.includes(id)) continue;
      n.style.left = `${p.x}px`;
      n.style.top = `${p.y}px`;
      n.style.zIndex = p.z;
      n.classList.toggle('buried', !!p.buried);
    }
    // lugares vazios
    const place = (n, x, y) => { n.style.left = `${x}px`; n.style.top = `${y}px`; };
    place(el.slots.stock, colX(0), 0);
    el.slots.stock.classList.toggle('dead', !G.stock.length && !canRecycle());
    el.slots.found.forEach((n, i) => place(n, colX(3 + i), 0));
    el.slots.tab.forEach((n, c) => place(n, colX(c), geo.tabY));

    // barra e botões
    el.time.textContent = clock(G.secs);
    el.moves.textContent = G.moves;
    if (vegas()) {
      const net = G.started ? G.paidCards * G.stake * VEGAS_PAY - buyIn() : 0;
      el.scoreLabel.textContent = 'Ganho';
      el.score.textContent = (net > 0 ? '+' : net < 0 ? '−' : '') + fmt(Math.abs(net));
      el.score.style.color = net > 0 ? 'var(--teal)' : net < 0 ? '#ff8fab' : '';
    } else {
      el.scoreLabel.textContent = 'Pontos';
      el.score.textContent = G.score.toLocaleString('pt-BR');
      el.score.style.color = '';
    }
    el.btnUndo.disabled = busy || G.won || vegas() || !G.history.length;
    el.btnUndo.title = vegas() ? 'No modo Vegas não dá para desfazer' : '';
    el.btnHint.disabled = busy || G.won;
    el.btnFinish.hidden = !canFinish() || busy;
    showBanner(el.banner, G.won ? G.banner : null, false);
    renderRecords();
    renderOptions();
    note(G.won ? '' : G.over ? `Fim das jogadas. Você recebeu ${fmt(G.paidCards * G.stake * VEGAS_PAY)} de ${fmt(buyIn())}. Comece um novo jogo.` : defaultNote());
  }

  function defaultNote() {
    if (vegas()) {
      const passes = VEGAS_RECYCLES[G.draw] + 1;
      return `Vegas · partida ${fmt(buyIn())} · cada carta nas pilhas paga ${fmt(G.stake * VEGAS_PAY)} · ${passes === 1 ? 'uma passada' : `${passes} passadas`} no monte`;
    }
    return '';
  }
  function note(text) { el.note.textContent = text; }

  function renderOptions() {
    const seg = (box, val) => box.querySelectorAll('button').forEach(b => {
      const on = b.dataset.v === String(val);
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    seg(el.optMode, prefs.mode);
    seg(el.optDraw, prefs.draw);
    seg(el.optStake, prefs.stake);
    el.optStake.hidden = prefs.mode !== 'vegas';
  }

  const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /* ---------------------------------------------------------
     Arrastar e tocar
  --------------------------------------------------------- */
  function onDown(e) {
    if (busy || G.won || e.button > 0) return;
    const node = e.target.closest('.pc-card');
    if (!node) {
      if (e.target.closest('.pc-slot.stock')) drawStock();
      return;
    }
    const id = Number(node.dataset.id);
    const loc = where(id);
    if (loc.pile === 'stock') { e.preventDefault(); drawStock(); return; }
    const m = movable(id);
    if (!m) return;
    e.preventDefault();
    const box = el.board.getBoundingClientRect();
    drag = {
      ids: m.ids, id, pointer: e.pointerId, moved: false,
      sx: e.clientX, sy: e.clientY, box,
      from: m.ids.map(i => ({ x: parseFloat(el.cards[i].style.left), y: parseFloat(el.cards[i].style.top) })),
    };
    try { el.board.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro já solto */ }
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      clearHint();
      drag.ids.forEach((id, k) => { el.cards[id].classList.add('dragging'); el.cards[id].style.zIndex = 2000 + k; });
    }
    drag.ids.forEach((id, k) => {
      el.cards[id].style.left = `${drag.from[k].x + dx}px`;
      el.cards[id].style.top = `${drag.from[k].y + dy}px`;
    });
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const d = drag;
    drag = null;
    d.ids.forEach(id => el.cards[id].classList.remove('dragging'));
    if (!d.moved) {
      if (!autoMove(d.id)) nope(d.ids);
      return;
    }
    // onde a carta de cima do bloco caiu: escolhe o lugar com mais área em comum
    const x = parseFloat(el.cards[d.ids[0]].style.left), y = parseFloat(el.cards[d.ids[0]].style.top);
    const overlap = (ax, ay, aw, ah) => Math.max(0, Math.min(x + geo.cw, ax + aw) - Math.max(x, ax)) * Math.max(0, Math.min(y + geo.ch, ay + ah) - Math.max(y, ay));
    const spots = [];
    for (let f = 0; f < 4; f++) spots.push({ dest: { pile: 'found', i: f }, a: overlap(colX(3 + f), 0, geo.cw, geo.ch) });
    for (let c = 0; c < 7; c++) {
      const col = G.tab[c];
      const last = col.length ? parseFloat(el.cards[top(col)].style.top) : geo.tabY;
      spots.push({ dest: { pile: 'tab', i: c }, a: overlap(colX(c), geo.tabY, geo.cw, last - geo.tabY + geo.ch) });
    }
    spots.sort((a, b) => b.a - a.a);
    const hit = spots.find(s => s.a > 0 && legal(d.ids, s.dest));
    if (!hit || !moveCards(d.ids, hit.dest)) render();
  }
  function nope(ids) {
    ids.forEach(id => {
      const n = el.cards[id];
      n.classList.remove('pc-nope');
      void n.offsetWidth;
      n.classList.add('pc-nope');
    });
  }

  /* ---------------------------------------------------------
     Distribuir (com animação saindo do monte)
  --------------------------------------------------------- */
  function dealAnimated() {
    measure();
    if (reduce()) return render();
    el.board.classList.add('instant');
    for (let id = 0; id < 52; id++) {
      paintCard(id);
      el.cards[id].style.left = `${colX(0)}px`;
      el.cards[id].style.top = '0px';
    }
    void el.board.offsetWidth;
    el.board.classList.remove('instant');
    // ordem da distribuição: linha por linha, da esquerda para a direita
    let k = 0;
    for (let row = 0; row < 7; row++) {
      for (let c = row; c < 7; c++) el.cards[G.tab[c][row]].style.transitionDelay = `${k++ * 28}ms`;
    }
    render();
    setTimeout(() => el.cards.forEach(n => { n.style.transitionDelay = ''; }), k * 28 + 400);
  }

  function startNew() {
    if (busy) return;
    if (G.started && !G.won && !G.over && Date.now() - newArmed > 3000) {
      newArmed = Date.now();
      return toast(vegas() ? 'Clique de novo em Novo jogo para abandonar (a entrada desta partida não volta).' : 'Clique de novo em Novo jogo para abandonar esta partida.');
    }
    newArmed = 0;
    if (G.started && !G.won && !G.over) loseStreak();
    stopCascade();
    G = newGame();
    save();
    el.cards.forEach(n => { n._up = undefined; });
    dealAnimated();
  }

  function setPref(key, val) {
    if (prefs[key] === val) return;
    prefs[key] = val;
    savePrefs();
    // partida ainda não começou: a mudança vale já
    if (!G.started && !G.won) {
      G.mode = prefs.mode; G.draw = prefs.draw; G.stake = prefs.stake;
      save();
    } else {
      toast('Vale a partir do próximo jogo.');
    }
    render();
  }

  /* ---------------------------------------------------------
     Vitória: a cascata de cartas (homenagem à Paciência do Windows)
  --------------------------------------------------------- */
  let cascadeRun = null;
  function cardSprite(id, w, h, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const r = w * 0.09;
    g.fillStyle = '#fff';
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 1;
    g.beginPath(); g.roundRect(0.5, 0.5, w - 1, h - 1, r); g.fill(); g.stroke();
    g.fillStyle = isRed(id) ? '#e5383f' : '#161616';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${w * 0.26}px 'Times New Roman', serif`;
    g.fillText(RANK_TXT[rankOf(id)], w * 0.16, h * 0.12);
    g.font = `${w * 0.18}px serif`;
    g.fillText(SUIT_CHARS[suitOf(id)], w * 0.16, h * 0.27);
    g.font = `${w * 0.52}px serif`;
    g.fillText(SUIT_CHARS[suitOf(id)], w * 0.5, h * 0.56);
    return c;
  }
  function cascade() {
    if (reduce() || !G.won) return;
    const cv = el.cascade, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.hidden = false;
    cv.classList.remove('fade');
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = geo.cw, h = geo.ch;
    const box = el.board.getBoundingClientRect();
    const queue = [];
    for (let r = 13; r >= 1; r--) for (let f = 0; f < 4; f++) {
      const id = G.found[f][r - 1];
      if (id !== undefined) queue.push({ id, x: box.left + colX(3 + f), y: box.top });
    }
    const live = [];
    let next = 0, last = performance.now(), launchAt = 0;
    const run = { stop: false };
    cascadeRun = run;
    const frame = now => {
      if (run.stop) return;
      const steps = Math.min(4, Math.max(1, Math.round((now - last) / 16.7)));
      last = now;
      if (next < queue.length && now >= launchAt) {
        const q = queue[next++];
        let vx = (Math.random() * 6 + 2.5) * (Math.random() < 0.5 ? -1 : 1);
        live.push({ ...q, vx, vy: -Math.random() * 7, img: cardSprite(q.id, w, h, dpr) });
        launchAt = now + 140;
      }
      for (let s = 0; s < steps; s++) {
        for (const c of live) {
          c.x += c.vx; c.y += c.vy; c.vy += 0.55;
          if (c.y + h > H) { c.y = H - h; c.vy = -c.vy * 0.78; }
          g.drawImage(c.img, c.x, c.y, w, h);
        }
      }
      for (let i = live.length - 1; i >= 0; i--) if (live[i].x < -w || live[i].x > W) live.splice(i, 1);
      if (next >= queue.length && !live.length) return stopCascade(true);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  function stopCascade(fade) {
    if (cascadeRun) cascadeRun.stop = true;
    cascadeRun = null;
    if (el.cascade.hidden) return;
    if (fade) {
      el.cascade.classList.add('fade');
      setTimeout(() => { el.cascade.hidden = true; }, 700);
    } else el.cascade.hidden = true;
  }

  /* ---------------------------------------------------------
     Início
  --------------------------------------------------------- */
  function init() {
    Object.assign(el, {
      board: $('#board'), note: $('#note'), banner: $('#banner'), cascade: $('#cascade'), records: $('#records'),
      time: $('#info-time'), moves: $('#info-moves'), score: $('#info-score'), scoreLabel: $('#info-score-label'),
      optMode: $('#opt-mode'), optDraw: $('#opt-draw'), optStake: $('#opt-stake'),
      btnUndo: $('#btn-undo'), btnHint: $('#btn-hint'), btnNew: $('#btn-new'), btnFinish: $('#btn-finish'),
    });
    el.optStake.innerHTML = STAKES.map(v => `<button type="button" data-v="${v}" role="radio">${fmt(v)}<small>/carta</small></button>`).join('');

    buildBoard();
    if (!STAKES.includes(prefs.stake)) prefs.stake = 1;
    if (prefs.draw !== 3) prefs.draw = 1;
    if (prefs.mode !== 'vegas') prefs.mode = 'classic';
    const saved = load();
    G = saved || newGame();
    if (saved) render(); else { save(); dealAnimated(); }

    el.optMode.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setPref('mode', b.dataset.v); });
    el.optDraw.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setPref('draw', Number(b.dataset.v)); });
    el.optStake.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setPref('stake', Number(b.dataset.v)); });
    el.btnUndo.addEventListener('click', undo);
    el.btnHint.addEventListener('click', hint);
    el.btnNew.addEventListener('click', startNew);
    el.btnFinish.addEventListener('click', finishAll);
    el.board.addEventListener('pointerdown', onDown);
    el.board.addEventListener('pointermove', onMove);
    el.board.addEventListener('pointerup', onUp);
    el.board.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pointer) { drag.ids.forEach(id => el.cards[id].classList.remove('dragging')); drag = null; render(); } });
    el.cascade.addEventListener('click', () => stopCascade(true));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') stopCascade(true);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const onControl = e.target.closest && e.target.closest('button, input');
      if (e.key === ' ' && !onControl) { e.preventDefault(); drawStock(); }
    });
    let resizeT = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(render, 80); });

    // relógio: só corre com a partida em andamento e a aba à vista
    setInterval(() => {
      if (!G.started || G.won || G.over || document.hidden) return;
      G.secs++;
      el.time.textContent = clock(G.secs);
      if (G.secs % 5 === 0) save();
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
