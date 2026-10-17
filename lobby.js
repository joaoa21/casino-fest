/* ==========================================================
   Casino Fest · lobby dos slots — filtros
   ========================================================== */
(() => {
  'use strict';

  // filtros
  const cards = [...document.querySelectorAll('.lb-card')];
  const buttons = [...document.querySelectorAll('.lb-filter')];
  const count = document.getElementById('lb-count'), empty = document.getElementById('lb-empty');
  function apply(f) {
    let shown = 0;
    cards.forEach(c => {
      const on = f === 'all' || c.dataset.tags.split(' ').includes(f);
      c.hidden = !on;
      if (on) shown++;
    });
    buttons.forEach(b => b.setAttribute('aria-pressed', b.dataset.f === f ? 'true' : 'false'));
    count.textContent = `${shown} ${shown === 1 ? 'jogo' : 'jogos'}`;
    empty.hidden = shown > 0;
  }
  buttons.forEach(b => b.addEventListener('click', () => apply(b.dataset.f)));
})();
