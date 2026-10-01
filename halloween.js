/* ─────────────────────────────────────────────
   L'ENTRACTE — MODE HALLOWEEN 🎃
   Clins d'œil horreur, actifs automatiquement en octobre.

   1. Toiles d'araignée dans les coins du menu
   2. Une petite araignée qui traverse l'écran de temps en temps
   3. Le coup de fil : « Quel est ton film d'horreur préféré ? »
   4. REDRUM : tape « Shining » dans la recherche…

   Pour tester hors octobre : ajoute #halloween à la fin de l'adresse.
───────────────────────────────────────────── */
(function () {
  const CONFIG = {
    moisActif: 9,                   // 9 = octobre (janvier = 0)
    redrumToutLAnnee: true,         // l'easter egg « Shining » reste actif après octobre
    delaiAppelSecondes: 20,         // temps avant le premier coup de fil
    rappelAppelSecondes: 80,        // délai minimum avant que le téléphone resonne à nouveau
    delaiAraigneeSecondes: [35, 70],// intervalle (min, max) entre deux passages d'araignée
  };

  const now = new Date();
  const forced = location.hash === '#halloween';
  const isOctober = now.getMonth() === CONFIG.moisActif || forced;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RED = '#E8253A';

  const css = `
  /* ── 1. Toiles d'araignée ── */
  .hw-web { position: fixed; top: -4px; z-index: 101; width: 68px; height: 68px; pointer-events: none; opacity: .85; }
  .hw-web.left { left: -4px; }
  .hw-web.right { right: -4px; transform: scaleX(-1); }
  .hw-web svg { width: 100%; height: 100%; display: block; }

  /* ── 2. L'araignée qui traverse l'écran ── */
  .hw-spider { position: fixed; left: 0; top: 0; z-index: 97; width: 38px; height: 26px; pointer-events: none; will-change: transform; }
  .hw-spider svg { width: 100%; height: 100%; display: block; filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); }
  .hw-spider .legs { transform-origin: 32px 22px; animation: hwLegs .16s ease-in-out infinite; }
  @keyframes hwLegs { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(4deg); } }

  /* ── 3. Le coup de fil ── */
  .hw-call { position: fixed; right: 24px; bottom: 24px; z-index: 9000; width: 340px; max-width: calc(100vw - 32px);
    background: linear-gradient(160deg, #1b1b1b, #0d0d0d); border: 1px solid rgba(255,255,255,.08);
    border-left: 3px solid ${RED}; border-radius: 16px; padding: 18px 18px 16px;
    box-shadow: 0 24px 60px rgba(0,0,0,.65), 0 0 40px rgba(232,37,58,.12);
    font-family: 'Montserrat', sans-serif; color: #fff;
    transform: translateY(140%); opacity: 0; transition: transform .6s cubic-bezier(.2,.9,.3,1.2), opacity .4s; }
  .hw-call.show { transform: none; opacity: 1; }
  .hw-call-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .hw-call-icon { width: 42px; height: 42px; border-radius: 50%; background: ${RED}; display: flex; align-items: center;
    justify-content: center; flex-shrink: 0; box-shadow: 0 0 0 0 rgba(232,37,58,.6); animation: hwPulse 1.4s infinite; }
  .hw-call-icon svg { width: 20px; height: 20px; fill: #fff; animation: hwRing 1.4s infinite; }
  @keyframes hwPulse { 0% { box-shadow: 0 0 0 0 rgba(232,37,58,.55); } 70% { box-shadow: 0 0 0 14px rgba(232,37,58,0); } 100% { box-shadow: 0 0 0 0 rgba(232,37,58,0); } }
  @keyframes hwRing { 0%, 50%, 100% { transform: rotate(0); } 5%, 15%, 25% { transform: rotate(-16deg); } 10%, 20%, 30% { transform: rotate(16deg); } }
  .hw-call-label { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 3px; color: ${RED}; line-height: 1.2; }
  .hw-call-who { font-size: 12px; color: rgba(255,255,255,.5); margin-top: 2px; }
  .hw-call-quote { font-family: 'Montserrat', sans-serif; font-weight: 600; font-size: 16px; line-height: 1.45; margin: 0 0 14px; }
  .hw-call-actions { display: flex; gap: 8px; }
  .hw-call-actions button { flex: 1; border: none; border-radius: 50px; padding: 11px 10px; cursor: pointer;
    font-family: 'Montserrat', sans-serif; font-size: 11.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;
    transition: transform .2s, background .2s; }
  .hw-call-actions button:hover { transform: scale(1.04); }
  .hw-answer { background: ${RED}; color: #fff; }
  .hw-hangup { background: rgba(255,255,255,.08); color: rgba(255,255,255,.75); }
  @media (max-width: 600px) { .hw-call { right: 16px; left: 16px; bottom: 16px; width: auto; } }

  /* ── 4. REDRUM ── */
  .hw-redrum { position: fixed; inset: 0; z-index: 99999; background: #050505; display: flex; align-items: center;
    justify-content: center; flex-direction: column; opacity: 0; transition: opacity .35s; perspective: 1200px; cursor: pointer; }
  .hw-redrum.show { opacity: 1; }
  .hw-redrum.flicker { animation: hwFlicker .25s steps(2) 3; }
  @keyframes hwFlicker { 50% { background: #1a0306; } }
  .hw-card { position: relative; transform-style: preserve-3d; transition: transform 1.1s cubic-bezier(.6,0,.3,1); }
  .hw-card.flip { transform: rotateY(180deg); }
  .hw-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; display: flex; gap: .04em;
    font-family: 'Bebas Neue', Impact, sans-serif; font-size: clamp(64px, 17vw, 230px); line-height: 1; color: ${RED};
    text-shadow: 0 0 30px rgba(232,37,58,.35); }
  .hw-face.back { position: absolute; inset: 0; transform: rotateY(180deg); justify-content: center; }
  .hw-face span { display: inline-block; opacity: 0; transform: rotate(var(--r)) translateY(var(--y)); position: relative; }
  .hw-face span::after { content: ''; position: absolute; left: var(--dx); top: 88%; width: .045em; height: var(--dl);
    background: ${RED}; border-radius: 0 0 999px 999px; }
  .hw-face.front span.in { animation: hwWrite .22s ease-out forwards; }
  .hw-face.back span { opacity: 1; }
  @keyframes hwWrite { from { opacity: 0; clip-path: inset(0 100% 0 0); } to { opacity: 1; clip-path: inset(0 0 0 0); } }
  .hw-redrum-sub { margin-top: 40px; font-family: 'Bebas Neue', sans-serif; letter-spacing: 6px; font-size: 14px;
    color: rgba(255,255,255,.35); opacity: 0; transition: opacity .6s; }
  .hw-redrum-sub.show { opacity: 1; }
  `;

  function injectCSS() {
    if (document.getElementById('hw-css')) return;
    const s = document.createElement('style');
    s.id = 'hw-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ── 1. Toiles d'araignée dans les coins ── */
  function cobwebs() {
    const svg = `<svg viewBox="0 0 68 68" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="rgba(225,225,232,.32)" stroke-width="1">
        <path d="M0 0 L68 0"/><path d="M0 0 L0 68"/>
        <path d="M0 0 L68 34"/><path d="M0 0 L34 68"/>
        <path d="M0 0 L68 14"/><path d="M0 0 L14 68"/>
        <path d="M0 0 L68 54"/><path d="M0 0 L54 68"/>
        <path d="M6 1 Q9 9 1 6"/>
        <path d="M15 2 Q22 22 2 15"/>
        <path d="M27 4 Q40 40 4 27"/>
        <path d="M42 6 Q60 60 6 42"/>
      </g>
    </svg>`;
    ['left', 'right'].forEach(side => {
      const el = document.createElement('div');
      el.className = 'hw-web ' + side;
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = svg;
      document.body.appendChild(el);
    });
  }

  /* ── 2. L'araignée qui traverse l'écran ── */
  function spiderCrossing() {
    const SPIDER_SVG = `<svg viewBox="0 0 64 44" xmlns="http://www.w3.org/2000/svg">
      <g stroke="#161616" stroke-width="2.2" fill="#161616" stroke-linecap="round">
        <ellipse cx="38" cy="22" rx="10" ry="8"/>
        <circle cx="24" cy="20" r="6"/>
        <g class="legs" fill="none" stroke-width="2">
          <path d="M30 16 Q18 10 6 12"/><path d="M31 20 Q17 18 4 22"/>
          <path d="M31 24 Q18 26 6 32"/><path d="M33 27 Q22 34 12 40"/>
          <path d="M44 16 Q54 8 62 10"/><path d="M46 19 Q58 15 64 18"/>
          <path d="M46 25 Q58 28 63 34"/><path d="M43 28 Q52 36 58 42"/>
        </g>
      </g>
    </svg>`;

    function spawn() {
      const nav = document.getElementById('navbar') || document.querySelector('nav');
      const navH = nav ? nav.getBoundingClientRect().height : 100;
      const vh = window.innerHeight, vw = window.innerWidth;
      const y = navH + 24 + Math.random() * Math.max(60, vh - navH - 140);
      const leftToRight = Math.random() < 0.5;
      const startX = leftToRight ? -50 : vw + 50;
      const endX = leftToRight ? vw + 50 : -50;

      const el = document.createElement('div');
      el.className = 'hw-spider';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = SPIDER_SVG;
      el.style.top = y + 'px';
      const facing = leftToRight ? 1 : -1;
      el.style.transform = `translate(${startX}px, 0) scaleX(${facing})`;
      document.body.appendChild(el);

      if (reduce) { setTimeout(() => el.remove(), 1200); return; }

      const duration = 5000 + Math.random() * 3000;
      const t0 = performance.now();
      function frame(t) {
        const p = Math.min(1, (t - t0) / duration);
        const x = startX + (endX - startX) * p;
        const bob = Math.sin(p * Math.PI * 8) * 6;
        el.style.transform = `translate(${x}px, ${bob}px) scaleX(${facing})`;
        if (p < 1) requestAnimationFrame(frame);
        else el.remove();
      }
      requestAnimationFrame(frame);
    }

    function scheduleNext() {
      const [min, max] = CONFIG.delaiAraigneeSecondes;
      const delay = (forced ? 6 : min + Math.random() * (max - min)) * 1000;
      setTimeout(() => { spawn(); scheduleNext(); }, delay);
    }
    scheduleNext();
  }

  /* ── 3. Le coup de fil ── */
  function phoneCall() {
    function lastShown() {
      try { return parseInt(sessionStorage.getItem('hw-call-last') || '0', 10); } catch (e) { return 0; }
    }
    function markShown() {
      try { sessionStorage.setItem('hw-call-last', String(Date.now())); } catch (e) {}
    }
    function scheduleNext() {
      const last = lastShown();
      const rappelMs = (forced ? 15 : CONFIG.rappelAppelSecondes) * 1000;
      const premierMs = (forced ? 4 : CONFIG.delaiAppelSecondes) * 1000;
      const wait = last ? Math.max(1000, rappelMs - (Date.now() - last)) : premierMs;
      setTimeout(showCall, wait);
    }

    function showCall() {
      markShown();
      const isHome = /\/(index\.html)?$/.test(location.pathname);
      const box = document.createElement('div');
      box.className = 'hw-call';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'Appel entrant');
      box.innerHTML = `
        <div class="hw-call-top">
          <div class="hw-call-icon"><svg viewBox="0 0 24 24"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24 11.36 11.36 0 0 0 3.58.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/></svg></div>
          <div><div class="hw-call-label">APPEL ENTRANT…</div><div class="hw-call-who">Numéro masqué</div></div>
        </div>
        <p class="hw-call-quote">« Quel est ton film d'horreur préféré&nbsp;? »</p>
        <div class="hw-call-actions">
          <button class="hw-answer" type="button">Décrocher</button>
          <button class="hw-hangup" type="button">Raccrocher</button>
        </div>`;
      document.body.appendChild(box);
      requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('show')));

      const close = () => { box.classList.remove('show'); setTimeout(() => box.remove(), 600); scheduleNext(); };
      const autoClose = setTimeout(close, 25000);
      box.querySelector('.hw-hangup').onclick = () => { clearTimeout(autoClose); close(); };
      box.querySelector('.hw-answer').onclick = () => {
        clearTimeout(autoClose);
        try { sessionStorage.setItem('hw-answered', '1'); } catch (e) {}
        try { window.umami && umami.track('halloween-appel-decroche'); } catch (e) {}
        box.classList.remove('show');
        setTimeout(() => box.remove(), 600);
        scheduleNext();
        if (isHome && document.getElementById('contact')) { answerOnContact(); }
        else location.href = '/index.html#contact';
      };
    }

    scheduleNext();
  }

  // Arrivée sur le formulaire de contact après avoir « décroché »
  function answerOnContact() {
    let answered = false;
    try { answered = sessionStorage.getItem('hw-answered') === '1'; sessionStorage.removeItem('hw-answered'); } catch (e) {}
    const section = document.getElementById('contact');
    const film = document.getElementById('contactFilm');
    if (!answered || !section || !film) return;
    section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    film.placeholder = 'Ton film d\'horreur préféré…';
    setTimeout(() => film.focus({ preventScroll: true }), 700);
  }

  /* ── 4. REDRUM ── */
  let redrumBusy = false;
  function letters(word, front) {
    return [...word].map((c, i) => {
      const r = (Math.sin(i * 12.9 + word.length) * 4).toFixed(1);
      const y = (Math.cos(i * 7.3) * 6).toFixed(0);
      const dl = (0.12 + Math.abs(Math.sin(i * 3.1)) * 0.28).toFixed(2);
      const dx = (25 + Math.abs(Math.cos(i * 5.7)) * 50).toFixed(0);
      return `<span style="--r:${r}deg;--y:${y}px;--dl:${dl}em;--dx:${dx}%">${c}</span>`;
    }).join('');
  }
  function redrum() {
    if (redrumBusy) return;
    redrumBusy = true;
    const ov = document.createElement('div');
    ov.className = 'hw-redrum';
    ov.setAttribute('aria-label', 'REDRUM');
    ov.innerHTML = `<div class="hw-card"><div class="hw-face front">${letters('REDRUM')}</div>` +
      `<div class="hw-face back">${letters('MURDER')}</div></div>` +
      `<div class="hw-redrum-sub">REDRUM • REDRUM • REDRUM</div>`;
    document.body.appendChild(ov);
    const card = ov.querySelector('.hw-card');
    const spans = ov.querySelectorAll('.front span');
    const sub = ov.querySelector('.hw-redrum-sub');
    let ended = false;
    const end = () => {
      if (ended) return; ended = true;
      ov.classList.remove('show');
      setTimeout(() => { ov.remove(); redrumBusy = false; }, 400);
    };
    ov.addEventListener('click', end);
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { end(); document.removeEventListener('keydown', esc); } });
    try { window.umami && umami.track('halloween-redrum'); } catch (e) {}

    requestAnimationFrame(() => ov.classList.add('show'));
    if (reduce) {
      card.classList.add('flip');
      card.style.transition = 'none';
      sub.classList.add('show');
      setTimeout(end, 2600);
      return;
    }
    spans.forEach((s, i) => setTimeout(() => s.classList.add('in'), 350 + i * 190));
    const written = 350 + spans.length * 190;
    setTimeout(() => sub.classList.add('show'), written + 200);
    setTimeout(() => { ov.classList.add('flicker'); }, written + 900);
    setTimeout(() => { card.classList.add('flip'); }, written + 1200);
    setTimeout(end, written + 4200);
  }
  function hookSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    let t = null;
    const check = () => { if (/shining/i.test(input.value)) redrum(); };
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(check, 450); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(t); check(); } });
  }

  function start() {
    const halloween = isOctober;
    if (!halloween && !CONFIG.redrumToutLAnnee) return;
    injectCSS();
    hookSearch();
    if (!halloween) return;
    cobwebs();
    spiderCrossing();
    phoneCall();
    answerOnContact();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
