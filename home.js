/* ==========================================================
   Casino Fest · página inicial — categorias de jogos
   Os cards vêm de uma lista única; cada categoria é uma seção.
   ========================================================== */
(() => {
  'use strict';

  const PLAY = '<span class="lb-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span>';

  // todos os jogos do cassino
  const GAMES = {
    space: { href: 'crash.html', theme: 'space', bg: 'lobby/space.webp', char: '<img class="lb-astro" src="crash/astronauta.webp" alt="" loading="lazy">', badges: ['Aposta dupla'], isNew: true, max: 'até 10.000x', title: ['Space', 'Fest'] },
    fortuna: { href: 'fortuna.html', theme: 'fortuna', bg: 'lobby/fortuna.webp', char: '<img class="lb-king" src="folia/rei.webp" alt="" loading="lazy">', badges: ['Bônus surpresa'], isNew: true, max: 'até 2.500x', title: ['Rei da', 'Fortuna'] },
    folia: { href: 'folia.html', theme: 'folia', bg: 'lobby/folia.webp', char: '<img class="lb-king party" src="lobby/rei-folia.webp" alt="" loading="lazy">', badges: ['Multiplicadores'], isNew: true, max: 'até 5.000x', title: ['Rei da', 'Folia'] },
    coroa: { href: 'maquinas.html?m=coroa', theme: 'coroa', bg: 'lobby/coroa.webp', badges: ['Giros grátis x3'], max: '5 rolos', title: ['Coroa da', 'Sorte'] },
    classico: { href: 'maquinas.html?m=classico', theme: 'classico', bg: 'lobby/classico.webp', badges: ['Roda da Fortuna'], max: '3 rolos', title: ['Sete', 'Clássico'] },
    poker: { href: 'poker.html', theme: 'poker', bg: 'lobby/poker.webp', badges: ['4 na mesa'], max: "Hold'em", title: ['Poker', 'Fest'] },
    blackjack: { href: 'blackjack.html', theme: 'blackjack', bg: 'lobby/blackjack.webp', badges: ['Paga 3:2'], max: '21', title: ['Black', 'jack'] },
    bacbo: { href: 'bacbo.html', theme: 'bacbo', bg: 'lobby/bacbo.webp', badges: ['Dados'], isNew: true, max: 'até 88:1', title: ['Bac', 'Bo'] },
    paciencia: { href: 'paciencia.html', theme: 'paciencia', bg: 'lobby/paciencia.webp', badges: ['Modo Vegas'], isNew: true, max: 'Klondike', title: ['Paciência', 'Fest'] },
    roleta: { href: 'roleta.html', theme: 'roleta', bg: 'lobby/roleta.webp', badges: ['Roda 3D'], max: 'até 36x', title: ['Roleta', 'Europeia'] },
  };

  // categorias (a ordem é a ordem na página)
  const CATEGORIES = [
    { id: 'novidades', name: 'Novidades', icon: 'sparkle', items: ['paciencia', 'bacbo', 'space', 'fortuna'] },
    { id: 'slots', name: 'Slots', icon: 'i-slots', items: ['fortuna', 'folia', 'coroa', 'classico'], more: 'slots.html' },
    { id: 'mesa', name: 'Jogos de mesa', icon: 'i-cards', items: ['bacbo', 'poker', 'blackjack', 'roleta'] },
    { id: 'cartas', name: 'Cartas', icon: 'i-solitaire', items: ['paciencia', 'poker', 'blackjack'] },
    { id: 'crash', name: 'Crash', icon: 'i-crash', items: ['space'] },
  ];

  const card = id => {
    const g = GAMES[id];
    const badges = (g.isNew ? '<b class="new">Novo</b>' : '') + g.badges.map(b => `<b>${b}</b>`).join('');
    return `<a class="lb-card theme-${g.theme}" href="${g.href}">
      <div class="lb-art"><img class="lb-bg" src="${g.bg}" alt="" loading="lazy">${g.char || ''}</div>
      <span class="lb-badges">${badges}</span>
      <span class="lb-max">${g.max}</span>
      ${PLAY}
      <div class="lb-info"><strong><span>${g.title[0]}</span> <span>${g.title[1]}</span></strong></div>
    </a>`;
  };
  const icon = name => (name === 'sparkle'
    ? '<svg aria-hidden="true" style="color: #ffc940"><use href="#sparkle"/></svg>'
    : `<svg aria-hidden="true"><use href="#${name}"/></svg>`);
  const count = n => `${n} ${n === 1 ? 'jogo' : 'jogos'}`;

  // faixa de categorias: atalhos para cada seção
  document.getElementById('home-cats').innerHTML = CATEGORIES.map(c =>
    `<a class="home-cat cat-${c.id}" href="#${c.id}">${icon(c.icon)}<span><b>${c.name}</b><small>${count(c.items.length)}</small></span></a>`).join('');

  // uma seção por categoria
  document.getElementById('home-sections').innerHTML = CATEGORIES.map(c => `
    <section class="lb-section home-section" id="${c.id}" aria-labelledby="t-${c.id}">
      <div class="lb-head">
        <h2 id="t-${c.id}">${icon(c.icon)}${c.name} <span>${count(c.items.length)}</span></h2>
        ${c.more ? `<a class="home-more" href="${c.more}">Ver todos <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>` : ''}
      </div>
      <div class="lb-grid">${c.items.map(card).join('')}</div>
    </section>`).join('');
})();
