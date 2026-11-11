/* ═══════════════════════════════════════════════════════════
   retro-critters.js — mise en page de la rétrospective Critters

   Utilisé par :
   - retrospective.html (aperçu dynamique, côté navigateur)
   - generate-static-pages.js (page statique, côté Node)

   Expose : RetroLayouts.critters = { hero(retro), render(retro, sections), animate() }
   La bannière, la navigation, le partage et le pied de page sont ceux
   de retrospective.html (identiques aux autres rétrospectives).

   Repères acceptés dans les champs markdown (intro et contenu) :
     paragraphe normal, avec *italique* et **gras**
     !! phrase                        → phrase-clé en grand (intro)
     [frise]                          → frise chronologique (champ retros.frise)
     > phrase                         → citation en exergue
     ~ paragraphe                     → transition vers l'escale suivante
     [large] chemin | légende         → photo panoramique
     [photo] chemin | légende         → photo classique
     [vignette droite] chemin | légende   (ou gauche) → photo contournée par le texte
     [duo] chemin | légende ; chemin | légende
     [trio] chemin | légende ; chemin | légende ; chemin | légende
═══════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ── Utilitaires ── */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function inline(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }
  function imgSrc(src) {
    src = (src || '').trim();
    if (!src || /^https?:\/\//.test(src) || src.startsWith('/')) return src;
    return '/' + src; // fonctionne depuis la racine comme depuis /slug-retrospective/
  }
  function parsePhotos(spec) {
    return spec.split(';').map(function (part) {
      var bits = part.split('|');
      return { src: (bits[0] || '').trim(), caption: (bits[1] || '').trim() };
    }).filter(function (p) { return p.src; });
  }

  var TILTS = ['tilt-l', 'tilt-r'];
  var photoCount = 0;
  function figure(p, cls) {
    var tilt = cls === undefined ? TILTS[photoCount++ % 2] : cls;
    var src = imgSrc(p.src);
    return '<figure class="' + ('shot ' + (tilt || '')).trim() + '">' +
      '<div class="frame" data-file="' + esc(p.src) + '"><img src="' + esc(src) + '" alt="' + esc(p.caption || 'Illustration') + '" loading="lazy"></div>' +
      (p.caption ? '<figcaption>' + inline(p.caption) + '</figcaption>' : '') +
      '</figure>';
  }

  function renderFrise(frise) {
    if (!Array.isArray(frise) || !frise.length) return '';
    return '<ol class="voyage" aria-label="Les escales de la saga">' + frise.map(function (f) {
      return '<li><b>' + esc(f.annee) + '</b><span>' + esc(f.titre) + '</span><i>' + esc(f.lieu) + '</i></li>';
    }).join('') + '</ol>';
  }

  /* ── Bloc markdown → HTML ── */
  function renderBlocks(md, opts) {
    opts = opts || {};
    var blocks = String(md || '').replace(/\r/g, '').split(/\n\s*\n/).map(function (b) { return b.trim(); }).filter(Boolean);
    var first = true;
    return blocks.map(function (b) {
      var m;
      if (b === '[frise]') return renderFrise(opts.frise);
      if ((m = b.match(/^!!\s*([\s\S]+)/))) return '<p class="statement">' + inline(m[1]) + '</p>';
      if ((m = b.match(/^>\s*([\s\S]+)/))) return '<blockquote class="pull">' + inline(m[1]) + '</blockquote>';
      if ((m = b.match(/^~\s*([\s\S]+)/))) return '<p class="transition">' + inline(m[1]) + '</p>';
      if ((m = b.match(/^\[large\]\s*([\s\S]+)/i))) return figure(parsePhotos(m[1])[0], 'wide');
      if ((m = b.match(/^\[photo\]\s*([\s\S]+)/i))) return figure(parsePhotos(m[1])[0]);
      if ((m = b.match(/^\[vignette(?:\s+(droite|gauche))?\]\s*([\s\S]+)/i))) {
        var side = (m[1] || 'droite').toLowerCase() === 'gauche' ? 'l' : 'r';
        return figure(parsePhotos(m[2])[0], 'side ' + side);
      }
      if ((m = b.match(/^\[(duo|trio)\]\s*([\s\S]+)/i))) {
        var kind = m[1].toLowerCase();
        var photos = parsePhotos(m[2]);
        return '<div class="photo-' + kind + '">' + photos.map(function (p, i) {
          return figure(p, kind === 'duo' ? TILTS[i % 2] : '');
        }).join('') + '</div>';
      }
      var html = inline(b.replace(/\n/g, ' '));
      if (opts.lead && first) { first = false; return '<p class="lead">' + html + '</p>'; }
      first = false;
      return '<p>' + html + '</p>';
    }).join('\n');
  }

  /* ── Bannière : contenu des emplacements communs à toutes les rétros ── */
  function hero(retro) {
    return {
      img: retro.banner ? imgSrc(retro.banner) : '',
      alt: retro.title || '',
      title: esc(String(retro.title || '').toUpperCase()).replace(/,\s*/, ',<br>'),
      subtitle: retro.subtitle ? inline(retro.subtitle) : ''
    };
  }

  /* ── Rendu de l'article ── */
  function render(retro, sections) {
    photoCount = 0;
    sections = (sections || []).slice().sort(function (a, b) { return Number(a.ordre) - Number(b.ordre); });

    var toc = '<div class="toc" role="navigation" aria-label="Escales">' +
      sections.map(function (s, i) { return '<a href="#escale-' + (i + 1) + '"><b>' + (i + 1) + '</b>' + esc(s.titre) + '</a>'; }).join('') +
      (retro.verdict ? '<a href="#verdict"><b>✦</b>Le verdict</a>' : '') + '</div>';

    var intro = '<div class="intro">' + renderBlocks(retro.intro, { lead: true, frise: retro.frise }) + toc + '</div>';

    var stops = sections.map(function (s, i) {
      var side = i % 2 === 0 ? 'left' : 'right';
      var color = s.couleur || '#3a3a3a';
      return '<section class="stop ' + side + '" id="escale-' + (i + 1) + '">' +
        '<div class="stop-head"><div class="marker" style="--c1:' + esc(color) + ';--c2:#0c0c0c"></div>' +
        '<div class="stop-eyebrow">Escale ' + String(i + 1).padStart(2, '0') + '</div></div>' +
        '<h2>' + esc(s.titre) + '</h2>' +
        (s.meta ? '<div class="meta">' + esc(s.meta) + '</div>' : '') +
        renderBlocks(s.contenu) +
        '</section>';
    }).join('\n');

    var verdict = retro.verdict
      ? '<section class="stop ' + (sections.length % 2 === 0 ? 'left' : 'right') + '" id="verdict">' +
        '<div class="stop-head"><div class="marker" style="--c1:#E8253A;--c2:#2a0508"></div><div class="stop-eyebrow">Arrivée</div></div>' +
        '<h2>Le verdict</h2><div class="verdict-box">' + renderBlocks(retro.verdict) + '</div></section>'
      : '';

    return '<canvas id="starfield"></canvas>' +
      '<main class="article" id="article">' +
      '<svg id="route" aria-hidden="true"><defs><mask id="routeMask" maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="20000" height="200000">' +
      '<path id="routeReveal" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/></mask>' +
      '<radialGradient id="cometGlow"><stop offset="0" stop-color="#fff" stop-opacity=".9"/>' +
      '<stop offset=".35" stop-color="#E8253A" stop-opacity=".35"/><stop offset="1" stop-color="#E8253A" stop-opacity="0"/></radialGradient></defs>' +
      '<path class="trail-ghost" id="routeGhost"/><path class="trail" id="routePath" mask="url(#routeMask)"/>' +
      '<g id="comet" class="comet" style="opacity:0"><circle r="16" fill="url(#cometGlow)"/><circle r="3.5" fill="#fff"/></g></svg>' +
      intro + stops + verdict + '</main>';
  }

  /* ── Animations (navigateur uniquement) ── */
  function animate() {
    if (typeof document === 'undefined') return;
    var article = document.getElementById('article');
    if (!article) return;

    // Photo manquante → cadre de réservation avec le nom du fichier attendu
    document.querySelectorAll('.shot img').forEach(function (img) {
      var mark = function () { img.closest('.shot').classList.add('missing'); };
      if (img.complete && img.naturalWidth === 0) mark();
      img.addEventListener('error', function () { mark(); drawRoute(); });
      img.addEventListener('load', function () { img.closest('.shot').classList.remove('missing'); drawRoute(); });
    });

    // Ciel étoilé discret
    (function stars() {
      var c = document.getElementById('starfield');
      if (!c) return;
      var ctx = c.getContext('2d'), pts = [], W = 0, H = 0;
      function paint() {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        pts.forEach(function (p) {
          var y = (p.y * H - scrollY * p.d) % H; if (y < 0) y += H;
          ctx.globalAlpha = p.a; ctx.beginPath(); ctx.arc(p.x * W, y, p.r, 0, Math.PI * 2); ctx.fill();
        });
      }
      function resize() {
        var newW = innerWidth;
        // Hauteur de la toile : on prend la plus grande hauteur possible de l'écran pour que
        // l'apparition/disparition de la barre d'adresse sur mobile ne crée ni trou ni saut.
        var newH = Math.max(innerHeight, (screen && screen.height) || 0);
        if (newW === W && Math.abs(newH - H) < 2) return;
        var regenerate = newW !== W;
        W = newW; H = newH;
        var dpr = Math.min(devicePixelRatio || 1, 2);
        c.width = W * dpr; c.height = H * dpr;
        c.style.width = W + 'px'; c.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (regenerate) {
          pts = Array.from({ length: Math.round(W * H / 9000) }, function () {
            return { x: Math.random(), y: Math.random(),
              r: Math.random() < .93 ? Math.random() * .8 + .2 : Math.random() * 1.2 + .7,
              a: Math.random() * .45 + .15, d: Math.random() * .15 + .03 };
          });
        }
        paint();
      }
      addEventListener('resize', resize);
      root.__retroPaintStars = paint;
      resize();
    })();

    // Trajectoire en pointillés entre les planètes, dessinée au fil du scroll
    var svg = document.getElementById('route'), path = document.getElementById('routePath'),
        ghost = document.getElementById('routeGhost'), reveal = document.getElementById('routeReveal'),
        comet = document.getElementById('comet');
    var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var routeLen = 0, samples = [];

    function drawRoute() {
      var ar = article.getBoundingClientRect();
      svg.setAttribute('viewBox', '0 0 ' + ar.width + ' ' + ar.height);
      var narrow = innerWidth <= 900;
      var stops = Array.prototype.map.call(article.querySelectorAll('.stop'), function (s) {
        var m = s.querySelector('.marker').getBoundingClientRect(), r = s.getBoundingClientRect();
        return { x: m.left + m.width / 2 - ar.left, y: m.top + m.height / 2 - ar.top, r: m.width / 2,
          left: r.left - ar.left, right: r.right - ar.left, bottom: r.bottom - ar.top,
          side: s.classList.contains('right') ? 'right' : 'left' };
      });
      if (stops.length < 2) return;
      var d = 'M ' + stops[0].x + ' ' + stops[0].y;
      stops.forEach(function (a, i) {
        var b = stops[i + 1];
        if (!b) return;
        var gap = b.y - a.bottom;
        if (narrow) {
          var w = 9;
          d += ' L ' + a.x + ' ' + (a.y + a.r) + ' C ' + (a.x - w) + ' ' + ((a.y + b.y) * .5 - 80) + ', ' + (a.x + w) + ' ' + ((a.y + b.y) * .5 + 80) + ', ' + b.x + ' ' + (b.y - b.r) + ' L ' + b.x + ' ' + b.y;
          return;
        }
        var out = a.side === 'left' ? a.left - 50 : a.right + 50;
        var dir = out < a.x ? -1 : 1;
        d += ' L ' + (a.x + dir * (a.r + 6)) + ' ' + a.y;
        d += ' C ' + out + ' ' + a.y + ', ' + out + ' ' + a.y + ', ' + out + ' ' + (a.y + 60);
        d += ' L ' + out + ' ' + (a.bottom - 20);
        d += ' C ' + out + ' ' + (a.bottom + gap * .55) + ', ' + b.x + ' ' + (b.y - gap * .55) + ', ' + b.x + ' ' + (b.y - b.r - 6) + ' L ' + b.x + ' ' + b.y;
      });
      path.setAttribute('d', d); ghost.setAttribute('d', d); reveal.setAttribute('d', d);
      routeLen = path.getTotalLength();
      reveal.style.strokeDasharray = routeLen;
      samples = []; var maxY = 0;
      for (var l = 0; l <= routeLen; l += 6) { maxY = Math.max(maxY, path.getPointAtLength(l).y); samples.push({ l: l, y: maxY }); }
      updateRoute();
    }

    function updateRoute() {
      if (!routeLen) return;
      var ar = article.getBoundingClientRect();
      var atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 8;
      var targetY = innerHeight * .65 - ar.top;
      var drawn = 0;
      if (reduceMotion || atBottom) drawn = routeLen;
      else for (var i = 0; i < samples.length; i++) { if (samples[i].y > targetY) break; drawn = samples[i].l; }
      reveal.style.strokeDashoffset = routeLen - drawn;
      var pt = path.getPointAtLength(Math.max(drawn, .1));
      comet.setAttribute('transform', 'translate(' + pt.x + ' ' + pt.y + ')');
      var last = samples.length ? samples[samples.length - 1].l : routeLen;
      comet.style.opacity = drawn > 1 && drawn < last - 1 ? 1 : 0;
    }

    var ticking = false;
    addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        if (root.__retroPaintStars) root.__retroPaintStars();
        updateRoute();
      });
    }, { passive: true });
    new ResizeObserver(function () { requestAnimationFrame(drawRoute); }).observe(article);
    addEventListener('load', drawRoute);
    if (document.fonts) document.fonts.ready.then(drawRoute);
    drawRoute();
  }

  root.RetroLayouts = root.RetroLayouts || {};
  root.RetroLayouts.critters = { hero: hero, render: render, animate: animate };
})(typeof window !== 'undefined' ? window : globalThis);
