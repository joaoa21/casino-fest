/* ==========================================================
   Casino Fest — base compartilhada por todos os jogos
   - ícones (sprite SVG), cabeçalho e menu de jogos
   - carteira de fichas única (salva no navegador)
   - cartas, fichas, confete e avisos
   Carregue este arquivo logo depois do <header class="site-header">.
   ========================================================== */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     Sprite de ícones: injetado no topo da página
  --------------------------------------------------------- */
  const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
    <defs>
      <!-- Naipes com brilho: forma + sombreado + reflexo diagonal -->
      <linearGradient id="suit-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>
      <g id="g-spade"><path d="M12 1.6C9.5 5.4 2.8 8.9 2.8 13.7c0 2.6 2.1 4.6 4.6 4.6 1.6 0 3-.7 3.8-1.9-.3 2.5-1.4 4.4-3.5 6h8.6c-2.1-1.6-3.2-3.5-3.5-6 .8 1.2 2.2 1.9 3.8 1.9 2.5 0 4.6-2 4.6-4.6C21.2 8.9 14.5 5.4 12 1.6z"/></g>
      <clipPath id="clip-spade"><use href="#g-spade"/></clipPath>
      <symbol id="s-spade" viewBox="0 0 24 24"><use href="#g-spade" fill="currentColor"/><use href="#g-spade" fill="url(#suit-shade)"/><path clip-path="url(#clip-spade)" d="M0 0h24v7.5L0 15.5z" fill="#fff" opacity=".13"/></symbol>
      <g id="g-heart"><path d="M12 21.4C8.2 18.4 1.8 13.8 1.8 8.2c0-3.2 2.5-5.6 5.4-5.6 2.1 0 3.8 1.1 4.8 2.9 1-1.8 2.7-2.9 4.8-2.9 2.9 0 5.4 2.4 5.4 5.6 0 5.6-6.4 10.2-10.2 13.2z"/></g>
      <clipPath id="clip-heart"><use href="#g-heart"/></clipPath>
      <symbol id="s-heart" viewBox="0 0 24 24"><use href="#g-heart" fill="currentColor"/><use href="#g-heart" fill="url(#suit-shade)"/><path clip-path="url(#clip-heart)" d="M0 0h24v7.5L0 15.5z" fill="#fff" opacity=".13"/></symbol>
      <g id="g-diamond"><path d="M12 1.4c2.2 4 4.8 7.4 8.2 10.6-3.4 3.2-6 6.6-8.2 10.6-2.2-4-4.8-7.4-8.2-10.6C7.2 8.8 9.8 5.4 12 1.4z"/></g>
      <clipPath id="clip-diamond"><use href="#g-diamond"/></clipPath>
      <symbol id="s-diamond" viewBox="0 0 24 24"><use href="#g-diamond" fill="currentColor"/><use href="#g-diamond" fill="url(#suit-shade)"/><path clip-path="url(#clip-diamond)" d="M0 0h24v7.5L0 15.5z" fill="#fff" opacity=".13"/></symbol>
      <g id="g-club"><circle cx="12" cy="6.6" r="4.6"/><circle cx="6.9" cy="13.3" r="4.6"/><circle cx="17.1" cy="13.3" r="4.6"/><path d="M10.4 10h3.2v4.5h-3.2z"/><path d="M11.1 13.8c-.2 3.6-1.5 6.2-3.8 8.3h9.4c-2.3-2.1-3.6-4.7-3.8-8.3z"/></g>
      <clipPath id="clip-club"><use href="#g-club"/></clipPath>
      <symbol id="s-club" viewBox="0 0 24 24"><use href="#g-club" fill="currentColor"/><use href="#g-club" fill="url(#suit-shade)"/><path clip-path="url(#clip-club)" d="M0 0h24v7.5L0 15.5z" fill="#fff" opacity=".13"/></symbol>

      <symbol id="i-chip" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="22" fill="currentColor"/>
        <circle cx="24" cy="24" r="18.5" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="7.26 7.26"/>
        <circle cx="24" cy="24" r="12" fill="currentColor" stroke="#fff" stroke-width="1.6" stroke-dasharray="2.5 2"/>
      </symbol>

      <!-- Marca Casino Fest -->
      <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a6"/><stop offset=".45" stop-color="#ffc928"/><stop offset="1" stop-color="#ff8a00"/></linearGradient>
      <linearGradient id="lg-lilac" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#f6d2ff"/><stop offset="1" stop-color="#c77dff"/></linearGradient>
      <symbol id="crown" viewBox="0 0 48 32">
        <path d="M5 25 3 9l11 8.5L24 4l10 13.5L45 9l-2 16z" fill="url(#lg-gold)" stroke="#3d0f68" stroke-width="2.2" stroke-linejoin="round"/>
        <rect x="4.5" y="23.5" width="39" height="6.5" rx="2.5" fill="#ffb000" stroke="#3d0f68" stroke-width="2.2"/>
        <g fill="#fff3a6" stroke="#3d0f68" stroke-width="1.8"><circle cx="3.5" cy="8" r="2.8"/><circle cx="24" cy="3.4" r="3"/><circle cx="44.5" cy="8" r="2.8"/></g>
        <ellipse cx="24" cy="17.5" rx="3" ry="3.8" fill="#e8264a" stroke="#3d0f68" stroke-width="1.6"/>
        <g fill="#fff" opacity=".85"><circle cx="12" cy="26.8" r="1.3"/><circle cx="24" cy="26.8" r="1.3"/><circle cx="36" cy="26.8" r="1.3"/></g>
        <path d="M8 12.5l1.2 9" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>
      </symbol>
      <symbol id="sparkle" viewBox="-6 -6 12 12"><path d="M0-6Q.9-.9 6 0Q.9.9 0 6Q-.9.9-6 0Q-.9-.9 0-6z" fill="currentColor"/></symbol>

      <!-- Figuras das cartas: metade de cima (a de baixo é a mesma girada 180°) -->
      <symbol id="court-K" viewBox="0 0 60 51">
        <path d="M5 51V37q2-8 13-9h24q11 1 13 9v14z" fill="#d42a2a" stroke="#151515" stroke-width=".6"/>
        <path d="M5 40h7v11H5zM48 40h7v11h-7z" fill="#f4b81c" stroke="#151515" stroke-width=".5"/>
        <path d="M6 43h5v2H7v2h4M49 43h5v2h-4v2h4" fill="none" stroke="#151515" stroke-width=".7"/>
        <path d="M21 28h18v23H21z" fill="#f4b81c"/>
        <path d="M24 28h12v23H24z" fill="#151515"/>
        <g fill="#f4b81c"><circle cx="30" cy="34" r="1.8"/><circle cx="30" cy="40.5" r="1.8"/><circle cx="30" cy="47" r="1.8"/></g>
        <g fill="#fff"><circle cx="25.6" cy="31" r=".7"/><circle cx="34.4" cy="31" r=".7"/><circle cx="25.6" cy="36" r=".7"/><circle cx="34.4" cy="36" r=".7"/><circle cx="25.6" cy="41" r=".7"/><circle cx="34.4" cy="41" r=".7"/><circle cx="25.6" cy="46" r=".7"/><circle cx="34.4" cy="46" r=".7"/></g>
        <circle cx="15" cy="34" r="4.3" fill="#2a54c8" stroke="#fff" stroke-width="1" stroke-dasharray="1.4 1"/>
        <circle cx="45" cy="34" r="4.3" fill="#2a54c8" stroke="#fff" stroke-width="1" stroke-dasharray="1.4 1"/>
        <ellipse cx="30" cy="21" rx="11" ry="10" fill="#fff" stroke="#2a54c8" stroke-width=".8"/>
        <path d="M21 16q-1 6 1 11M23 14q-2 7 0 13M39 16q1 6-1 11M37 14q2 7 0 13" fill="none" stroke="#2a54c8" stroke-width=".5"/>
        <ellipse cx="30" cy="19" rx="6.2" ry="7.2" fill="#fbe3c8" stroke="#a0612f" stroke-width=".5"/>
        <path d="M24 23q6 12 12 0q-1 5-6 7q-5-2-6-7z" fill="#fff" stroke="#2a54c8" stroke-width=".6"/>
        <path d="M27 25.5l.5 2M30 26l0 2.5M33 25.5l-.5 2" stroke="#2a54c8" stroke-width=".4"/>
        <g fill="#2a54c8"><ellipse cx="27.6" cy="18" rx="1.1" ry=".6"/><ellipse cx="32.4" cy="18" rx="1.1" ry=".6"/></g>
        <path d="M26.2 16.4h2.6M31.2 16.4h2.6M30 18.5v3" stroke="#6b3a17" stroke-width=".5"/>
        <path d="M26.5 23.2q3.5-2.2 3.5-.4q0-1.8 3.5.4" fill="none" stroke="#2a54c8" stroke-width=".8"/>
        <path d="M18 13h24l1.5-9-4.5 4-4-6-5 5-5-5-4 6-4.5-4z" fill="#f4b81c" stroke="#151515" stroke-width=".6"/>
        <path d="M18.5 10h23v3.5h-23z" fill="#d42a2a" stroke="#151515" stroke-width=".5"/>
        <g fill="#151515"><circle cx="16.5" cy="4" r="1"/><circle cx="26" cy="2" r="1"/><circle cx="34" cy="2" r="1"/><circle cx="43.5" cy="4" r="1"/></g>
        <path d="M50 5h3v37h-3z" fill="#fff" stroke="#2a54c8" stroke-width=".6"/>
        <path d="M46.5 41h10v2.4h-10z" fill="#f4b81c" stroke="#151515" stroke-width=".5"/>
        <circle cx="51.5" cy="46" r="2.8" fill="#fbe3c8" stroke="#a0612f" stroke-width=".5"/>
      </symbol>

      <symbol id="court-Q" viewBox="0 0 60 51">
        <path d="M5 51V37q2-8 13-9h24q11 1 13 9v14z" fill="#2a54c8" stroke="#151515" stroke-width=".6"/>
        <path d="M12 51V35q4-6 8-7h20q4 1 8 7v16z" fill="#d42a2a" stroke="#151515" stroke-width=".5"/>
        <path d="M22 28h16v23H22z" fill="#f4b81c" stroke="#151515" stroke-width=".5"/>
        <path d="M30 31l3 4-3 4-3-4zM30 41l3 4-3 4-3-4z" fill="#d42a2a" stroke="#151515" stroke-width=".4"/>
        <path d="M5 45h7M48 45h7M5 48h7M48 48h7" stroke="#f4b81c" stroke-width="1.2"/>
        <ellipse cx="30" cy="22" rx="12" ry="11.5" fill="#f4b81c" stroke="#151515" stroke-width=".5"/>
        <path d="M20 18q-2 8 1 14M22.5 15q-2 9 0 16M40 18q2 8-1 14M37.5 15q2 9 0 16" fill="none" stroke="#b07a00" stroke-width=".6"/>
        <ellipse cx="30" cy="19.5" rx="6" ry="7.2" fill="#fbe3c8" stroke="#a0612f" stroke-width=".5"/>
        <g fill="#2a54c8"><ellipse cx="27.7" cy="18.4" rx="1" ry=".6"/><ellipse cx="32.3" cy="18.4" rx="1" ry=".6"/></g>
        <path d="M26.4 16.8q1.3-.8 2.6 0M31 16.8q1.3-.8 2.6 0M30 19v2.6" fill="none" stroke="#6b3a17" stroke-width=".45"/>
        <ellipse cx="30" cy="23.6" rx="1.5" ry=".7" fill="#d42a2a"/>
        <path d="M23 28q7 6 14 0" fill="#fff" stroke="#2a54c8" stroke-width=".7"/>
        <path d="M19 12q2-9 6-5q5-6 10 0q4-4 6 5z" fill="#f4b81c" stroke="#151515" stroke-width=".6"/>
        <path d="M19.5 9.5h21v3h-21z" fill="#d42a2a" stroke="#151515" stroke-width=".5"/>
        <g fill="#2a54c8"><circle cx="25" cy="7.3" r="1"/><circle cx="30" cy="4" r="1.1"/><circle cx="35" cy="7.3" r="1"/></g>
        <path d="M50 46V24" stroke="#151515" stroke-width=".8"/>
        <path d="M46.5 24q3.5-8 7 0q-1.5 3-3.5 3t-3.5-3z" fill="#d42a2a" stroke="#151515" stroke-width=".5"/>
        <path d="M50 34q-4-1-5-4q4 0 5 4z" fill="#f4b81c" stroke="#151515" stroke-width=".4"/>
        <circle cx="50" cy="46" r="2.7" fill="#fbe3c8" stroke="#a0612f" stroke-width=".5"/>
      </symbol>

      <symbol id="court-J" viewBox="0 0 60 51">
        <path d="M5 51V37q2-8 13-9h24q11 1 13 9v14z" fill="#f4b81c" stroke="#151515" stroke-width=".6"/>
        <path d="M9 51V36q3-6 9-7h24q6 1 9 7v15z" fill="#d42a2a" stroke="#151515" stroke-width=".5"/>
        <path d="M23 28h14v23H23z" fill="#151515"/>
        <path d="M23 33h14M23 38h14M23 43h14M23 48h14" stroke="#f4b81c" stroke-width="1.3"/>
        <path d="M13 40q5 2 6 11M47 40q-5 2-6 11" fill="none" stroke="#2a54c8" stroke-width="1.6"/>
        <ellipse cx="22.5" cy="23" rx="4" ry="5" fill="#f4b81c" stroke="#151515" stroke-width=".5"/>
        <ellipse cx="37.5" cy="23" rx="4" ry="5" fill="#f4b81c" stroke="#151515" stroke-width=".5"/>
        <ellipse cx="30" cy="20" rx="6" ry="7.2" fill="#fbe3c8" stroke="#a0612f" stroke-width=".5"/>
        <g fill="#2a54c8"><ellipse cx="27.7" cy="19" rx="1" ry=".6"/><ellipse cx="32.3" cy="19" rx="1" ry=".6"/></g>
        <path d="M26.4 17.3h2.6M31 17.3h2.6M30 19.5v2.6M28.5 24.3q1.5.8 3 0" fill="none" stroke="#6b3a17" stroke-width=".45"/>
        <path d="M23 28q7 5 14 0" fill="#fff" stroke="#2a54c8" stroke-width=".7"/>
        <path d="M20 12.5q1-10 11-10q9 0 9 10z" fill="#d42a2a" stroke="#151515" stroke-width=".6"/>
        <ellipse cx="30" cy="12.5" rx="12" ry="2.6" fill="#f4b81c" stroke="#151515" stroke-width=".5"/>
        <path d="M37 6q8-7 9 3q-4-3-9-3z" fill="#fff" stroke="#2a54c8" stroke-width=".6"/>
        <path d="M51 4v44" stroke="#151515" stroke-width="1"/>
        <path d="M51 3l4 6-4 5-4-5z" fill="#f4b81c" stroke="#151515" stroke-width=".5"/>
        <circle cx="51" cy="44" r="2.7" fill="#fbe3c8" stroke="#a0612f" stroke-width=".5"/>
      </symbol>

      <!-- Ficha em perspectiva: a cor vem de currentColor -->
      <symbol id="chip3d" viewBox="0 0 40 34">
        <path d="M0 14v6a20 14 0 0 0 40 0v-6z" fill="currentColor"/>
        <path d="M0 14v6a20 14 0 0 0 40 0v-6z" fill="#000" opacity=".38"/>
        <g fill="#fff" opacity=".9">
          <path d="M3.2 22.4l3.6 2.3v5.6l-3.6-2.4z"/>
          <path d="M14.5 27.3h4.2v6.1h-4.2z" transform="skewY(2)"/>
          <path d="M22.3 27.7h4.2v6.1h-4.2z" transform="skewY(-2)"/>
          <path d="M36.8 22.4l-3.6 2.3v5.6l3.6-2.4z"/>
        </g>
        <ellipse cx="20" cy="14" rx="20" ry="14" fill="currentColor"/>
        <ellipse cx="20" cy="14" rx="16.8" ry="11.7" fill="none" stroke="#fff" stroke-width="4.2" stroke-dasharray="5.7 5.85" stroke-dashoffset="2"/>
        <ellipse cx="20" cy="14" rx="11" ry="7.6" fill="currentColor" stroke="#fff" stroke-width=".9" stroke-dasharray="2 1.6"/>
        <ellipse cx="20" cy="14" rx="8.4" ry="5.6" fill="#fff" opacity=".14"/>
        <ellipse cx="15" cy="7" rx="9" ry="3.2" fill="#fff" opacity=".18"/>
      </symbol>

      <symbol id="i-cards" viewBox="0 0 32 32">
        <g transform="rotate(-15 12 17)"><rect x="4.5" y="6" width="14" height="19.5" rx="2.6" fill="#fff" stroke="#3d0f68" stroke-width="1.7"/><use href="#s-heart" x="7.5" y="11.5" width="8" height="8" color="#e5383f"/></g>
        <g transform="rotate(12 20 15)"><rect x="12.5" y="4.5" width="14" height="19.5" rx="2.6" fill="#fff" stroke="#3d0f68" stroke-width="1.7"/><use href="#s-spade" x="15.5" y="10" width="8" height="8" color="#1c0736"/></g>
        <circle cx="9" cy="25.5" r="5.2" fill="#ff3d7f" stroke="#3d0f68" stroke-width="1.5"/>
        <circle cx="9" cy="25.5" r="3.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="1.8 1.75"/>
        <circle cx="9" cy="25.5" r="1.9" fill="#ffc940"/>
      </symbol>
      <symbol id="i-blackjack" viewBox="0 0 32 32">
        <g transform="rotate(-12 11 15)"><rect x="3.5" y="5" width="14" height="19.5" rx="2.6" fill="#7b3dff" stroke="#3d0f68" stroke-width="1.7"/><rect x="5.8" y="7.3" width="9.4" height="14.9" rx="1.4" fill="none" stroke="#ffc940" stroke-width="1.1"/></g>
        <g transform="rotate(8 18 14)"><rect x="10.5" y="3.5" width="14" height="19.5" rx="2.6" fill="#fff" stroke="#3d0f68" stroke-width="1.7"/>
          <text x="14.2" y="10.6" text-anchor="middle" font-size="6.4" font-weight="700" font-family="'Times New Roman', serif" fill="#1c0736">A</text>
          <use href="#s-spade" x="14.2" y="10.5" width="9.5" height="9.5" color="#1c0736"/></g>
        <circle cx="24.5" cy="24" r="6.3" fill="url(#lg-gold)" stroke="#3d0f68" stroke-width="1.6"/>
        <text x="24.5" y="26.6" text-anchor="middle" font-size="7" font-weight="800" font-family="Outfit, sans-serif" fill="#3d0f68">21</text>
      </symbol>
      <symbol id="i-roulette" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="13.6" fill="#ffc940" stroke="#3d0f68" stroke-width="1.7"/>
        <circle cx="16" cy="16" r="10.6" fill="#e5383f"/>
        <circle cx="16" cy="16" r="8.6" fill="none" stroke="#1c0736" stroke-width="4" stroke-dasharray="3.38 3.38"/>
        <circle cx="16" cy="16" r="8.6" fill="none" stroke="#19d3a2" stroke-width="4" stroke-dasharray="3.38 50.66" stroke-dashoffset="-1.7"/>
        <circle cx="16" cy="16" r="6.3" fill="#7b3dff" stroke="#3d0f68" stroke-width="1.2"/>
        <path d="M16 11v10M11 16h10" stroke="#ffc940" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="16" cy="16" r="2.2" fill="url(#lg-gold)" stroke="#3d0f68" stroke-width="1"/>
        <circle cx="22.6" cy="8.6" r="2" fill="#fff" stroke="#3d0f68" stroke-width="1"/>
      </symbol>
      <symbol id="i-crash" viewBox="0 0 32 32">
        <path d="M4 28 12 20" stroke="#ff3d7f" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M8.5 23.5c-3 .5-5 2.5-5.5 5.5 3-.5 5-2.5 5.5-5.5z" fill="#ffc940" stroke="" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M10 17 6.5 15.5 9 11l5 1zM15 22l1.5 3.5L21 23l-1-5z" fill="#7b4dff" stroke="" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M11.5 20.5 9.5 18.5C13 11 19 5.5 28 4c-1.5 9-7 15-14.5 18.5z" fill="#ff5fa2" stroke="" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="20.5" cy="11.5" r="2.6" fill="#4fdcf5" stroke="" stroke-width="1.4"/>
        <path d="M26 6.2c-1.3-.4-2.4-.6-3.4-.6" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>
      </symbol>
      <symbol id="i-slots" viewBox="0 0 32 32">
        <path d="M6.5 9.5q0-6 9-6t9 6z" fill="url(#lg-gold)" stroke="#3d0f68" stroke-width="1.6" stroke-linejoin="round"/>
        <rect x="4" y="9" width="21" height="19" rx="3.5" fill="#ff3d7f" stroke="#3d0f68" stroke-width="1.7"/>
        <rect x="6.6" y="12.2" width="15.8" height="9.6" rx="1.8" fill="#fff" stroke="#3d0f68" stroke-width="1.3"/>
        <path d="M11.9 12.6v8.8M17.1 12.6v8.8" stroke="#3d0f68" stroke-width=".9" opacity=".5"/>
        <g font-family="'Lilita One', 'Outfit', sans-serif" font-size="7.6" text-anchor="middle" fill="#e5383f"><text x="9.3" y="19.8">7</text><text x="14.5" y="19.8">7</text><text x="19.7" y="19.8">7</text></g>
        <rect x="9" y="23.6" width="11" height="2.4" rx="1.2" fill="#c4126a"/>
        <path d="M25 19.5h1.6q1.4 0 1.4-1.4V9.6" fill="none" stroke="#3d0f68" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="28" cy="8" r="2.5" fill="#e5383f" stroke="#3d0f68" stroke-width="1.3"/>
      </symbol>
      <symbol id="i-refresh" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14.6-4.4L4 8.5"/><path d="M4 3.5v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.4l1.4-1.9"/><path d="M20 20.5v-5h-5"/></g></symbol>
      <symbol id="i-dice" viewBox="0 0 32 32">
        <rect x="3" y="7" width="15" height="15" rx="3.5" transform="rotate(-12 10.5 14.5)" fill="#2f7bff" stroke="#3d0f68" stroke-width="1.8"/>
        <g fill="#fff" transform="rotate(-12 10.5 14.5)"><circle cx="7" cy="11" r="1.5"/><circle cx="10.5" cy="14.5" r="1.5"/><circle cx="14" cy="18" r="1.5"/></g>
        <rect x="14" y="12" width="15" height="15" rx="3.5" transform="rotate(10 21.5 19.5)" fill="#ff3d55" stroke="#3d0f68" stroke-width="1.8"/>
        <g fill="#fff" transform="rotate(10 21.5 19.5)"><circle cx="18" cy="16" r="1.5"/><circle cx="25" cy="16" r="1.5"/><circle cx="18" cy="23" r="1.5"/><circle cx="25" cy="23" r="1.5"/></g>
      </symbol>
      <symbol id="i-solitaire" viewBox="0 0 32 32">
        <rect x="4" y="3" width="13" height="18" rx="2.4" fill="#7b3dff" stroke="#3d0f68" stroke-width="1.6"/>
        <rect x="6" y="5" width="9" height="14" rx="1.3" fill="none" stroke="#ffc940" stroke-width="1"/>
        <rect x="9.5" y="7.5" width="13" height="18" rx="2.4" fill="#fff" stroke="#3d0f68" stroke-width="1.6"/>
        <use href="#s-spade" x="12" y="13" width="8" height="8" color="#1c0736"/>
        <rect x="15" y="12" width="13" height="18" rx="2.4" fill="#fff" stroke="#3d0f68" stroke-width="1.6"/>
        <text x="18.6" y="18.4" text-anchor="middle" font-size="5.6" font-weight="700" font-family="'Times New Roman', serif" fill="#e5383f">A</text>
        <use href="#s-heart" x="17.5" y="18" width="8" height="8" color="#e5383f"/>
      </symbol>
      <symbol id="i-home" viewBox="0 0 24 24">
        <path d="M5 10.5V20.5h14V10.5" fill="#ff5fa2" stroke="#3d0f68" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M2.5 11.5 12 3.5l9.5 8" fill="url(#lg-gold)" stroke="#3d0f68" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="M10 20.5v-5.5h4v5.5" fill="#3d0f68"/>
      </symbol>
      <symbol id="i-sound" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.2 5.8a9 9 0 0 1 0 12.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
      <symbol id="i-mute" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
      <symbol id="i-history" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".6"/><circle cx="4" cy="12" r=".6"/><circle cx="4" cy="18" r=".6"/></g></symbol>
    </defs>
  </svg>`;
  document.body.insertAdjacentHTML('afterbegin', SPRITE);

  /* ---------------------------------------------------------
     Utilidades
  --------------------------------------------------------- */
  const fmt = n => '$' + Math.round(n).toLocaleString('pt-BR');
  const $ = (sel, root = document) => root.querySelector(sel);
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------------------------------------------------------
     Cabeçalho do cassino
  --------------------------------------------------------- */
  const GAMES = [
    { id: 'home', name: 'Início', icon: 'i-home', href: 'index.html' },
    { id: 'poker', name: 'Poker', icon: 'i-cards', href: 'poker.html' },
    { id: 'blackjack', name: 'Blackjack', icon: 'i-blackjack', href: 'blackjack.html' },
    { id: 'roleta', name: 'Roleta', icon: 'i-roulette', href: 'roleta.html' },
    { id: 'bacbo', name: 'Bac Bo', icon: 'i-dice', href: 'bacbo.html' },
    { id: 'paciencia', name: 'Paciência', icon: 'i-solitaire', href: 'paciencia.html' },
    { id: 'slots', name: 'Slots', icon: 'i-slots', href: 'slots.html' },
    { id: 'crash', name: 'Crash', icon: 'i-crash', href: 'crash.html' },
  ];

  /* Logo Casino Fest (cabeçalho e feltro das mesas) */
  function logoSvg(cls = 'logo-svg') {
    return `<svg class="${cls}" viewBox="0 0 168 100" role="img" aria-label="Casino Fest">
        <g class="sparkles">
          <use href="#sparkle" x="6" y="30" width="12" height="12" color="#ffc940"/>
          <use href="#sparkle" x="150" y="22" width="13" height="13" color="#ff5fa2"/>
          <use href="#sparkle" x="146" y="76" width="10" height="10" color="#ffc940"/>
          <use href="#sparkle" x="14" y="80" width="9" height="9" color="#c79bff"/>
          <use href="#sparkle" x="48" y="4" width="8" height="8" color="#ff5fa2"/>
          <use href="#sparkle" x="114" y="2" width="10" height="10" color="#ffc940"/>
        </g>
        <use class="logo-crown" href="#crown" x="62" y="1" width="44" height="29"/>
        <g font-family="'Lilita One', 'Outfit', sans-serif" text-anchor="middle" stroke-linejoin="round">
          <text x="84" y="63" font-size="40" letter-spacing="1" fill="#1c0736" stroke="#1c0736" stroke-width="10">CASINO</text>
          <text x="84" y="59" font-size="40" letter-spacing="1" fill="url(#lg-gold)" stroke="#3d0f68" stroke-width="8" paint-order="stroke">CASINO</text>
          <text x="84" y="97" font-size="36" letter-spacing="2" fill="#1c0736" stroke="#1c0736" stroke-width="10">FEST</text>
          <text x="84" y="93" font-size="36" letter-spacing="2" fill="url(#lg-lilac)" stroke="#3d0f68" stroke-width="8" paint-order="stroke">FEST</text>
        </g>
      </svg>`;
  }

  function renderHeader() {
    const host = $('.site-header');
    if (!host) return;
    const active = document.body.dataset.game;
    const tabs = GAMES.map(g => {
      const inner = `<svg><use href="#${g.icon}"/></svg><span>${g.name}</span>`;
      if (!g.href) return `<button class="game-tab soon" type="button" data-game="${g.name}" title="Em breve">${inner}<span class="soon-tag">Em breve</span></button>`;
      const on = g.id === active;
      return `<a class="game-tab${on ? ' active' : ''}" href="${g.href}"${on ? ' aria-current="page"' : ''} title="${g.name}">${inner}</a>`;
    }).join('');

    host.innerHTML = `
      <div class="site-header-inner">
        <a class="logo" href="index.html" aria-label="Casino Fest — início">
          ${logoSvg()}
        </a>
        <nav class="games" aria-label="Jogos">${tabs}</nav>
        <div class="wallet" id="wallet" title="Suas fichas — valem em todos os jogos">
          <svg class="wallet-chip" aria-hidden="true"><use href="#i-chip"/></svg>
          <div class="wallet-text">
            <span class="wallet-label">Fichas</span>
            <b class="wallet-amount" id="wallet-amount">$0</b>
          </div>
          <button class="wallet-add" id="wallet-add" type="button" aria-label="Recarregar fichas" title="Recarregar fichas">+</button>
          <span class="wallet-delta" id="wallet-delta" aria-hidden="true"></span>
        </div>
        <button class="sound-btn" id="sound-toggle" type="button" aria-pressed="true" aria-label="Som do cassino" title="Som: ligado">
          <svg aria-hidden="true"><use href="#i-sound"/></svg>
        </button>
        <div class="profile" title="Você">
          <span class="avatar ring-you"><img src="avatars/you.webp" alt="" draggable="false"></span>
        </div>
      </div>`;

    // menu rolável: deixa a aba do jogo atual à vista
    const nav = $('.games', host), cur = $('.game-tab.active', host);
    if (cur && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = cur.offsetLeft - nav.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2;

    host.querySelectorAll('.game-tab.soon').forEach(b => b.addEventListener('click', () => {
      toast(`${b.dataset.game} chega em breve ao Casino Fest!`);
    }));
    $('#wallet-add').addEventListener('click', () => wallet.requestRefill());
    sfx.bind($('#sound-toggle', host));
  }

  // rodapé comum: aviso das fichas de brincadeira
  function renderFooter() {
    if ($('.site-footer')) return;
    const f = document.createElement('footer');
    f.className = 'site-footer';
    f.innerHTML = '<span>Casino Fest</span> · fichas de brincadeira, sem dinheiro de verdade · jogue pela diversão';
    document.body.appendChild(f);
  }

  // aviso rápido + camada do confete (uma vez por página)
  document.body.insertAdjacentHTML('beforeend',
    '<div class="toast" id="toast" role="status" hidden></div>' +
    '<canvas class="confetti-layer" id="confetti" aria-hidden="true"></canvas>');

  /* ---------------------------------------------------------
     Sons: sintetizados na hora (Web Audio), sem arquivos.
     Só tocam depois do primeiro toque na página (regra dos navegadores)
     e podem ser desligados no botão do cabeçalho (preferência salva).
  --------------------------------------------------------- */
  const sfx = (() => {
    const KEY = 'casinofest:sound:v1';
    let on = true;
    try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* padrão ligado */ }
    let ctx = null, master = null, btn = null, last = {};

    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return ctx;
    }
    // o navegador só libera o áudio depois de um gesto: cria o contexto no primeiro toque
    const unlock = () => { if (ensure() && ctx.state === 'suspended') ctx.resume(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, unlock, { capture: true, passive: true }));

    const tone = (t, freq, dur, { type = 'sine', vol = 0.3, slide = 0, attack = 0.005 } = {}) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    };
    let noiseBuf = null;
    const noise = (t, dur, { vol = 0.25, from = 1800, to = 400, q = 0.8, type = 'bandpass' } = {}) => {
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf;
      f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(from, t);
      f.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(master);
      src.start(t); src.stop(t + dur + 0.02);
    };
    const click = (t, vol = 0.5, freq = 2400) => { noise(t, 0.035, { vol, from: freq, to: freq * 0.5, q: 1.2 }); tone(t, 180, 0.04, { type: 'square', vol: vol * 0.25 }); };

    const SOUNDS = {
      chip: t => { click(t, 0.45); click(t + 0.055, 0.3, 2000); },
      card: t => noise(t, 0.11, { vol: 0.22, from: 2600, to: 700, q: 0.7 }),
      dice: t => [0, 0.07, 0.16, 0.27, 0.41].forEach((d, i) => click(t + d, 0.4 - i * 0.05, 1600 + i * 200)),
      spin: t => noise(t, 0.5, { vol: 0.14, from: 500, to: 2400, q: 0.6 }),
      click: t => click(t, 0.3),
      coin: t => { tone(t, 1318, 0.12, { type: 'triangle', vol: 0.22 }); tone(t + 0.07, 1760, 0.22, { type: 'triangle', vol: 0.22 }); },
      win: t => [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.09, f, 0.35, { type: 'triangle', vol: 0.26 })),
      bigwin: t => [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => { tone(t + i * 0.1, f, 0.5, { type: 'triangle', vol: 0.26 }); tone(t + i * 0.1, f / 2, 0.5, { type: 'sine', vol: 0.12 }); }),
      lose: t => { tone(t, 330, 0.28, { type: 'triangle', vol: 0.18, slide: -90 }); tone(t + 0.2, 220, 0.4, { type: 'triangle', vol: 0.16, slide: -60 }); },
      crash: t => { noise(t, 0.6, { vol: 0.35, from: 3000, to: 120, q: 0.5, type: 'lowpass' }); tone(t, 110, 0.5, { type: 'sawtooth', vol: 0.12, slide: -70 }); },
    };

    function play(name) {
      if (!on || !SOUNDS[name] || !ctx || ctx.state !== 'running') return;
      const now = performance.now();
      if (now - (last[name] || 0) < 60) return;    // o mesmo som não se repete em cima do outro
      last[name] = now;
      try { SOUNDS[name](ctx.currentTime); } catch (e) { /* som é só enfeite */ }
    }
    function paint() {
      if (!btn) return;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = on ? 'Som: ligado' : 'Som: desligado';
      btn.innerHTML = `<svg aria-hidden="true"><use href="#${on ? 'i-sound' : 'i-mute'}"/></svg>`;
    }
    function toggle() {
      on = !on;
      try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* sem armazenamento */ }
      paint();
      if (on) { unlock(); setTimeout(() => play('coin'), 30); }
    }
    return {
      play,
      get on() { return on; },
      get ready() { return !!ctx && ctx.state === 'running'; },
      bind(b) { btn = b; paint(); b.addEventListener('click', toggle); },
    };
  })();

  /* ---------------------------------------------------------
     Aviso rápido
  --------------------------------------------------------- */
  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
  }

  /* ---------------------------------------------------------
     Confete (origem: centro de um elemento)
  --------------------------------------------------------- */
  function confetti(amount = 140, originEl) {
    sfx.play(amount >= 200 ? 'bigwin' : 'win');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = $('#confetti'), ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#ffc940', '#ff3d7f', '#7b4dff', '#19d3a2', '#ffffff', '#ff8a3d'];
    const rect = (originEl || document.body).getBoundingClientRect();
    const ox = rect.left + rect.width / 2, oy = rect.top + Math.min(rect.height * 0.45, H * 0.6);
    const parts = Array.from({ length: amount }, () => {
      const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(7, 16);
      return {
        x: ox + rnd(-40, 40), y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        w: rnd(6, 11), h: rnd(3, 6), rot: rnd(0, 6.28), vr: rnd(-0.3, 0.3),
        c: colors[Math.floor(Math.random() * colors.length)], life: rnd(90, 150),
      };
    });
    const id = (confetti.id = (confetti.id || 0) + 1);
    let frame = 0;
    (function tick() {
      if (id !== confetti.id) return;
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of parts) {
        if (frame > p.life) continue;
        alive++;
        p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, (p.life - frame) / 30));
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
        ctx.restore();
      }
      frame++;
      if (alive) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    })();
  }
  confetti.stop = () => { confetti.id = (confetti.id || 0) + 1; };

  /* ---------------------------------------------------------
     Carteira de fichas única (vale para todos os jogos)
  --------------------------------------------------------- */
  const WALLET_KEY = 'casinofest:wallet:v1';
  const START_BALANCE = 1000;
  const REFILL_AMOUNT = 1000;
  const REFILL_BELOW = 100;

  const wallet = (() => {
    let balance = START_BALANCE;
    let shown = null, anim = 0, displayTimer = 0;
    let refillGuard = null;          // o jogo pode impedir a recarga (ex.: no meio de uma mão)
    const listeners = [];

    function read() {
      try {
        const v = JSON.parse(localStorage.getItem(WALLET_KEY) || 'null');
        if (v && Number.isFinite(v.balance) && v.balance >= 0) return v.balance;
      } catch (e) { /* ignora */ }
      // migração: quem já tinha uma partida de pôquer salva continua com as fichas dela
      try {
        const poker = JSON.parse(localStorage.getItem('casinofest:poker:v1') || 'null');
        const me = poker && poker.game && poker.game.players && poker.game.players[0];
        if (me && Number.isFinite(me.stack)) return me.stack;
      } catch (e) { /* ignora */ }
      return START_BALANCE;
    }
    function write() {
      try { localStorage.setItem(WALLET_KEY, JSON.stringify({ balance, updatedAt: Date.now() })); } catch (e) { /* sem armazenamento */ }
    }

    function display(value, animate = true) {
      const amountEl = $('#wallet-amount'), box = $('#wallet'), deltaEl = $('#wallet-delta');
      if (!amountEl) return;
      if (shown === null || !animate) {
        anim++; shown = value; amountEl.textContent = fmt(value);
        box.classList.remove('up', 'down');
        return;
      }
      if (value === shown) return;
      const from = shown, diff = value - from;
      shown = value;
      sfx.play(diff > 0 ? 'coin' : 'chip');
      box.classList.remove('up', 'down');
      void box.offsetWidth;
      box.classList.add(diff > 0 ? 'up' : 'down');
      deltaEl.textContent = (diff > 0 ? '+' : '−') + fmt(Math.abs(diff));
      deltaEl.className = 'wallet-delta ' + (diff > 0 ? 'plus' : 'minus');
      void deltaEl.offsetWidth;
      deltaEl.classList.add('show');
      const id = ++anim, t0 = performance.now(), dur = 600;
      const step = t => {
        if (id !== anim) return;
        const k = Math.min(1, (t - t0) / dur);
        amountEl.textContent = fmt(from + diff * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
        else setTimeout(() => { if (id === anim) box.classList.remove('up', 'down'); }, 500);
      };
      requestAnimationFrame(step);
    }

    // muda o saldo; delay atrasa só a animação do topo (ex.: esperar as cartas aparecerem)
    function set(value, { animate = true, delay = 0, silent = false } = {}) {
      value = Math.max(0, Math.round(value));
      const changed = value !== balance;
      balance = value;
      write();
      clearTimeout(displayTimer);
      if (delay > 0) displayTimer = setTimeout(() => display(balance, animate), delay);
      else display(balance, animate);
      if (changed && !silent) listeners.forEach(fn => fn(balance));
    }

    function requestRefill(force = false) {
      if (!force && balance >= REFILL_BELOW) {
        toast(`A recarga grátis libera quando suas fichas ficarem abaixo de ${fmt(REFILL_BELOW)}.`);
        return false;
      }
      if (!force && refillGuard) {
        const msg = refillGuard();
        if (msg) { toast(msg); return false; }
      }
      set(balance + REFILL_AMOUNT);
      toast(`Você ganhou ${fmt(REFILL_AMOUNT)} em fichas grátis!`);
      confetti(90, $('#wallet'));
      return true;
    }

    balance = read();
    write();

    // outra aba mudou o saldo
    window.addEventListener('storage', e => {
      if (e.key !== WALLET_KEY) return;
      const v = read();
      if (v !== balance) { balance = v; display(balance); listeners.forEach(fn => fn(balance)); }
    });

    return {
      get balance() { return balance; },
      set,
      add: (d, opts) => set(balance + d, opts),
      display: () => display(balance, false),
      onChange: fn => listeners.push(fn),
      setRefillGuard: fn => { refillGuard = fn; },
      requestRefill,
      REFILL_AMOUNT,
    };
  })();

  /* ---------------------------------------------------------
     Cartas
  --------------------------------------------------------- */
  // ︎ força o naipe a aparecer como texto (e não como emoji)
  const SUITS = ['♠︎', '♥︎', '♦︎', '♣︎'];
  const SUIT_ICONS = ['s-spade', 's-heart', 's-diamond', 's-club'];
  const RED = new Set([1, 2]); // copas e ouros
  const FACE = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const rl = r => FACE[r] || String(r);
  const cardText = c => rl(c.r) + SUITS[c.s];

  function newDeck(decks = 1) {
    const d = [];
    for (let k = 0; k < decks; k++) {
      for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s, id: k * 100 + r * 4 + s });
    }
    return d;
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const suitSvg = (s, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#${SUIT_ICONS[s]}"/></svg>`;
  /* Posições clássicas dos naipes: coluna (L/C/R) e altura de 0 (topo) a 1 (base) */
  const PIP_LAYOUT = {
    2: [['C', 0], ['C', 1]],
    3: [['C', 0], ['C', .5], ['C', 1]],
    4: [['L', 0], ['R', 0], ['L', 1], ['R', 1]],
    5: [['L', 0], ['R', 0], ['C', .5], ['L', 1], ['R', 1]],
    6: [['L', 0], ['R', 0], ['L', .5], ['R', .5], ['L', 1], ['R', 1]],
    7: [['L', 0], ['R', 0], ['C', .25], ['L', .5], ['R', .5], ['L', 1], ['R', 1]],
    8: [['L', 0], ['R', 0], ['C', .25], ['L', .5], ['R', .5], ['C', .75], ['L', 1], ['R', 1]],
    9: [['L', 0], ['R', 0], ['L', 1 / 3], ['R', 1 / 3], ['C', .5], ['L', 2 / 3], ['R', 2 / 3], ['L', 1], ['R', 1]],
    10: [['L', 0], ['R', 0], ['C', 1 / 6], ['L', 1 / 3], ['R', 1 / 3], ['L', 2 / 3], ['R', 2 / 3], ['C', 5 / 6], ['L', 1], ['R', 1]],
  };
  const PIP_X = { L: 38, C: 50, R: 62 };
  const COURT = { 11: 'J', 12: 'Q', 13: 'K' };

  function cardHtml(c) {
    const r = rl(c.r);
    const corner = `<span class="c-rank${c.r === 10 ? ' ten' : ''}">${r}</span>${suitSvg(c.s, 'c-suit')}`;
    let mid;
    if (COURT[c.r]) {
      const half = `<use href="#court-${COURT[c.r]}" width="60" height="51"/>`;
      mid = `<svg class="c-court" viewBox="0 0 60 102" preserveAspectRatio="none" aria-hidden="true">` +
        `<rect x=".6" y=".6" width="58.8" height="100.8" fill="#fff" stroke="#2a54c8" stroke-width="1.2"/>` +
        `${half}<g transform="rotate(180 30 51)">${half}</g>` +
        `<path d="M1 51h58" stroke="#2a54c8" stroke-width=".35" opacity=".5"/></svg>`;
    } else if (c.r === 14) {
      mid = `<i class="c-pips">${suitSvg(c.s, `pip ace s${c.s}`).replace('<svg', '<svg style="left:50%;top:50%"')}</i>`;
    } else {
      const pips = PIP_LAYOUT[c.r].map(([col, y]) => suitSvg(c.s, 'pip' + (y > .5 ? ' flip' : ''))
        .replace('<svg', `<svg style="left:${PIP_X[col]}%;top:${22 + y * 56}%"`)).join('');
      mid = `<i class="c-pips${c.r >= 9 ? ' dense' : ''}">${pips}</i>`;
    }
    return `<i class="c-tl">${corner}</i>${mid}<i class="c-br">${corner}</i>`;
  }
  const BACK_HTML = '<i class="c-back"><svg aria-hidden="true"><use href="#crown"/></svg></i>';

  /* Atualiza um elemento .card só quando muda (e anima ao dar/virar) */
  function setCard(node, card, faceUp, hl) {
    let key;
    if (!card) key = 'none';
    else if (!faceUp) key = 'back';
    else key = 'f' + card.id + (hl ? 'h' : '');
    if (node.dataset.key === key) return false;
    const prev = node.dataset.key || 'none';
    node.dataset.key = key;
    node.className = 'card';
    if (key === 'none') { node.classList.add('empty'); node.innerHTML = ''; return true; }
    if (key === 'back') { node.classList.add('back'); node.innerHTML = BACK_HTML; }
    else {
      node.classList.add(RED.has(card.s) ? 'red' : 'black');
      if (hl) node.classList.add('hl');
      node.innerHTML = cardHtml(card);
    }
    const anim = prev === 'none' ? 'deal' : (prev === 'back' && key[0] === 'f' ? 'flip' : '');
    if (anim) { void node.offsetWidth; node.classList.add(anim); sfx.play('card'); }
    return true;
  }

  /* ---------------------------------------------------------
     Fichas
  --------------------------------------------------------- */
  const CHIP_VALUES = [1000, 500, 250, 100, 50, 25, 10, 5, 1];
  const chipSvg = v => `<svg class="chip c${v}" aria-hidden="true"><use href="#chip3d"/></svg>`;
  function chipBreakdown(amount) {
    const out = [];
    let rest = Math.round(amount);
    for (const v of CHIP_VALUES) {
      const n = Math.floor(rest / v);
      if (n) { out.push([v, n]); rest -= n * v; }
    }
    return out;
  }
  function chipStack(amount, max = 5) {
    let html = '', left = max;
    for (const [v, n] of chipBreakdown(amount)) {
      for (let i = 0; i < n && left > 0; i++, left--) html += chipSvg(v);
    }
    return `<span class="chips">${html}</span>`;
  }
  function chipColumns(amount, maxCols = 4, maxPer = 5) {
    return chipBreakdown(amount).slice(0, maxCols).map(([v, n]) =>
      `<span class="chips">${chipSvg(v).repeat(Math.min(n, maxPer))}</span>`).join('');
  }

  /* ---------------------------------------------------------
     Faixa de resultado (mesmo componente nos dois jogos)
  --------------------------------------------------------- */
  function showBanner(el, banner, lose) {
    if (!banner) { el.hidden = true; return; }
    el.hidden = false;
    const kicker = $('.banner-kicker', el), amount = $('.banner-amount', el);
    kicker.textContent = banner.kicker || '';
    kicker.hidden = !banner.kicker;
    $('.banner-title', el).textContent = banner.title;
    $('.banner-amount b', el).textContent = banner.amount || '';
    amount.hidden = !banner.amount;
    el.classList.toggle('lose', !!lose);
    if (lose) sfx.play('lose');
  }

  /* ---------------------------------------------------------
     Giro automático: menu para escolher quantas rodadas
     (as mesmas opções e preferências em todas as máquinas)
  --------------------------------------------------------- */
  const auto = (() => {
    const KEY = 'casinofest:auto:v1';
    const OPTIONS = [10, 25, 50, 100, 250, 500, Infinity];
    const BIG = 20;                                   // "prêmio grande" = 20x a aposta
    const prefs = { last: 10, stopBig: true };
    try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* sem armazenamento */ }
    if (prefs.last === null) prefs.last = Infinity;   // o JSON não guarda Infinity
    const savePrefs = () => {
      try { localStorage.setItem(KEY, JSON.stringify({ ...prefs, last: prefs.last === Infinity ? null : prefs.last })); } catch (e) { /* sem armazenamento */ }
    };
    const label = n => (n === Infinity ? '∞' : String(n));
    let menu = null, onPick = null, anchor = null;

    function build() {
      menu = document.createElement('div');
      menu.className = 'auto-menu';
      menu.setAttribute('role', 'dialog');
      menu.setAttribute('aria-label', 'Giro automático');
      menu.hidden = true;
      menu.innerHTML =
        '<div class="am-head"><b>Giro automático</b><small>Quantas rodadas?</small></div>' +
        `<div class="am-grid">${OPTIONS.map(n => `<button type="button" class="am-opt${n === Infinity ? ' inf' : ''}" data-n="${n}">${n === Infinity ? '∞ <small>sem limite</small>' : n}</button>`).join('')}</div>` +
        `<label class="am-check"><input type="checkbox" id="am-stop-big"> Parar em prêmio grande (${BIG}x ou mais)</label>` +
        '<p class="am-note">Também para quando faltam fichas e, nas máquinas com giros grátis, quando o bônus começa.</p>';
      document.body.appendChild(menu);
      menu.addEventListener('click', e => {
        const b = e.target.closest('[data-n]');
        if (!b) return;
        const n = Number(b.dataset.n);
        prefs.last = n;
        savePrefs();
        const cb = onPick;
        close();
        if (cb) cb(n);
      });
      menu.querySelector('#am-stop-big').addEventListener('change', e => { prefs.stopBig = e.target.checked; savePrefs(); });
      document.addEventListener('pointerdown', e => {
        if (!menu.hidden && !menu.contains(e.target) && !(anchor && anchor.contains(e.target))) close();
      }, true);
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { close(); if (anchor) anchor.focus(); } });
      window.addEventListener('resize', () => close());
    }
    function place() {
      const r = anchor.getBoundingClientRect(), m = menu.getBoundingClientRect();
      const left = Math.max(12, Math.min(window.innerWidth - m.width - 12, r.left + r.width / 2 - m.width / 2));
      const above = r.top - m.height - 10;
      menu.style.left = `${left}px`;
      menu.style.top = `${above >= 8 ? above : Math.min(window.innerHeight - m.height - 8, r.bottom + 10)}px`;
    }
    function open(btn, pick) {
      if (!menu) build();
      if (!menu.hidden && anchor === btn) return close();
      anchor = btn;
      onPick = pick;
      menu.querySelectorAll('[data-n]').forEach(b => b.classList.toggle('last', Number(b.dataset.n) === prefs.last));
      menu.querySelector('#am-stop-big').checked = prefs.stopBig;
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      place();
      (menu.querySelector('.last') || menu.querySelector('[data-n]')).focus({ preventScroll: true });
    }
    function close() {
      if (!menu || menu.hidden) return;
      menu.hidden = true;
      onPick = null;
      if (anchor) anchor.setAttribute('aria-expanded', 'false');
    }
    return {
      open, close, label,
      // o automático deve parar depois deste prêmio?
      stopsOn: (win, bet) => prefs.stopBig && win >= bet * BIG,
    };
  })();

  renderHeader();
  wallet.display();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderFooter);
  else renderFooter();

  const avatarImg = id => `<img src="avatars/${id.replace(/^av-/, '')}.webp" alt="" draggable="false">`;

  window.Casino = {
    avatarImg,
    auto, sfx,
    fmt, $, rnd, toast, confetti, wallet, logoSvg,
    SUITS, SUIT_ICONS, RED, FACE, rl, cardText, newDeck, shuffle, cardHtml, setCard, BACK_HTML,
    CHIP_VALUES, chipSvg, chipBreakdown, chipStack, chipColumns, showBanner,
  };
})();
