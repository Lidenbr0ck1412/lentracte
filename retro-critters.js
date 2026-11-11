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
      // Traînée et comète : dessinées dans un calque fixe de la taille de l'écran
      // (seule la partie visible est redessinée au scroll, très léger pour Safari).
      // Le petit SVG invisible sert uniquement à mesurer le tracé.
      '<canvas id="routeCanvas" aria-hidden="true"></canvas>' +
      '<svg id="routeGeom" width="0" height="0" aria-hidden="true"><path id="routePath"/></svg>' +
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
          ctx.globalAlpha = p.a; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2); ctx.fill();
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
      resize();
    })();

    // Trajectoire en pointillés entre les planètes, dessinée au fil du scroll
    var canvas = document.getElementById('routeCanvas'), cx = canvas.getContext('2d'),
        geom = document.getElementById('routePath');
    var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var route = null, routeLen = 0, samples = [], dpr = 1, cw = 0, ch = 0;

    function sizeCanvas() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      cw = innerWidth; ch = innerHeight;
      canvas.width = cw * dpr; canvas.height = ch * dpr;
      canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    }

    function drawRoute() {
      var ar = article.getBoundingClientRect();
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
      geom.setAttribute('d', d);
      route = new Path2D(d);
      routeLen = geom.getTotalLength();
      samples = []; var maxY = 0;
      for (var l = 0; l <= routeLen; l += 6) { maxY = Math.max(maxY, geom.getPointAtLength(l).y); samples.push({ l: l, y: maxY }); }
      paint();
    }

    function paint() {
      if (!route) return;
      var ar = article.getBoundingClientRect();
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, cw, ch);
      if (ar.bottom < -50 || ar.top > ch + 50) return; // article hors écran : rien à dessiner
      cx.translate(ar.left, ar.top);
      cx.lineWidth = 2; cx.lineCap = 'round'; cx.setLineDash([2, 10]);

      // tracé complet, très discret
      cx.strokeStyle = 'rgba(255,255,255,.13)';
      cx.stroke(route);

      // partie déjà parcourue
      var atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 8;
      var targetY = ch * .65 - ar.top;
      var drawn = 0, revealY = targetY;
      if (reduceMotion || atBottom) { drawn = routeLen; revealY = 1e7; }
      else for (var i = 0; i < samples.length; i++) { if (samples[i].y > targetY) break; drawn = samples[i].l; }
      if (revealY > 0) {
        cx.save();
        cx.beginPath(); cx.rect(-1e4, -1e4, 3e4, revealY + 1e4); cx.clip();
        cx.strokeStyle = 'rgba(255,255,255,.85)';
        cx.stroke(route);
        cx.restore();
      }

      // comète en tête du tracé (cachée au départ et une fois la dernière planète atteinte)
      var last = samples.length ? samples[samples.length - 1].l : routeLen;
      if (drawn > 1 && drawn < last - 1) {
        var pt = geom.getPointAtLength(drawn);
        var g = cx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 16);
        g.addColorStop(0, 'rgba(255,255,255,.9)');
        g.addColorStop(.35, 'rgba(232,37,58,.35)');
        g.addColorStop(1, 'rgba(232,37,58,0)');
        cx.setLineDash([]);
        cx.fillStyle = g; cx.beginPath(); cx.arc(pt.x, pt.y, 16, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2); cx.fill();
      }
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; paint(); });
    }
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', function () { sizeCanvas(); requestAnimationFrame(drawRoute); });
    new ResizeObserver(function () { requestAnimationFrame(drawRoute); }).observe(article);
    addEventListener('load', drawRoute);
    if (document.fonts) document.fonts.ready.then(drawRoute);
    sizeCanvas();
    drawRoute();
  }

  root.RetroLayouts = root.RetroLayouts || {};
  root.RetroLayouts.critters = { hero: hero, render: render, animate: animate };
})(typeof window !== 'undefined' ? window : globalThis);
