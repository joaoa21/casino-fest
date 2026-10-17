/* ==========================================================
   Casino Fest · Rei da Fortuna — matemática
   Grade 3×3 com 5 linhas fixas (3 linhas e 2 diagonais).
   O Rei é o coringa: substitui todos e paga o maior prêmio.
   Bônus da Fortuna: aparece de surpresa; os rolos giram só
   com um símbolo + o Rei, o que cai fica preso e gira de novo
   até sair prêmio. Tela cheia multiplica o prêmio por 10.
   Separada da tela para ser simulada no Node.
   ========================================================== */
(function (root) {
  'use strict';

  const ROWS = 3, COLS = 3;
  const LINES = [
    [[1, 0], [1, 1], [1, 2]],     // meio
    [[0, 0], [0, 1], [0, 2]],     // cima
    [[2, 0], [2, 1], [2, 2]],     // baixo
    [[0, 0], [1, 1], [2, 2]],     // diagonal descendo
    [[2, 0], [1, 1], [0, 2]],     // diagonal subindo
  ];
  const BET_LINES = LINES.length; // cada linha vale 1/5 da aposta
  const FULL_MULT = 10;
  const MAX_WIN = 2500;           // em vezes a aposta (tela cheia de Reis no bônus)

  // quanto paga 3 iguais numa linha, em vezes a aposta da linha
  const PAYS = { wild: 250, bars: 100, bag: 25, ring: 10, coin: 8, cash: 5, chip: 3 };
  const SYMBOLS = Object.keys(PAYS);

  // chance de cada símbolo numa casa (peso relativo)
  const WEIGHTS = { wild: 5, bars: 5, bag: 6, ring: 9, coin: 12, cash: 17, chip: 21 };
  // bônus da Fortuna: chance por giro, símbolo sorteado e chance de cada casa no giro do bônus
  const FEATURE_CHANCE = 1 / 45;
  const FEATURE_SYMBOLS = { bars: 5, bag: 9, ring: 13, coin: 16, cash: 22, chip: 25 };
  const FEAT_HIT = 0.42, FEAT_WILD = 0.1;

  function picker(table) {
    const entries = Object.entries(table);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    return rand => {
      let x = rand() * total;
      for (const [k, w] of entries) { if ((x -= w) < 0) return k; }
      return entries[entries.length - 1][0];
    };
  }
  const pickSym = picker(WEIGHTS);
  const pickFeature = picker(FEATURE_SYMBOLS);

  // linha premiada? devolve o símbolo que paga (ou null)
  function lineSymbol(grid, line) {
    let sym = null;
    for (const [r, c] of line) {
      const s = grid[r][c];
      if (!s) return null;
      if (s === 'wild') continue;
      if (sym && sym !== s) return null;
      sym = s;
    }
    return sym || 'wild';
  }
  function findWins(grid) {
    const wins = [];
    LINES.forEach((line, i) => {
      const s = lineSymbol(grid, line);
      if (s) wins.push({ line: i, sym: s, pay: PAYS[s] });
    });
    return wins;
  }

  /**
   * Um giro completo. Devolve:
   *  - base: { feature:false, grid, wins, total }
   *  - bônus: { feature:true, sym, steps:[{grid, locked}], wins, full, total }
   * total em vezes a aposta total.
   */
  function playSpin(rand) {
    if (rand() < FEATURE_CHANCE) return playFeature(rand);
    const grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => pickSym(rand)));
    const wins = findWins(grid);
    const lineSum = wins.reduce((s, w) => s + w.pay, 0);
    return { feature: false, grid, wins, total: Math.min(MAX_WIN, lineSum / BET_LINES) };
  }

  function playFeature(rand, forcedSym) {
    const sym = forcedSym || pickFeature(rand);
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const steps = [];
    let wins = [];
    for (let guard = 0; guard < 200; guard++) {
      const fresh = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c]) continue;
          const x = rand();
          const s = x < FEAT_HIT ? sym : x < FEAT_HIT + FEAT_WILD ? 'wild' : null;
          if (s) { grid[r][c] = s; fresh.push([r, c]); }
        }
      }
      steps.push({ grid: grid.map(row => row.slice()), fresh });
      wins = findWins(grid);
      if (wins.length) break;
    }
    const full = grid.every(row => row.every(Boolean));
    const lineSum = wins.reduce((s, w) => s + w.pay, 0);
    const total = Math.min(MAX_WIN, (lineSum / BET_LINES) * (full ? FULL_MULT : 1));
    return { feature: true, sym, steps, grid, wins, full, total };
  }

  const api = { ROWS, COLS, LINES, BET_LINES, FULL_MULT, MAX_WIN, PAYS, SYMBOLS, WEIGHTS, FEATURE_CHANCE, FEATURE_SYMBOLS, FEAT_HIT, FEAT_WILD, findWins, playSpin, playFeature };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FortunaMath = api;
})(typeof window !== 'undefined' ? window : globalThis);
