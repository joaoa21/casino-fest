/* ==========================================================
   Casino Fest · Blackjack — você contra a crupiê
   Regras: 6 baralhos, dealer para em todos os 17, blackjack paga 3:2,
   seguro paga 2:1, dobra com 2 cartas, divide até 4 mãos
   (Ases divididos recebem só uma carta).
   As fichas são as da carteira única do cassino (casino.js).
   ========================================================== */
(() => {
  'use strict';

  const {
    fmt, $, toast, confetti, wallet, logoSvg, rl, cardText, newDeck, shuffle,
    cardHtml, BACK_HTML, RED, chipSvg, chipStack, chipColumns, showBanner,
  } = window.Casino;

  /* ---------------------------------------------------------
     Constantes
  --------------------------------------------------------- */
  const DECKS = 6;
  const SHOE_SIZE = DECKS * 52;
  const RESHUFFLE_BELOW = Math.round(SHOE_SIZE * 0.25);   // cartão de corte
  const MIN_BET = 5;
  const MAX_BET = 1000;
  const CHIPS = [5, 10, 25, 50, 100, 500];
  const MAX_HANDS = 4;
  const DEAL_GAP = 300;                                    // ms entre uma carta e outra
  const SAVE_KEY = 'casinofest:blackjack:v1';
  const RESULT_TEXT = { bj: 'Blackjack!', win: 'Ganhou', push: 'Empate', lose: 'Perdeu', bust: 'Estourou' };

  let B = null;             // estado da mesa
  const el = {};
  let busyUntil = 0;        // trava as ações enquanto as cartas chegam
  let pendingPay = 0;       // prêmio a creditar depois da animação
  let celebrate = '';
  let bannerTimer = 0, controlsTimer = 0;

  const isBusy = () => performance.now() < busyUntil;

  /* ---------------------------------------------------------
     Valor das mãos
  --------------------------------------------------------- */
  const cardValue = c => (c.r === 14 ? 11 : c.r >= 10 ? 10 : c.r);
  function score(cards) {
    let total = 0, aces = 0;
    for (const c of cards) { total += cardValue(c); if (c.r === 14) aces++; }
    while (total > 21 && aces) { total -= 10; aces--; }
    return { total, soft: aces > 0 };
  }
  // "7/17" enquanto o Ás ainda pode valer 11
  function totalLabel(cards) {
    const { total, soft } = score(cards);
    return soft && total < 21 ? `${total - 10}/${total}` : String(total);
  }
  const isNatural = h => h.cards.length === 2 && !h.fromSplit && score(h.cards).total === 21;
  const newHand = (cards, bet) => ({ cards, bet, done: false, result: null, doubled: false, fromSplit: false, splitAces: false });
  const hand = () => B.hands[B.active];

  /* ---------------------------------------------------------
     Estado, histórico e salvamento
  --------------------------------------------------------- */
  function freshState() {
    return {
      v: 1, phase: 'bet', bet: 0, lastBet: 0,
      shoe: shuffle(newDeck(DECKS)), discard: 0,
      hands: [], active: 0, dealer: { cards: [], hidden: true, revealSeq: 0 },
      insurance: 0, round: 0, net: 0, seq: 0,
      banner: null, bannerLose: false, logs: [],
    };
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(B)); } catch (e) { /* sem armazenamento */ }
  }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s || s.v !== 1 || !Array.isArray(s.shoe) || !Array.isArray(s.hands) || !s.dealer) return null;
      if (!['bet', 'insurance', 'play', 'done'].includes(s.phase)) return null;
      return s;
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

  /* ---------------------------------------------------------
     Sapato
  --------------------------------------------------------- */
  function draw() {
    if (!B.shoe.length) reshuffle();
    const c = B.shoe.pop();
    c.seq = ++B.seq;          // ordem em que a carta saiu (define a animação)
    return c;
  }
  function reshuffle() {
    B.shoe = shuffle(newDeck(DECKS));
    B.discard = 0;
    log('Cartas embaralhadas: 6 baralhos novos na mesa.', 'sep');
    toast('Embaralhando as cartas…');
  }
  function clearTable() {
    B.discard += B.hands.reduce((s, h) => s + h.cards.length, 0) + B.dealer.cards.length;
    B.hands = [];
    B.active = 0;
    B.dealer = { cards: [], hidden: true, revealSeq: 0 };
    B.insurance = 0;
    B.banner = null;
  }

  /* ---------------------------------------------------------
     Apostas
  --------------------------------------------------------- */
  const betCap = () => Math.min(MAX_BET, wallet.balance);

  function placeChip(v) {
    if (B.phase !== 'bet') return;
    if (B.bet + v > MAX_BET) return toast(`A aposta máxima desta mesa é ${fmt(MAX_BET)}.`);
    if (B.bet + v > wallet.balance) return toast('Fichas insuficientes para essa ficha.');
    B.bet += v;
    commit();
  }
  function setBet(v) {
    if (B.phase !== 'bet') return;
    B.bet = Math.max(0, Math.min(betCap(), Math.floor(v)));
    commit();
  }

  /* ---------------------------------------------------------
     Rodada
  --------------------------------------------------------- */
  function deal(amount = B.bet) {
    if (!['bet', 'done'].includes(B.phase) || isBusy()) return;
    if (amount < MIN_BET) return toast(`Aposta mínima: ${fmt(MIN_BET)}. Toque nas fichas para apostar.`);
    if (amount > MAX_BET) return toast(`A aposta máxima desta mesa é ${fmt(MAX_BET)}.`);
    if (amount > wallet.balance) return toast('Você não tem fichas suficientes para essa aposta.');

    clearTable();
    if (B.shoe.length < RESHUFFLE_BELOW) reshuffle();
    B.bet = amount;
    B.lastBet = amount;
    B.round++;
    wallet.add(-amount);

    // ordem real: jogador, dealer, jogador, dealer (fechada)
    const p1 = draw(), d1 = draw(), p2 = draw(), d2 = draw();
    B.hands = [newHand([p1, p2], amount)];
    B.dealer = { cards: [d1, d2], hidden: true, revealSeq: 0 };
    log(`── Rodada ${B.round} · aposta ${fmt(amount)} ──`, 'sep');
    log(`Você recebeu ${cardText(p1)} ${cardText(p2)} (${totalLabel([p1, p2])}). Dealer mostra ${cardText(d1)}.`, 'me');

    const cost = Math.floor(amount / 2);
    if (d1.r === 14 && cost > 0 && wallet.balance >= cost) B.phase = 'insurance';
    else resolveNaturals();
    commit();
  }

  function insure(take) {
    if (B.phase !== 'insurance' || isBusy()) return;
    if (take) {
      const cost = Math.floor(B.hands[0].bet / 2);
      wallet.add(-cost);
      B.insurance = cost;
      log(`Você fez seguro de ${fmt(cost)}.`, 'me');
    } else {
      log('Você recusou o seguro.', 'me');
    }
    resolveNaturals();
    commit();
  }

  // a crupiê confere blackjack quando mostra Ás ou carta de valor 10
  function resolveNaturals() {
    const up = B.dealer.cards[0];
    const peek = up.r === 14 || cardValue(up) === 10;
    const dealerBJ = score(B.dealer.cards).total === 21;
    if (peek && dealerBJ) {
      log('A crupiê conferiu a carta fechada: blackjack!');
      return finishRound();
    }
    if (peek) log('A crupiê conferiu: não é blackjack.');
    if (isNatural(B.hands[0])) return finishRound();
    B.phase = 'play';
    B.active = 0;
  }

  const canDouble = (h = hand()) => !!h && h.cards.length === 2 && !h.splitAces && wallet.balance >= h.bet;
  const canSplit = (h = hand()) => !!h && h.cards.length === 2 && !h.splitAces &&
    cardValue(h.cards[0]) === cardValue(h.cards[1]) && B.hands.length < MAX_HANDS && wallet.balance >= h.bet;

  function act(type) {
    if (B.phase !== 'play' || isBusy()) return;
    const h = hand();
    if (type === 'hit') {
      const c = draw();
      h.cards.push(c);
      const t = score(h.cards).total;
      log(`Você pediu ${cardText(c)} (${totalLabel(h.cards)}).`, 'me');
      if (t > 21) { h.done = true; h.result = 'bust'; log(`Estourou com ${t}.`, 'me'); }
      else if (t === 21) h.done = true;
    } else if (type === 'stand') {
      h.done = true;
      log(`Você parou com ${score(h.cards).total}.`, 'me');
    } else if (type === 'double') {
      if (!canDouble(h)) return;
      wallet.add(-h.bet);
      h.bet *= 2;
      h.doubled = true;
      const c = draw();
      h.cards.push(c);
      h.done = true;
      const t = score(h.cards).total;
      log(`Você dobrou para ${fmt(h.bet)} e recebeu ${cardText(c)} (${t}).`, 'me');
      if (t > 21) h.result = 'bust';
    } else if (type === 'split') {
      if (!canSplit(h)) return;
      wallet.add(-h.bet);
      const moved = h.cards.pop();
      const aces = moved.r === 14;
      const nh = newHand([moved], h.bet);
      nh.fromSplit = h.fromSplit = true;
      nh.splitAces = h.splitAces = aces;
      B.hands.splice(B.active + 1, 0, nh);
      log(`Você dividiu o par de ${rl(moved.r)}.`, 'me');
      dealSecond(h);
    } else return;
    advance();
    commit();
  }

  // mão dividida recebe a segunda carta quando chega a vez dela
  function dealSecond(h) {
    h.cards.push(draw());
    if (h.splitAces || score(h.cards).total === 21) h.done = true;
  }

  function advance() {
    while (B.active < B.hands.length && B.hands[B.active].done) {
      B.active++;
      const next = B.hands[B.active];
      if (next && next.cards.length === 1) dealSecond(next);
    }
    if (B.active >= B.hands.length) dealerTurn();
  }

  function dealerTurn() {
    B.dealer.hidden = false;
    B.dealer.revealSeq = ++B.seq;
    log(`Dealer vira ${cardText(B.dealer.cards[1])}: ${score(B.dealer.cards).total}.`);
    if (B.hands.some(h => h.result !== 'bust')) {
      while (score(B.dealer.cards).total < 17) {
        const c = draw();
        B.dealer.cards.push(c);
        log(`Dealer compra ${cardText(c)}: ${score(B.dealer.cards).total}.`);
      }
    }
    finishRound();
  }

  function finishRound() {
    if (B.dealer.hidden) { B.dealer.hidden = false; B.dealer.revealSeq = ++B.seq; }
    const d = score(B.dealer.cards).total;
    const dealerBJ = B.dealer.cards.length === 2 && d === 21;
    let payout = 0, staked = 0, bjWin = false;

    for (const h of B.hands) {
      staked += h.bet;
      const t = score(h.cards).total;
      const nat = isNatural(h);
      if (t > 21) { h.result = 'bust'; h.payout = 0; }
      else if (nat && !dealerBJ) { h.result = 'bj'; h.payout = h.bet + Math.floor(h.bet * 1.5); bjWin = true; }
      else if (dealerBJ) { h.result = nat ? 'push' : 'lose'; h.payout = nat ? h.bet : 0; }
      else if (d > 21 || t > d) { h.result = 'win'; h.payout = h.bet * 2; }
      else if (t === d) { h.result = 'push'; h.payout = h.bet; }
      else { h.result = 'lose'; h.payout = 0; }
      payout += h.payout;
    }

    let insWin = 0;
    if (B.insurance) {
      if (dealerBJ) { insWin = B.insurance * 3; log(`O seguro pagou ${fmt(B.insurance * 2)}.`, 'win'); }
      else log(`Seguro de ${fmt(B.insurance)} perdido.`);
    }
    const net = payout + insWin - staked - B.insurance;
    B.net += net;
    pendingPay = payout + insWin;
    B.phase = 'done';
    B.banner = makeBanner(net, dealerBJ, bjWin, d);
    B.bannerLose = net < 0;
    celebrate = net > 0 ? (bjWin ? 'big' : 'normal') : '';

    const res = B.hands.length > 1 ? B.hands.map(h => RESULT_TEXT[h.result]).join(' / ') + ' · ' : '';
    const msg = net > 0 ? `Você ganhou ${fmt(net)}.`
      : net < 0 ? `Você perdeu ${fmt(-net)}.`
      : B.insurance && dealerBJ ? 'O seguro cobriu a aposta.' : 'Empate: aposta devolvida.';
    log(res + msg, 'win');
  }

  function makeBanner(net, dealerBJ, bjWin, d) {
    const single = B.hands.length === 1 ? B.hands[0] : null;
    const pt = single ? score(single.cards).total : 0;
    if (net > 0) {
      return {
        kicker: bjWin ? 'Blackjack paga 3 para 2' : d > 21 ? `Dealer estourou com ${d}` : single ? `Você ${pt} × Dealer ${d}` : 'Você venceu a rodada',
        title: bjWin ? 'Blackjack!' : 'Você venceu!',
        amount: '+' + fmt(net),
      };
    }
    if (net === 0) {
      const mixed = B.hands.some(h => h.result === 'win' || h.result === 'bj');
      return { kicker: B.insurance && dealerBJ ? 'O seguro cobriu a aposta' : mixed ? 'Ganhos e perdas empataram' : 'Aposta devolvida', title: 'Empate', amount: '' };
    }
    const amount = '−' + fmt(-net);
    if (dealerBJ) return { kicker: 'A crupiê tem blackjack', title: 'Dealer venceu', amount };
    if (single && single.result === 'bust') return { kicker: `Você estourou com ${pt}`, title: 'Estourou!', amount };
    return { kicker: single ? `Dealer ${d} × Você ${pt}` : 'Resultado da rodada', title: 'Dealer venceu', amount };
  }

  // depois da rodada: limpa a mesa e volta para as apostas
  function newBet() {
    if (B.phase !== 'done' || isBusy()) return;
    clearTable();
    B.phase = 'bet';
    B.bet = B.lastBet <= betCap() ? B.lastBet : 0;
    commit();
  }
  function rebet(mult = 1) {
    if (B.phase !== 'done') return;
    deal(B.lastBet * mult);
  }

  /* ---------------------------------------------------------
     Salva, desenha e credita o prêmio quando as cartas chegam
  --------------------------------------------------------- */
  function commit() {
    save();
    const t = render();
    busyUntil = performance.now() + t;
    if (pendingPay > 0) wallet.add(pendingPay, { delay: t });
    pendingPay = 0;
    if (celebrate) {
      const big = celebrate === 'big';
      setTimeout(() => confetti(big ? 220 : 130, el.table), t);
      celebrate = '';
    }
    clearTimeout(controlsTimer);
    if (t > 0) controlsTimer = setTimeout(renderControls, t);
  }

  /* ---------------------------------------------------------
     Renderização
  --------------------------------------------------------- */
  function makeCardEl(card, faceUp) {
    const n = document.createElement('div');
    n.dataset.seq = card.seq;
    paintCard(n, card, faceUp);
    // terminada a animação, tira a classe para ela nunca rodar de novo
    n.addEventListener('animationend', () => n.classList.remove('bj-in', 'bj-flip'));
    return n;
  }
  function paintCard(n, card, faceUp) {
    n.dataset.face = faceUp ? '1' : '0';
    n.className = 'card ' + (faceUp ? (RED.has(card.s) ? 'red' : 'black') : 'back');
    n.innerHTML = faceUp ? cardHtml(card) : BACK_HTML;
  }

  // sincroniza as cartas de um monte com o estado; devolve os eventos de animação
  function syncCards(box, cards, hiddenIdx) {
    const events = [];
    const existing = new Map([...box.children].map(n => [n.dataset.seq, n]));
    cards.forEach((c, i) => {
      const faceUp = i !== hiddenIdx;
      let n = existing.get(String(c.seq));
      if (!n) {
        n = makeCardEl(c, faceUp);
        events.push({ seq: c.seq, node: n, kind: 'in' });
      } else {
        existing.delete(String(c.seq));
        if (faceUp && n.dataset.face === '0') events.push({ seq: B.dealer.revealSeq || c.seq, node: n, kind: 'flip', card: c });
        else if (!faceUp && n.dataset.face === '1') paintCard(n, c, false);
      }
      // só move se estiver fora do lugar: reinserir uma carta reinicia a animação dela
      if (box.children[i] !== n) box.insertBefore(n, box.children[i] || null);
    });
    existing.forEach(n => n.remove());
    return events;
  }

  function buildHandEl() {
    const d = document.createElement('div');
    d.className = 'hand';
    d.innerHTML = '<div class="bj-hand"><div class="bj-cards"></div><span class="bj-total"></span></div>' +
      '<div class="hand-bet"></div><span class="hand-result" hidden></span>';
    return d;
  }

  function setTotal(node, cards) {
    if (!cards.length) { node.hidden = true; return; }
    const t = score(cards).total;
    node.hidden = false;
    node.textContent = totalLabel(cards);
    node.classList.toggle('is-21', t === 21);
    node.classList.toggle('is-bust', t > 21);
  }

  // instant = sem animação (ao abrir a página). Retorna quanto tempo a animação leva.
  function render(instant = false) {
    // barra da mesa e sapato
    el.round.textContent = B.round;
    el.net.textContent = (B.net > 0 ? '+' : B.net < 0 ? '−' : '') + fmt(Math.abs(B.net));
    el.net.style.color = B.net > 0 ? 'var(--teal)' : B.net < 0 ? '#ff8fab' : '';
    el.shoeInfo.textContent = `${B.shoe.length} cartas`;
    el.shoeFill.style.width = `${(B.shoe.length / SHOE_SIZE) * 100}%`;
    el.shoeCount.textContent = B.shoe.length;
    const pile = Math.min(3, Math.ceil(B.discard / 20));
    if (el.discard.childElementCount !== pile) {
      el.discard.innerHTML = Array.from({ length: pile }, (_, i) =>
        `<i class="card back" style="transform: rotate(${(i - 1) * 7}deg) translate(${i * 2}px, ${-i * 2}px)">${BACK_HTML}</i>`).join('');
    }

    // cartas do dealer e das mãos
    let events = syncCards(el.dealerCards, B.dealer.cards, B.dealer.hidden ? 1 : -1);
    while (el.hands.children.length < B.hands.length) el.hands.appendChild(buildHandEl());
    while (el.hands.children.length > B.hands.length) el.hands.lastChild.remove();
    el.hands.classList.toggle('many', B.hands.length > 2);

    const handEvents = [];
    B.hands.forEach((h, i) => {
      const node = el.hands.children[i];
      const evs = syncCards($('.bj-cards', node), h.cards, -1);
      evs.forEach(e => { e.hand = i; });
      handEvents.push(...evs);
      node.classList.toggle('active', B.phase === 'play' && i === B.active);
      node.classList.toggle('waiting', B.phase === 'play' && i !== B.active);
      const betEl = $('.hand-bet', node);
      if (betEl.dataset.v !== String(h.bet)) {
        betEl.dataset.v = String(h.bet);
        betEl.innerHTML = `${chipStack(h.bet, 4)}<b>${fmt(h.bet)}${h.doubled ? ' · 2x' : ''}</b>`;
      }
    });
    events = events.concat(handEvents).sort((a, b) => a.seq - b.seq);

    // agenda as animações na ordem em que as cartas saíram do sapato
    const shoeRect = el.shoe.getBoundingClientRect();
    events.forEach((ev, k) => {
      const delay = instant ? 0 : k * DEAL_GAP;
      ev.delay = delay;
      if (ev.kind === 'in') {
        if (instant) return;
        const r = ev.node.getBoundingClientRect();
        ev.node.style.setProperty('--fx', `${shoeRect.left - r.left}px`);
        ev.node.style.setProperty('--fy', `${shoeRect.top - r.top}px`);
        ev.node.style.setProperty('--d', `${delay}ms`);
        ev.node.classList.add('bj-in');
      } else {
        const flip = () => {
          if (!ev.node.isConnected) return;
          paintCard(ev.node, ev.card, true);
          if (!instant) { ev.node.style.setProperty('--d', '0ms'); ev.node.classList.add('bj-flip'); }
        };
        if (delay) setTimeout(flip, delay); else flip();
      }
    });
    const animEnd = events.length && !instant ? (events.length - 1) * DEAL_GAP + 420 : 0;

    // totais aparecem quando a última carta de cada monte chega
    const lastDelay = pred => events.filter(pred).reduce((m, e) => Math.max(m, e.delay + 380), 0);
    const showDealer = () => {
      const visible = B.dealer.hidden ? B.dealer.cards.slice(0, 1) : B.dealer.cards;
      setTotal(el.dealerTotal, visible);
    };
    const dDelay = lastDelay(e => e.hand === undefined);
    if (dDelay && !instant) setTimeout(showDealer, dDelay); else showDealer();
    B.hands.forEach((h, i) => {
      const node = el.hands.children[i];
      const upd = () => { if (node.isConnected) setTotal($('.bj-total', node), h.cards); };
      const hd = lastDelay(e => e.hand === i);
      if (hd && !instant) setTimeout(upd, hd); else upd();

      const tag = $('.hand-result', node);
      const key = B.phase === 'done' && h.result ? h.result : '';
      if (tag.dataset.key !== key) {
        tag.dataset.key = key;
        tag.hidden = !key;
        if (key) {
          tag.className = `hand-result r-${key}`;
          tag.textContent = RESULT_TEXT[key];
          tag.style.setProperty('--d', `${animEnd}ms`);
        }
      }
    });

    // círculo de aposta
    const betting = B.phase === 'bet';
    el.betSpot.hidden = !betting;
    if (betting) {
      el.betSpot.classList.toggle('has-bet', B.bet > 0);
      el.betSpot.classList.toggle('pulse', B.bet === 0);
      el.betSpotChips.innerHTML = B.bet ? chipColumns(B.bet, 3, 5) : '';
      el.betSpotLabel.textContent = B.bet ? fmt(B.bet) : 'Aposte aqui';
    }

    // faixa de resultado depois das cartas
    clearTimeout(bannerTimer);
    if (B.phase === 'done' && B.banner && animEnd) {
      showBanner(el.banner, null);
      bannerTimer = setTimeout(() => showBanner(el.banner, B.banner, B.bannerLose), animEnd);
    } else {
      showBanner(el.banner, B.phase === 'done' ? B.banner : null, B.bannerLose);
    }

    renderControls(animEnd > 0);
    return animEnd;
  }

  function renderControls(busy = isBusy()) {
    const ph = B.phase;
    el.betPanel.hidden = ph !== 'bet';
    el.playPanel.hidden = ph !== 'play';
    el.insPanel.hidden = ph !== 'insurance';
    el.donePanel.hidden = ph !== 'done';
    el.controls.classList.toggle('disabled', busy);
    el.controls.classList.toggle('my-turn', !busy && (ph === 'play' || ph === 'insurance'));

    let status = '';
    if (ph === 'bet') {
      el.trayChips.forEach(b => { b.disabled = B.bet + Number(b.dataset.v) > betCap(); });
      el.betClear.disabled = el.betHalf.disabled = !B.bet;
      el.betDouble.disabled = !B.bet || B.bet * 2 > betCap();
      el.btnDeal.disabled = B.bet < MIN_BET;
      el.dealLabel.textContent = B.bet >= MIN_BET ? `Dar cartas · ${fmt(B.bet)}` : 'Dar cartas';
      status = wallet.balance < MIN_BET ? 'Sem fichas: use o + no topo para recarregar'
        : B.bet ? 'Tudo pronto? Dê as cartas' : 'Faça sua aposta';
    } else if (ph === 'insurance') {
      const cost = Math.floor(B.hands[0].bet / 2);
      el.insText.innerHTML = isNatural(B.hands[0])
        ? `Você tem blackjack e a crupiê mostra um Ás. Fazer seguro por <b>${fmt(cost)}</b>?`
        : `A crupiê mostra um Ás. Fazer seguro por <b>${fmt(cost)}</b>? Paga 2 para 1 se ela tiver blackjack.`;
      el.insYesLabel.textContent = `Fazer seguro · ${fmt(cost)}`;
      [el.btnInsYes, el.btnInsNo].forEach(b => { b.disabled = busy; });
      status = 'Seguro?';
    } else if (ph === 'play') {
      const h = hand();
      el.btnHit.disabled = el.btnStand.disabled = busy;
      el.btnDouble.disabled = busy || !canDouble(h);
      el.btnSplit.disabled = busy || !canSplit(h);
      const up = B.dealer.cards[0];
      const which = B.hands.length > 1 ? `Mão ${B.active + 1} de ${B.hands.length} · ` : '';
      status = `${which}Você tem ${totalLabel(h.cards)} contra ${up.r === 14 ? 'Ás' : cardValue(up)} da crupiê`;
    } else if (ph === 'done') {
      const can1 = B.lastBet <= betCap() && B.lastBet >= MIN_BET;
      const can2 = B.lastBet * 2 <= betCap();
      el.btnRebet.disabled = busy || !can1;
      el.btnRebet2.disabled = busy || !can2;
      el.btnChange.disabled = busy;
      el.rebetLabel.textContent = `Repetir · ${fmt(B.lastBet)}`;
      el.rebet2Label.textContent = `Dobrar · ${fmt(B.lastBet * 2)}`;
    }
    el.status.textContent = status;
    el.status.classList.toggle('mine', ph === 'play' && !busy);
  }

  /* ---------------------------------------------------------
     Início, retomada e interação
  --------------------------------------------------------- */
  function buildTray() {
    el.chipTray.innerHTML = CHIPS.map(v =>
      `<button type="button" class="tray-chip c${v}" data-v="${v}" aria-label="Ficha de ${fmt(v)}">${chipSvg(v)}<b>${v}</b></button>`).join('');
    el.trayChips = [...el.chipTray.querySelectorAll('.tray-chip')];
    el.trayChips.forEach(b => b.addEventListener('click', () => placeChip(Number(b.dataset.v))));
  }

  function init() {
    Object.assign(el, {
      table: $('#table'), shoe: $('#shoe'), shoeCount: $('#shoe-count'), discard: $('#discard'),
      dealerCards: $('#dealer-cards'), dealerTotal: $('#dealer-total'), hands: $('#hands'),
      betSpot: $('#bet-spot'), betSpotChips: $('#bet-spot-chips'), betSpotLabel: $('#bet-spot-label'),
      banner: $('#banner'), controls: $('#controls'), status: $('#status'),
      betPanel: $('#bet-panel'), playPanel: $('#play-panel'), insPanel: $('#ins-panel'), donePanel: $('#done-panel'),
      chipTray: $('#chip-tray'), betClear: $('#bet-clear'), betHalf: $('#bet-half'), betDouble: $('#bet-double'),
      btnDeal: $('#btn-deal'), dealLabel: $('#deal-label'),
      btnHit: $('#btn-hit'), btnStand: $('#btn-stand'), btnDouble: $('#btn-double'), btnSplit: $('#btn-split'),
      insText: $('#ins-text'), btnInsYes: $('#btn-ins-yes'), btnInsNo: $('#btn-ins-no'), insYesLabel: $('#ins-yes-label'),
      btnRebet: $('#btn-rebet'), btnRebet2: $('#btn-rebet2'), btnChange: $('#btn-change'),
      rebetLabel: $('#rebet-label'), rebet2Label: $('#rebet2-label'),
      round: $('#info-round'), net: $('#info-net'), shoeInfo: $('#info-shoe'), shoeFill: $('#shoe-fill'),
      log: $('#log'),
    });
    buildTray();
    $('#felt-logo').innerHTML = logoSvg('felt-logo-svg');

    el.betClear.addEventListener('click', () => setBet(0));
    el.betHalf.addEventListener('click', () => setBet(Math.max(MIN_BET, Math.floor(B.bet / 2 / 5) * 5)));
    el.betDouble.addEventListener('click', () => setBet(B.bet * 2));
    el.btnDeal.addEventListener('click', () => deal());
    el.btnHit.addEventListener('click', () => act('hit'));
    el.btnStand.addEventListener('click', () => act('stand'));
    el.btnDouble.addEventListener('click', () => act('double'));
    el.btnSplit.addEventListener('click', () => act('split'));
    el.btnInsYes.addEventListener('click', () => insure(true));
    el.btnInsNo.addEventListener('click', () => insure(false));
    el.btnRebet.addEventListener('click', () => rebet(1));
    el.btnRebet2.addEventListener('click', () => rebet(2));
    el.btnChange.addEventListener('click', newBet);

    document.addEventListener('keydown', e => {
      if (!B || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const onControl = e.target.closest && e.target.closest('button, input');
      if (B.phase === 'bet') {
        if ((k === 'enter' || k === ' ') && !onControl) { e.preventDefault(); deal(); }
      } else if (B.phase === 'play') {
        if (k === 'h') act('hit');
        else if (k === 's') act('stand');
        else if (k === 'd') act('double');
        else if (k === 'p') act('split');
      } else if (B.phase === 'insurance') {
        if (k === 'y' || k === 's') insure(true);
        else if (k === 'n') insure(false);
      } else if (B.phase === 'done') {
        if ((k === 'enter' || k === ' ') && !onControl) { e.preventDefault(); rebet(1); }
        else if (k === '2') rebet(2);
        else if (k === 'n') newBet();
      }
    });

    // recarga só fora de uma rodada; o saldo novo libera as fichas da bandeja
    wallet.setRefillGuard(() => (B && (B.phase === 'play' || B.phase === 'insurance') ? 'Termine a rodada para recarregar as fichas.' : null));
    wallet.onChange(() => { if (B) renderControls(); });

    const saved = loadSave();
    B = saved || freshState();
    if (B.phase === 'bet' && B.bet > betCap()) B.bet = 0;
    B.logs.forEach(([m, c]) => appendLog(m, c));
    if (!saved) log('Mesa aberta! Aposte de $5 a $1.000 e boa sorte.', 'sep');
    else if (B.phase === 'play' || B.phase === 'insurance') toast('Rodada retomada de onde você parou');
    save();
    render(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
