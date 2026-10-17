/* ==========================================================
   Casino Fest · Slots — matemática das máquinas
   - Coroa da Sorte: 5 rolos × 3, 10 linhas, modo bônus (giros grátis)
   - Sete Clássico: 3 rolos × 3, 5 linhas, coringa que dobra o prêmio
   Fica separada da tela para ser testada e simulada no Node.
   ========================================================== */
(function (root) {
  'use strict';

  // fita embaralhada de forma fixa (sempre a mesma ordem para a mesma máquina)
  function buildStrip(counts, seed) {
    const strip = [];
    for (const [s, n] of Object.entries(counts)) for (let i = 0; i < n; i++) strip.push(s);
    let x = seed;
    const rand = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    for (let i = strip.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [strip[i], strip[j]] = [strip[j], strip[i]];
    }
    return strip;
  }

  /* ---------------------------------------------------------
     Máquinas
     pays: quanto paga cada símbolo por quantidade seguida a partir
     da esquerda, em vezes a aposta da linha.
  --------------------------------------------------------- */
  const COROA = {
    id: 'coroa',
    name: 'Coroa da Sorte',
    reels: 5,
    rows: 3,
    bets: [10, 20, 50, 100, 200, 500, 1000],
    lines: [
      [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
      [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1],
    ],
    wild: 'crown',
    scatter: 'star',
    pays: {
      cherry:  { 3: 4, 4: 15, 5: 40 },
      lemon:   { 3: 5, 4: 15, 5: 40 },
      grape:   { 3: 7, 4: 25, 5: 60 },
      bell:    { 3: 12, 4: 30, 5: 80 },
      bar:     { 3: 15, 4: 50, 5: 120 },
      diamond: { 3: 25, 4: 80, 5: 250 },
      seven:   { 3: 40, 4: 150, 5: 500 },
      crown:   { 3: 50, 4: 250, 5: 1000 },
    },
    // estrelas nos rolos 1, 3 e 5 (vale uma por rolo): pagam em vezes a aposta total e abrem o bônus
    scatterPays: { 3: 2 },
    bonus: { trigger: 3, spins: 10, retrigger: 10, mult: 3, buyCost: 63 },
    // fitas do jogo normal
    reelCounts: [
      { cherry: 7, lemon: 7, grape: 6, bell: 5, bar: 4, diamond: 3, seven: 2, crown: 2, star: 2 },
      { cherry: 7, lemon: 7, grape: 6, bell: 5, bar: 4, diamond: 3, seven: 2, crown: 2 },
      { cherry: 7, lemon: 7, grape: 6, bell: 5, bar: 4, diamond: 3, seven: 2, crown: 2, star: 2 },
      { cherry: 7, lemon: 7, grape: 6, bell: 5, bar: 4, diamond: 3, seven: 2, crown: 2 },
      { cherry: 7, lemon: 7, grape: 6, bell: 5, bar: 4, diamond: 3, seven: 2, crown: 2, star: 2 },
    ],
    // fitas do bônus: mais coroas e símbolos valiosos
    bonusCounts: [
      { cherry: 5, lemon: 5, grape: 5, bell: 5, bar: 5, diamond: 4, seven: 3, crown: 4, star: 1 },
      { cherry: 5, lemon: 5, grape: 5, bell: 5, bar: 5, diamond: 4, seven: 3, crown: 4 },
      { cherry: 5, lemon: 5, grape: 5, bell: 5, bar: 5, diamond: 4, seven: 3, crown: 4, star: 1 },
      { cherry: 5, lemon: 5, grape: 5, bell: 5, bar: 5, diamond: 4, seven: 3, crown: 4 },
      { cherry: 5, lemon: 5, grape: 5, bell: 5, bar: 5, diamond: 4, seven: 3, crown: 4, star: 1 },
    ],
  };

  const CLASSICO = {
    id: 'classico',
    name: 'Sete Clássico',
    reels: 3,
    rows: 3,
    bets: [5, 10, 25, 50, 100, 250, 500],
    lines: [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]],
    wild: 'crown',
    wildMult: 2,        // cada coroa usada na linha dobra o prêmio
    scatter: 'wheel',   // roda nos 3 rolos (uma por rolo) abre a Roda da Fortuna
    bonus: {
      type: 'wheel',
      trigger: 3,
      buyCost: 42,
      // multiplicadores da roda, em vezes a aposta (todas as fatias com a mesma chance)
      wheel: [10, 20, 15, 50, 10, 25, 15, 100, 10, 20, 15, 30, 10, 20, 50, 250],
    },
    pays: {
      cherry: { 1: 1, 2: 3, 3: 12 },
      lemon:  { 3: 10 },
      bell:   { 3: 16 },
      bar:    { 3: 30 },
      seven:  { 3: 90 },
      crown:  { 3: 300 },
    },
    // como nas máquinas antigas, boa parte das paradas é espaço vazio
    reelCounts: [
      { blank: 9, cherry: 2, lemon: 6, bell: 5, bar: 4, seven: 2, crown: 1, wheel: 2 },
      { blank: 10, cherry: 3, lemon: 6, bell: 5, bar: 4, seven: 2, crown: 1, wheel: 1 },
      { blank: 9, cherry: 3, lemon: 6, bell: 5, bar: 4, seven: 2, crown: 1, wheel: 2 },
    ],
  };

  // fita em que dois símbolos de bônus nunca aparecem juntos na mesma janela de 3 casas
  function spreadStrip(counts, seed, scatter, rows) {
    for (let k = 0; k < 500; k++) {
      const strip = buildStrip(counts, seed + k * 7);
      const pos = strip.map((s, i) => (s === scatter ? i : -1)).filter(i => i >= 0);
      const ok = pos.every((p, j) => pos.every((q, l) => l === j || Math.min(Math.abs(p - q), strip.length - Math.abs(p - q)) >= rows));
      if (ok) return strip;
    }
    return buildStrip(counts, seed);
  }

  function makeMachine(cfg, seed) {
    const m = { ...cfg };
    m.strips = cfg.reelCounts.map((c, i) => spreadStrip(c, seed * (i + 3), cfg.scatter, cfg.rows));
    if (cfg.bonusCounts) m.bonusStrips = cfg.bonusCounts.map((c, i) => spreadStrip(c, seed * (i + 11), cfg.scatter, cfg.rows));
    m.minCount = Object.fromEntries(Object.entries(cfg.pays).map(([s, p]) => [s, Math.min(...Object.keys(p).map(Number))]));

    m.randomStops = (randInt, bonus = false) => (bonus ? m.bonusStrips : m.strips).map(s => randInt(s.length));
    m.gridFromStops = (stops, bonus = false) => stops.map((stop, r) => {
      const strip = (bonus ? m.bonusStrips : m.strips)[r];
      return Array.from({ length: m.rows }, (_, row) => strip[(stop + row) % strip.length]);
    });

    // uma linha: símbolo, quantos seguidos e o multiplicador da tabela (já com o dobro do coringa)
    m.evalLine = symbols => {
      const n = symbols.length;
      if (symbols[0] === m.scatter) return null;
      let wildRun = 0;
      while (wildRun < n && symbols[wildRun] === m.wild) wildRun++;
      const wildPay = (m.pays[m.wild] || {})[wildRun] || 0;

      const base = symbols.find(s => s !== m.wild);
      let best = null;
      if (base && base !== m.scatter && m.pays[base]) {
        let run = 0;
        while (run < n && (symbols[run] === base || symbols[run] === m.wild)) run++;
        // maior quantidade que tem prêmio na tabela
        for (let k = run; k >= m.minCount[base]; k--) {
          const p = m.pays[base][k];
          if (p) {
            const wilds = symbols.slice(0, k).filter(s => s === m.wild).length;
            best = { symbol: base, count: k, mult: p * (m.wildMult ? m.wildMult ** wilds : 1), wilds };
            break;
          }
        }
      }
      if (!best && !wildPay) return null;
      if (!best || wildPay >= best.mult) return { symbol: m.wild, count: wildRun, mult: wildPay, wilds: wildRun };
      return best;
    };

    // giro completo; bonusMult multiplica os prêmios durante os giros grátis
    m.evaluate = (grid, bet, bonusMult = 1) => {
      const lineBet = bet / m.lines.length;
      const wins = [];
      m.lines.forEach((line, i) => {
        const syms = line.map((row, reel) => grid[reel][row]);
        const r = m.evalLine(syms);
        if (r) wins.push({ line: i, symbol: r.symbol, count: r.count, wilds: r.wilds, amount: r.mult * lineBet * bonusMult, cells: line.slice(0, r.count).map((row, reel) => [reel, row]) });
      });
      let scatter = null, bonusSpins = 0, bonusTrigger = false;
      if (m.scatter) {
        const cells = [];
        grid.forEach((col, reel) => {
          const row = col.indexOf(m.scatter);
          if (row >= 0) cells.push([reel, row]);   // vale uma estrela por rolo
        });
        const pay = (m.scatterPays || {})[cells.length] || 0;
        bonusTrigger = cells.length >= m.bonus.trigger;
        if (bonusTrigger && m.bonus.type !== 'wheel') bonusSpins = bonusMult > 1 ? m.bonus.retrigger : m.bonus.spins;
        if (pay || bonusTrigger) scatter = { count: cells.length, amount: pay * bet * bonusMult, cells };
      }
      const total = wins.reduce((s, w) => s + w.amount, 0) + (scatter ? scatter.amount : 0);
      return { wins, scatter, bonusSpins, bonusTrigger, total };
    };
    return m;
  }

  const MACHINES = {
    coroa: makeMachine(COROA, 7919),
    classico: makeMachine(CLASSICO, 6151),
  };

  const api = { MACHINES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SlotsMath = api;
})(typeof window !== 'undefined' ? window : globalThis);
