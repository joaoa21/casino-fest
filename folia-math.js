/* ==========================================================
   Casino Fest · Rei da Folia — matemática
   Grade 6×5, "paga em qualquer lugar" (8+ iguais), cascatas,
   bolas de multiplicador e giros grátis com multiplicador que
   vai acumulando. Separada da tela para ser simulada no Node.
   ========================================================== */
(function (root) {
  'use strict';

  const COLS = 6, ROWS = 5;
  const MAX_WIN = 5000;                     // prêmio máximo por giro (ou por bônus), em vezes a aposta

  // quanto paga cada símbolo, em vezes a aposta total: [8-9 iguais, 10-11, 12+]
  const PAYS = {
    crown:  [7, 18, 35],
    scepter:   [2, 7, 18],
    sneaker:   [1.5, 3.5, 10],
    cup:    [1, 1.5, 8],
    red:    [0.7, 1, 7],
    purple: [0.55, 0.85, 5.5],
    yellow: [0.35, 0.7, 3.5],
    green:  [0.3, 0.6, 3],
    blue:   [0.2, 0.5, 1.5],
  };
  const SYMBOLS = Object.keys(PAYS);
  const MIN_COUNT = 8;

  // sóis em qualquer lugar: pagam em vezes a aposta e abrem/reabrem o bônus
  const SCATTER_PAYS = { 4: 3, 5: 5, 6: 100 };
  const FREE_SPINS = 15, RETRIGGER = 5, RETRIGGER_MIN = 3, TRIGGER_MIN = 4;
  const BUY_COST = 100;

  // chance de cada símbolo aparecer numa casa (peso relativo)
  const WEIGHTS = {
    base: { blue: 26, green: 23, yellow: 20, purple: 17, red: 14, cup: 10, sneaker: 8, scepter: 6, crown: 4, scatter: 1.95, orb: 0.4 },
    free: { blue: 26, green: 23, yellow: 20, purple: 17, red: 14, cup: 10, sneaker: 8, scepter: 6, crown: 4, scatter: 1.5, orb: 2.55 },
  };
  // valores das bolas de multiplicador (peso relativo)
  const ORBS = [[2, 32], [3, 26], [4, 20], [5, 16], [6, 12], [8, 10], [10, 9], [12, 6], [15, 5], [20, 4], [25, 3], [50, 1.6], [100, 0.7], [250, 0.22], [500, 0.08]];

  function picker(table) {
    const entries = Array.isArray(table) ? table : Object.entries(table);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    return rand => {
      let x = rand() * total;
      for (const [k, w] of entries) { if ((x -= w) < 0) return k; }
      return entries[entries.length - 1][0];
    };
  }
  const pickSym = { base: picker(WEIGHTS.base), free: picker(WEIGHTS.free) };
  const pickOrb = picker(ORBS);

  let nextId = 1;
  function newCell(rand, mode) {
    const s = pickSym[mode](rand);
    const cell = { id: nextId++, s };
    if (s === 'orb') cell.v = Number(pickOrb(rand));
    return cell;
  }

  const payFor = (s, n) => (n >= 12 ? PAYS[s][2] : n >= 10 ? PAYS[s][1] : PAYS[s][0]);

  // grade[coluna][linha], linha 0 em cima
  function freshGrid(rand, mode) {
    return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => newCell(rand, mode)));
  }

  function findWins(grid, bet) {
    const pos = {};
    grid.forEach((col, c) => col.forEach((cell, r) => {
      if (PAYS[cell.s]) (pos[cell.s] = pos[cell.s] || []).push([c, r]);
    }));
    const wins = [];
    for (const [s, cells] of Object.entries(pos)) {
      if (cells.length >= MIN_COUNT) wins.push({ s, count: cells.length, amount: payFor(s, cells.length) * bet, cells });
    }
    return wins;
  }

  // tira os premiados; o que sobra cai e novos símbolos entram por cima
  function tumble(grid, wins, rand, mode) {
    const remove = new Set(wins.flatMap(w => w.cells.map(([c, r]) => `${c},${r}`)));
    return grid.map((col, c) => {
      const keep = col.filter((_, r) => !remove.has(`${c},${r}`));
      const add = Array.from({ length: ROWS - keep.length }, () => newCell(rand, mode));
      return [...add, ...keep];
    });
  }

  const countOf = (grid, s) => grid.reduce((n, col) => n + col.filter(x => x.s === s).length, 0);

  /**
   * Um giro completo, com todas as cascatas.
   * mode: 'base' ou 'free'. accum: multiplicador acumulado do bônus (só no 'free').
   * Devolve os passos para a animação e os valores finais.
   */
  function playSpin(rand, bet, mode = 'base', accum = 0) {
    let grid = freshGrid(rand, mode);
    const steps = [];
    let tumbleWin = 0;
    for (let guard = 0; guard < 60; guard++) {
      const wins = findWins(grid, bet);
      const stepWin = wins.reduce((s, w) => s + w.amount, 0);
      steps.push({ grid, wins, stepWin });
      if (!wins.length) break;
      tumbleWin += stepWin;
      grid = tumble(grid, wins, rand, mode);
    }
    const finalGrid = steps[steps.length - 1].grid;

    // bolas de multiplicador que ficaram na grade
    const orbs = [];
    finalGrid.forEach((col, c) => col.forEach((cell, r) => { if (cell.s === 'orb') orbs.push({ c, r, v: cell.v, id: cell.id }); }));
    const orbSum = orbs.reduce((s, o) => s + o.v, 0);

    let mult = 1, newAccum = accum;
    if (tumbleWin > 0 && orbs.length) {
      if (mode === 'free') { newAccum = accum + orbSum; mult = newAccum; }
      else mult = orbSum;
    }
    const lineWin = tumbleWin * mult;

    const scatters = countOf(finalGrid, 'scatter');
    const scatterPay = (SCATTER_PAYS[Math.min(6, scatters)] || 0) * bet;
    let freeSpins = 0;
    if (mode === 'base' && scatters >= TRIGGER_MIN) freeSpins = FREE_SPINS;
    if (mode === 'free' && scatters >= RETRIGGER_MIN) freeSpins = RETRIGGER;

    const total = Math.min(MAX_WIN * bet, lineWin + scatterPay);
    return { steps, tumbleWin, orbs, orbSum, mult, accum: newAccum, lineWin, scatters, scatterPay, freeSpins, total };
  }

  const api = {
    COLS, ROWS, MAX_WIN, PAYS, SYMBOLS, MIN_COUNT, SCATTER_PAYS, FREE_SPINS, RETRIGGER, RETRIGGER_MIN, TRIGGER_MIN,
    BUY_COST, WEIGHTS, ORBS, payFor, playSpin,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FoliaMath = api;
})(typeof window !== 'undefined' ? window : globalThis);
