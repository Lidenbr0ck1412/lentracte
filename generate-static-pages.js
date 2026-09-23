/**
 * generate-static-pages.js
 *
 * Génère un fichier HTML statique par review (et met à jour sitemap.xml)
 * à partir des données publiées dans Supabase.
 *
 * Résultat : reviews/<slug>/index.html pour chaque film publié.
 *
 * Usage :
 *   node generate-static-pages.js
 *
 * Prérequis : Node.js 18+ (pour fetch natif). Aucune dépendance npm nécessaire.
 */

import fs from 'fs';
import path from 'path';

/* ─────────────────────────────────────────────
   CONFIG — à adapter si besoin
───────────────────────────────────────────── */
const SUPABASE_URL = 'https://jnlfejbcpudkmcphsfej.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpubGZlamJjcHVka21jcGhzZmVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTg4NTYsImV4cCI6MjA4OTA3NDg1Nn0.m7xChZb5vc8Ho-LSgu1LY-edxiDC40A_b4DiX9kQWS4';
const SITE_URL = 'https://l-entracte.be'; // <-- vérifie que c'est bien ton domaine final
const URL_SUFFIX = '-critique'; // ajouté après le slug : "together" -> "together-critique"
const CCF_URL_SUFFIX = '-comment-c-est-fait'; // ajouté après le slug d'un article CCF

// Construit le nom de dossier final pour un film donné
function pageDirName(slug) {
  return slug.endsWith(URL_SUFFIX) ? slug : `${slug}${URL_SUFFIX}`;
}

// Idem pour un article "Comment c'est fait ?"
function pageDirNameCcf(slug) {
  return slug.endsWith(CCF_URL_SUFFIX) ? slug : `${slug}${CCF_URL_SUFFIX}`;
}

/* ─────────────────────────────────────────────
   FONCTIONS DE RENDU
   (portées telles quelles depuis review.html —
   ce sont des fonctions pures qui construisent
   du texte, donc elles tournent aussi bien
   côté serveur/Node que côté navigateur)
───────────────────────────────────────────── */

function parseMarkdown(md) {
  if (!md) return '';
  const lines = md.split('\n');
  const blocks = [];
  let currentParagraph = [];
  let isFirst = true;

  function inlineMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  function flushParagraph() {
    if (currentParagraph.length === 0) return;
    const text = currentParagraph.join(' ').trim();
    if (!text) { currentParagraph = []; return; }
    const html = inlineMarkdown(text);
    if (isFirst) {
      const cleaned = html.replace(/^\*(.+)\*$/, '$1');
      blocks.push(`<p class="article-intro reveal">${cleaned}</p>`);
      isFirst = false;
    } else {
      if (/^\*[^*].+[^*]\*$/.test(text)) {
        const quoteText = inlineMarkdown(text.replace(/^\*(.+)\*$/, '$1'));
        blocks.push(`<div class="pull-quote reveal"><p>${quoteText}</p><cite>L'Entracte</cite></div>`);
      } else {
        blocks.push(`<p class="reveal">${html}</p>`);
      }
    }
    currentParagraph = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') { flushParagraph(); continue; }

    if (/^#{1,3} /.test(line)) {
      flushParagraph();
      isFirst = false;
      let title = line.replace(/^#{1,3} /, '').trim();
      title = title.replace(/^\*\*(.+)\*\*$/, '$1');
      blocks.push(`<div class="section-title reveal">${title}</div>`);
      continue;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      isFirst = false;
      let quoteLines = [line.replace('> ', '')];
      while (i + 1 < lines.length && lines[i + 1].startsWith('> ')) {
        i++;
        quoteLines.push(lines[i].replace('> ', ''));
      }
      const quoteText = inlineMarkdown(quoteLines.join(' '));
      blocks.push(`<div class="pull-quote reveal"><p>${quoteText}</p><cite>L'Entracte</cite></div>`);
      continue;
    }

    const imgMatch = line.trim().match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      flushParagraph();
      isFirst = false;
      const imgs = [imgMatch];
      while (i + 1 < lines.length && /^!\[(.*?)\]\((.*?)\)$/.test(lines[i + 1].trim())) {
        i++;
        imgs.push(lines[i].trim().match(/^!\[(.*?)\]\((.*?)\)$/));
      }
      function parseImg(m) {
        const rawLabel = m[1].trim();
        const src = m[2].trim();
        const parts = rawLabel.split('|');
        const caption = parts[0].trim();
        let position = '', wide = false, stack = false;
        parts.slice(1).forEach(p => {
          const mod = p.trim();
          if (mod === 'large' || mod === 'full') wide = true;
          else if (mod === 'stack') stack = true;
          else if (/^\d+%?$/.test(mod)) position = `center ${mod.replace('%', '')}%`;
        });
        return { caption, src, position, wide, stack };
      }
      if (imgs.length === 1) {
        const { caption, src, position, wide } = parseImg(imgs[0]);
        blocks.push(`<figure class="article-image reveal${wide ? ' wide' : ''}"><img src="${resolveImgPath(src)}" alt="${caption || 'Image'}" loading="lazy"${position ? ` style="object-position:${position}"` : ''}>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`);
      } else {
        const parsed = imgs.map(parseImg);
        const useStack = parsed.some(p => p.stack);
        const figs = parsed.map(({ caption, src, position }) => `<figure><img src="${resolveImgPath(src)}" alt="${caption || 'Image'}" loading="lazy"${position ? ` style="object-position:${position}"` : ''}>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`).join('');
        const colCount = imgs.length === 4 ? 2 : Math.min(imgs.length, 3);
        const galleryClass = useStack ? (imgs.length >= 4 ? 'stack stack-cols-2' : 'stack') : `cols-${colCount}`;
        blocks.push(`<div class="article-gallery reveal ${galleryClass}">${figs}</div>`);
      }
      continue;
    }

    if (/^[\u{1F300}-\u{1FAFF}✨💡🎬🎥📽🎞🔍⚡🏆💬🎭🎦]/u.test(line.trim())) {
      flushParagraph();
      isFirst = false;
      const emoji = [...line.trim()][0];
      let label = line.trim().slice([...line.trim()][0].length).trim();
      let contentLines = [];
      while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !/^#{1,3} /.test(lines[i + 1]) && !lines[i + 1].startsWith('> ')) {
        i++;
        contentLines.push(lines[i]);
      }
      const contentText = inlineMarkdown(contentLines.join(' '));
      blocks.push(`<div class="anecdote-card reveal"><div class="anecdote-icon">${emoji}</div>${label ? `<div class="anecdote-label">${label}</div>` : ''}<p class="anecdote-text">${contentText}</p></div>`);
      continue;
    }

    currentParagraph.push(line);
  }
  flushParagraph();

  let inBody = false, result = '';
  for (const block of blocks) {
    const isIntro = block.includes('article-intro');
    if (!inBody && !isIntro) { result += '<div class="article-body">'; inBody = true; }
    result += block;
  }
  if (inBody) result += '</div>';
  return result;
}

function buildStars(note) {
  let html = '';
  const starIcon = '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';
  for (let i = 1; i <= 5; i++) {
    let state = 'empty';
    if (i <= Math.floor(note)) state = 'filled';
    else if (i === Math.ceil(note) && note % 1 !== 0) state = 'half';
    if (state === 'half') {
      html += `<div class="star-wrap"><div class="star half"><svg viewBox="0 0 24 24"><defs><linearGradient id="halfStarGrad-${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="50%" style="stop-color:var(--red)"/><stop offset="50%" style="stop-color:#2a2a2a"/></linearGradient></defs><path fill="url(#halfStarGrad-${i})" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div><span class="star-number">${i}</span></div>`;
    } else {
      html += `<div class="star-wrap"><div class="star ${state}"><svg viewBox="0 0 24 24">${starIcon}</svg></div><span class="star-number">${i}</span></div>`;
    }
  }
  return html;
}

function renderHero(r) {
  const banner = resolveImgPath(r.banner || (r.img ? r.img : ''));
  const poster = resolveImgPath(r.img || '');
  return `<section class="hero"><div class="hero-bg">${banner ? `<img src="${banner}" alt="${r.title}">` : `<div style="width:100%;height:100%;background:linear-gradient(135deg,${r.color || '#1a0505'},${r.color2 || '#3a1010'})"></div>`}</div>${poster ? `<div class="hero-poster-zone"><img src="${poster}" alt="${r.title} poster"></div>` : ''}<div class="hero-content"><div class="hero-category"><span class="dot"></span>CRITIQUE</div><h1 class="hero-title">${r.title}<span class="year">${r.year || ''}</span></h1>${r.sub ? `<p class="hero-tagline">${r.sub}</p>` : ''}<div class="hero-meta">${r.realisateur ? `<div class="meta-item"><span class="meta-label">Réalisateur</span><span class="meta-value">${r.realisateur}</span></div>` : ''}${r.genre ? `<div class="meta-item"><span class="meta-label">Genre</span><span class="meta-value">${r.genre}</span></div>` : ''}${r.duree ? `<div class="meta-item"><span class="meta-label">Durée</span><span class="meta-value">${r.duree}</span></div>` : ''}${r.badge ? `<div class="meta-item"><span class="meta-label">Plateforme</span><span class="meta-value">${r.badge}</span></div>` : ''}</div></div><div class="hero-scroll" onclick="document.getElementById('article-container').scrollIntoView({behavior:'smooth'})"><span>LIRE</span><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg></div></section>`;
}

function renderStills(stills) {
  if (!stills) return '';
  const imgs = stills.split(',').map(s => s.trim()).filter(Boolean);
  if (!imgs.length) return '';
  return `<div class="stills-grid reveal">${imgs.map((src, i) => `<div class="still"><img src="${resolveImgPath(src)}" alt="Still ${i + 1}"></div>`).join('')}</div>`;
}

function renderTrailer(url) {
  if (!url) return '';
  return `<div class="trailer-section reveal"><div class="section-title">BANDE ANNONCE</div><div class="trailer-wrap"><iframe src="${url}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></div>`;
}

function renderArticle(r) {
  let bodyHtml = parseMarkdown(r.contenu || '');
  if (r.stills) {
    const stillsHtml = renderStills(r.stills);
    bodyHtml = bodyHtml.replace('</p>\n<div class="article-body">', `</p>\n${stillsHtml}\n<div class="article-body">`);
    if (!bodyHtml.includes(stillsHtml)) {
      const firstP = bodyHtml.indexOf('</p>');
      if (firstP !== -1) bodyHtml = bodyHtml.slice(0, firstP + 4) + stillsHtml + bodyHtml.slice(firstP + 4);
    }
  }
  const trailerHtml = renderTrailer(r.trailer);
  const verdict = r.verdict || 'À voir absolument';
  const ratingHtml = r.sans_note ? '' : `<div class="rating-section reveal"><div class="rating-label">Notre verdict</div><div class="rating-title">${verdict}</div><div class="stars-container">${buildStars(r.note || 0)}</div><div class="rating-score">${r.note || '—'}<span> / 5</span></div></div>`;
  return `<div class="article-wrapper" id="article-top">${bodyHtml}${trailerHtml}${ratingHtml}<div class="share-bar reveal"><span class="share-label">Partager</span><button class="share-btn" onclick="shareTwitter()"><svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>X / Twitter</button><button class="share-btn" onclick="shareFacebook()"><svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>Facebook</button><button class="share-btn" id="copyBtn"><svg viewBox="0 0 24 24"><path d="M13.5 3H12H8C6.4 3 5 4.4 5 6v15l7-3 7 3V6c0-1.6-1.4-3-3-3h-2.5z"/></svg>Copier le lien</button></div></div>`;
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderRelated(reviews, currentId) {
  const pool = reviews.filter(r => r.id !== currentId);
  const others = shuffleArray(pool).slice(0, 3);
  if (others.length === 0) return '';
  const cards = others.map(r => {
    const bg = r.img
      ? `<img src="${resolveImgPath(r.img)}" alt="${r.title}" class="related-card-bg" style="width:100%;height:100%;object-fit:cover;display:block;">`
      : `<div class="related-card-bg" style="height:100%;background:linear-gradient(135deg,${r.color || '#1a0505'},${r.color2 || '#3a1010'})"></div>`;
    return `<a href="/${pageDirName(r.slug)}/" class="related-card">${bg}<div class="related-card-overlay"><div class="related-card-title">${r.title}</div><div class="related-card-sub">${r.year || ''} · Critique</div></div></a>`;
  }).join('');
  return `<section class="related-section"><div class="related-inner"><div class="related-header"><span class="related-eyebrow">CONTINUER LA SÉANCE</span><h3>À lire <em>aussi</em></h3></div><div class="related-carousel"><button class="related-arrow prev" onclick="relatedScroll(-1)" aria-label="Précédent"><svg viewBox="0 0 24 24"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button><div class="related-grid" id="relatedGrid">${cards}</div><button class="related-arrow next" onclick="relatedScroll(1)" aria-label="Suivant"><svg viewBox="0 0 24 24"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></button></div><a href="/full-reviews.html" class="related-cta">Voir toutes les critiques<svg viewBox="0 0 24 24"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></a></div></section>`;
}

/* ─────────────────────────────────────────────
   OUTILS SEO
───────────────────────────────────────────── */
function escapeAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Les chemins d'images enregistrés dans Supabase sont souvent relatifs
// (ex: "images/dune.jpg"), ce qui fonctionnait tant que review.html
// vivait à la racine. Les pages générées vivent maintenant un niveau
// plus bas (ex: /the-drama-critique/index.html), donc on force ces
// chemins en absolu pour qu'ils continuent de pointer au bon endroit.
function resolveImgPath(src) {
  if (!src) return src;
  const trimmed = src.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  return `/${trimmed}`;
}

function stripMarkdownToText(md) {
  return (md || '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/[#>*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMetaDescription(r) {
  const base = r.sub && r.sub.trim() ? r.sub.trim() : stripMarkdownToText(r.contenu).slice(0, 300);
  return base.length > 157 ? base.slice(0, 154).trim() + '…' : base;
}

// Échappement pour insérer du texte dans une chaîne JSON (différent de l'échappement HTML)
function escapeJson(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/</g, '\\u003c');
}

// Bloc de données structurées (schema.org) pour obtenir les étoiles
// de notation directement dans les résultats de recherche Google
// ("rich snippets"). Ne s'affiche jamais à l'écran — lu uniquement
// par les moteurs de recherche.
function buildReviewSchema(r) {
  const rating = r.note != null ? Number(r.note) : null;
  if (!rating) return ''; // pas de note = pas de rich snippet possible, on n'insère rien

  const summary = buildMetaDescription(r);
  const datePublished = new Date().toISOString().split('T')[0]; // pas de champ date en base ; date de génération utilisée

  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Review",
  "author": {
    "@type": "Person",
    "name": "Jeremy Mahieu"
  },
  "publisher": {
    "@type": "Organization",
    "name": "L'Entracte"
  },
  "datePublished": "${datePublished}",
  "reviewBody": "${escapeJson(summary)}",
  "reviewRating": {
    "@type": "Rating",
    "bestRating": "5",
    "ratingValue": "${rating}",
    "worstRating": "1"
  },
  "itemReviewed": {
    "@type": "Movie",
    "name": "${escapeJson(r.title)}"${r.year ? `,\n    "dateCreated": "${r.year}"` : ''}${r.genre ? `,\n    "genre": "${escapeJson(r.genre)}"` : ''}${r.realisateur ? `,\n    "director": {\n      "@type": "Person",\n      "name": "${escapeJson(r.realisateur)}"\n    }` : ''}
  }
}
</script>`;
}

/* ─────────────────────────────────────────────
   GABARIT DE PAGE STATIQUE
───────────────────────────────────────────── */
function buildPage(r, allReviews) {
  const description = buildMetaDescription(r);
  const title = `${r.title} (${r.year || ''}) – Critique • L'Entracte`;
  const canonical = `${SITE_URL}/${pageDirName(r.slug)}/`;
  const resolvedOg = resolveImgPath(r.banner || r.img);
  const ogImage = resolvedOg
    ? (resolvedOg.startsWith('http') ? resolvedOg : `${SITE_URL}${resolvedOg}`)
    : `${SITE_URL}/favicon-512.png`;
  const heroHtml = renderHero(r);
  const articleHtml = renderArticle(r);
  const relatedHtml = renderRelated(allReviews, r.id);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeAttr(title)}</title>
<meta name="description" content="${escapeAttr(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeAttr(r.title)} – Critique">
<meta property="og:description" content="${escapeAttr(description)}">
<meta property="og:image" content="${escapeAttr(ogImage)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="fr_BE">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(r.title)} – Critique">
<meta name="twitter:description" content="${escapeAttr(description)}">
<meta name="twitter:image" content="${escapeAttr(ogImage)}">
${buildReviewSchema(r)}
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500&family=Playfair+Display:ital,wght@0,700;0,900;1,400;1,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/review.css">
<script defer src="https://cloud.umami.is/script.js" data-website-id="d4fdfb43-bc4b-4c30-a897-d5103f786ec7"></script>
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
</head>
<body>
<nav id="navbar">
<a href="/index.html" class="logo"><img src="/images/TAGLINE.png" alt="L'Entracte"></a>
<div class="nav-right">
<ul class="nav-links">
<li class="nav-cinema">Cinéma<svg viewBox="0 0 10 6"><path d="M0 0l5 6 5-6z"/></svg>
<div class="dropdown">
<a href="/full-reviews.html"><span>▸</span>Nos dernières reviews</a>
<a href="/ccf-archives.html"><span>▸</span>Comment c'est fait ?</a>
<a href="/tops-archives.html"><span>▸</span>Les tops & rétrospectives</a>
</div>
</li>
<li><a href="/a-propos.html">À propos</a></li>
<li><a href="/index.html#contact" class="contact-link">Contact</a></li>
</ul>
</div>
<div class="search-btn" onclick="toggleSearch()" title="Rechercher"><svg viewBox="0 0 24 24" fill="#ffffff"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></div>
<div class="burger" onclick="toggleNav()" id="burger"><span></span><span></span><span></span></div>
</nav>
<div class="mobile-nav" id="mobileNav">
<a href="/index.html#reviews" onclick="toggleNav()">Reviews</a>
<a href="/ccf-archives.html" onclick="toggleNav()">Comment c'est fait ?</a>
<a href="/tops-archives.html" onclick="toggleNav()">Les tops</a>
<a href="/a-propos.html" onclick="toggleNav()">À propos</a>
<a href="/index.html#contact" onclick="toggleNav()">Contact</a>
</div>

<div id="hero-container">${heroHtml}</div>
<div id="article-container">${articleHtml}</div>
<div id="related-container">${relatedHtml}</div>

<footer><p>© ${new Date().getFullYear()} L'Entracte • Du grand écran à votre écran • Tous droits réservés</p></footer>

<div id="lightbox" class="lightbox" onclick="closeLightbox(event)">
<span class="lightbox-close" onclick="closeLightbox(event)">&times;</span>
<img id="lightbox-img" src="" alt="">
<div id="lightbox-caption" class="lightbox-caption"></div>
</div>

<div class="search-overlay" id="searchOverlay" onclick="handleOverlayClick(event)">
<button class="search-close" onclick="toggleSearch()">✕</button>
<div class="search-box">
<input type="text" id="searchInput" placeholder="Rechercher un film…" autocomplete="off">
<button class="search-submit" onclick="doSearch()"><svg viewBox="0 0 24 24"><path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg></button>
</div>
<p class="search-hint">APPUYEZ SUR ENTRÉE POUR RECHERCHER • ÉCHAP POUR FERMER</p>
<div id="searchResults" class="search-results"></div>
</div>

<style>
.search-overlay{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;opacity:0;pointer-events:none;transition:opacity .3s ease;backdrop-filter:blur(4px)}
.search-overlay.active{opacity:1;pointer-events:all}
.search-box{width:min(600px,90vw);position:relative;transform:translateY(20px);transition:transform .35s ease}
.search-overlay.active .search-box{transform:translateY(0)}
.search-box input{width:100%;background:#1a1a1a;border:2px solid var(--red);border-radius:50px;padding:18px 60px 18px 28px;font-family:'Montserrat',sans-serif;font-size:18px;font-weight:600;color:var(--white);outline:none;letter-spacing:.5px}
.search-box input::placeholder{color:#555}
.search-box .search-submit{position:absolute;right:16px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px}
.search-box .search-submit svg{width:22px;height:22px;fill:var(--red)}
.search-close{position:absolute;top:24px;right:24px;background:none;border:none;color:#666;font-size:28px;cursor:pointer;transition:color .2s;line-height:1}
.search-close:hover{color:var(--white)}
.search-hint{text-align:center;margin-top:16px;font-size:12px;color:#444;letter-spacing:2px;text-transform:uppercase}
.search-results{margin-top:32px;display:flex;flex-direction:column;gap:12px;width:100%;max-width:640px}
.search-result-card{display:flex;align-items:center;gap:16px;background:#181818;border:1px solid #2a2a2a;border-radius:10px;padding:12px 16px;text-decoration:none;color:#fff;transition:border-color .2s,background .2s;cursor:pointer}
.search-result-card:hover{border-color:#E8253A;background:rgba(232,37,58,.07)}
.search-result-img{width:44px;height:60px;object-fit:cover;border-radius:6px;flex-shrink:0;background:#2a2a2a}
.search-result-info{display:flex;flex-direction:column;gap:4px}
.search-result-title{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;color:#fff}
.search-result-meta{font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase}
.search-no-result{font-size:13px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-top:8px}
</style>

<script>
const SUPABASE_URL = '${SUPABASE_URL}';
const SUPABASE_KEY = '${SUPABASE_KEY}';
let relatedIndex = 0;
function relatedScroll(dir){const grid=document.getElementById('relatedGrid');if(!grid)return;const cards=grid.querySelectorAll('.related-card');if(!cards.length)return;const step=cards[0].getBoundingClientRect().width;relatedIndex=(relatedIndex+dir+cards.length)%cards.length;grid.style.scrollSnapType='none';grid.scrollTo({left:relatedIndex*step,behavior:'smooth'});clearTimeout(grid._snapRestoreTimeout);grid._snapRestoreTimeout=setTimeout(()=>{grid.style.scrollSnapType='';},500);}
function shareTwitter(){const url=\`https://twitter.com/intent/tweet?url=\${encodeURIComponent(location.href)}&text=\${encodeURIComponent(document.title)}\`;window.open(url,'_blank');}
function shareFacebook(){const url=\`https://www.facebook.com/sharer/sharer.php?u=\${encodeURIComponent(location.href)}\`;window.open(url,'_blank');}
function toggleNav(){const nav=document.getElementById('mobileNav');nav.classList.toggle('open');const spans=document.getElementById('burger').querySelectorAll('span');if(nav.classList.contains('open')){spans[0].style.transform='rotate(45deg) translate(5px,5px)';spans[1].style.opacity='0';spans[2].style.transform='rotate(-45deg) translate(5px,-5px)';}else{spans.forEach(s=>{s.style.transform='';s.style.opacity='';});}}
function openLightbox(src,caption){const lb=document.getElementById('lightbox');document.getElementById('lightbox-img').src=src;document.getElementById('lightbox-caption').textContent=caption||'';lb.classList.add('open');document.body.style.overflow='hidden';}
function closeLightbox(e){if(e&&e.target.id==='lightbox-img')return;const lb=document.getElementById('lightbox');lb.classList.remove('open');document.body.style.overflow='';}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox();});
function bindLightboxImages(){document.querySelectorAll('.article-image img, .article-gallery img').forEach(img=>{if(img.dataset.lbBound)return;img.dataset.lbBound='1';img.style.cursor='zoom-in';img.addEventListener('click',()=>{const caption=img.closest('figure')?.querySelector('figcaption')?.textContent||img.alt||'';openLightbox(img.src,caption);});});}
function toggleSearch(){const overlay=document.getElementById('searchOverlay');overlay.classList.toggle('active');if(overlay.classList.contains('active')){setTimeout(()=>document.getElementById('searchInput').focus(),50);}else{document.getElementById('searchInput').value='';document.getElementById('searchResults').innerHTML='';}}
let __overlayMouseDownOnSelf=false;
document.addEventListener('DOMContentLoaded',()=>{const ov=document.getElementById('searchOverlay');if(ov)ov.addEventListener('mousedown',e=>{__overlayMouseDownOnSelf=(e.target===ov);});});
function handleOverlayClick(e){if(e.target===document.getElementById('searchOverlay')&&__overlayMouseDownOnSelf)toggleSearch();}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('searchOverlay').classList.remove('active');document.getElementById('searchInput').value='';document.getElementById('searchResults').innerHTML='';}if(e.key==='Enter'&&document.getElementById('searchOverlay').classList.contains('active')){doSearch();}});
let __searchDebounce=null;
document.addEventListener('DOMContentLoaded',()=>{const input=document.getElementById('searchInput');if(input){input.addEventListener('input',()=>{clearTimeout(__searchDebounce);const q=input.value.trim();if(q.length<2){document.getElementById('searchResults').innerHTML='';return;}__searchDebounce=setTimeout(doSearch,300);});}});
async function doSearch(){const query=document.getElementById('searchInput').value.trim();const resultsEl=document.getElementById('searchResults');if(!query)return;resultsEl.innerHTML='<p class="search-no-result">Recherche en cours…</p>';const res=await fetch(\`\${SUPABASE_URL}/rest/v1/reviews?select=id,title,year,genre,img,slug&publie=eq.true&title=ilike.*\${encodeURIComponent(query)}*&order=id.asc&limit=8\`,{headers:{apikey:SUPABASE_KEY,Authorization:\`Bearer \${SUPABASE_KEY}\`}});const data=await res.json();if(!data.length){resultsEl.innerHTML='<p class="search-no-result">Nous n\\'avons pas encore écrit sur <em style="color:#fff">« '+query+' »</em>, mais n\\'hésitez pas à nous le conseiller !</p>';return;}resultsEl.innerHTML=data.map(r=>\`<a class="search-result-card" href="/\${r.slug.endsWith('-critique')?r.slug:r.slug+'-critique'}/">\${r.img?\`<img class="search-result-img" src="\${r.img}" alt="\${r.title}">\`:'<div class="search-result-img"></div>'}<div class="search-result-info"><div class="search-result-title">\${r.title}</div><div class="search-result-meta">\${r.year||''}\${r.genre?' · '+r.genre:''}</div></div></a>\`).join('');}

/* ── REPRISE DE LECTURE (marque-page) ── */
const READ_KEY = 'entracte_review_read_${r.slug}';
function getArticleBody(){return document.querySelector('.article-body')||document.querySelector('.article-wrapper');}
function updateReadingProgress(){const body=getArticleBody();if(!body)return;const rect=body.getBoundingClientRect();const total=rect.height-window.innerHeight;if(total<=0)return;const scrolled=Math.min(Math.max(-rect.top,0),total);const pct=scrolled/total;if(pct>0.03&&pct<0.95){localStorage.setItem(READ_KEY,JSON.stringify({pct,scrollY:window.scrollY}));setBookmarkState(pct,window.scrollY);}else if(pct>=0.95){localStorage.removeItem(READ_KEY);setBookmarkState(null,null);}}
function checkResumeReading(){const bookmark=createResumeBookmark();requestAnimationFrame(()=>bookmark.classList.add('visible'));const saved=localStorage.getItem(READ_KEY);if(!saved){setBookmarkState(null,null);return;}let data;try{data=JSON.parse(saved);}catch{setBookmarkState(null,null);return;}if(!data||!data.scrollY||data.scrollY<200){setBookmarkState(null,null);return;}setBookmarkState(data.pct,data.scrollY);}
function createResumeBookmark(){let bookmark=document.querySelector('.resume-bookmark');if(bookmark)return bookmark;bookmark=document.createElement('button');bookmark.className='resume-bookmark';bookmark.setAttribute('aria-label','Marque-page de lecture');bookmark.innerHTML='<svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>';const tooltip=document.createElement('div');tooltip.className='resume-tooltip';bookmark.addEventListener('mouseenter',()=>tooltip.classList.add('visible'));bookmark.addEventListener('mouseleave',()=>tooltip.classList.remove('visible'));const nav=document.getElementById('navbar');nav.appendChild(bookmark);nav.appendChild(tooltip);return bookmark;}
function setBookmarkState(pct,scrollY){const bookmark=document.querySelector('.resume-bookmark');const tooltip=document.querySelector('.resume-tooltip');if(!bookmark||!tooltip)return;if(pct!=null&&scrollY!=null){bookmark.classList.add('active');tooltip.textContent=\`Reprendre la lecture (\${Math.round(pct*100)}%)\`;bookmark.onclick=()=>window.scrollTo({top:scrollY,behavior:'smooth'});}else{bookmark.classList.remove('active');tooltip.textContent='Aucune lecture en cours';tooltip.classList.remove('visible');bookmark.onclick=null;}}
let __progressTicking=false;
function bindReadingProgress(){window.addEventListener('scroll',()=>{if(__progressTicking)return;__progressTicking=true;requestAnimationFrame(()=>{updateReadingProgress();__progressTicking=false;});},{passive:true});}

document.addEventListener('DOMContentLoaded', () => {
  bindLightboxImages();
  bindReadingProgress();
  checkResumeReading();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  const relatedGridEl = document.getElementById('relatedGrid');
  if (relatedGridEl) {
    let swipeSyncTimeout;
    relatedGridEl.addEventListener('scroll', () => {
      clearTimeout(swipeSyncTimeout);
      swipeSyncTimeout = setTimeout(() => {
        const cards = relatedGridEl.querySelectorAll('.related-card');
        if (!cards.length) return;
        const step = cards[0].getBoundingClientRect().width;
        relatedIndex = Math.round(relatedGridEl.scrollLeft / step);
      }, 120);
    });
  }
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      navigator.clipboard?.writeText(location.href);
      this.innerHTML = '<svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:currentColor"><path d="M20 6L9 17l-5-5"/></svg> Copié !';
      setTimeout(() => {
        this.innerHTML = '<svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:currentColor"><path d="M13.5 3H12H8C6.4 3 5 4.4 5 6v15l7-3 7 3V6c0-1.6-1.4-3-3-3h-2.5z"/></svg> Copier le lien';
      }, 2000);
    });
  }
});
</script>
</body>
</html>`;
}

/* ═════════════════════════════════════════════
   PARTIE "COMMENT C'EST FAIT ?" (CCF)
   Fonctions portées depuis ccf.html — table `ccf`
   (article) + `ccf_sections` (blocs ordonnés)
═════════════════════════════════════════════ */

function mdCcf(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function parseImgLineCcf(m) {
  const rawLabel = m[1].trim();
  const src = m[2].trim();
  const parts = rawLabel.split('|');
  const caption = parts[0].trim();
  let position = '', wide = false, stack = false;
  parts.slice(1).forEach(p => {
    const mod = p.trim();
    if (mod === 'large' || mod === 'full') wide = true;
    else if (mod === 'stack') stack = true;
    else if (/^\d+%?$/.test(mod)) position = `center ${mod.replace('%', '')}%`;
  });
  return { caption, src, position, wide, stack };
}

function renderImgBlockCcf(imgs) {
  if (imgs.length === 1) {
    const { caption, src, position, wide } = parseImgLineCcf(imgs[0]);
    return `<figure class="article-image reveal${wide ? ' wide' : ''}"><img src="${resolveImgPath(src)}" alt="${caption || 'Image'}" loading="lazy"${position ? ` style="object-position:${position}"` : ''}>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
  }
  const parsed = imgs.map(parseImgLineCcf);
  const useStack = parsed.some(p => p.stack);
  const useLandscape = parsed.some(p => p.wide);
  const figs = parsed.map(({ caption, src, position }) => `<figure><img src="${resolveImgPath(src)}" alt="${caption || 'Image'}" loading="lazy"${position ? ` style="object-position:${position}"` : ''}>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`).join('');
  const colCount = imgs.length === 4 ? 2 : Math.min(imgs.length, 3);
  const galleryClass = useStack ? (imgs.length >= 4 ? 'stack stack-cols-2' : 'stack') : `cols-${colCount}${useLandscape ? ' landscape' : ''}`;
  return `<div class="article-gallery reveal ${galleryClass}">${figs}</div>`;
}

function mdTextCcf(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const blocks = [];
  let currentParagraph = [];
  function flushParagraph() {
    if (currentParagraph.length === 0) return;
    const t = currentParagraph.join(' ').trim();
    currentParagraph = [];
    if (!t) return;
    blocks.push(`<p class="reveal">${mdCcf(t)}</p>`);
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') { flushParagraph(); continue; }
    const imgMatch = line.trim().match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      flushParagraph();
      const imgs = [imgMatch];
      while (i + 1 < lines.length && /^!\[(.*?)\]\((.*?)\)$/.test(lines[i + 1].trim())) {
        i++;
        imgs.push(lines[i].trim().match(/^!\[(.*?)\]\((.*?)\)$/));
      }
      blocks.push(renderImgBlockCcf(imgs));
      continue;
    }
    const quoteMatch = line.trim().match(/^>\s?(.+)$/);
    if (quoteMatch) {
      flushParagraph();
      const [quoteText, citeText] = quoteMatch[1].split('|').map(p => p && p.trim());
      blocks.push(`<div class="pull-quote reveal"><p>${mdCcf(quoteText)}</p>${citeText ? `<cite>${citeText}</cite>` : ''}</div>`);
      continue;
    }
    currentParagraph.push(line);
  }
  flushParagraph();
  return blocks.join('');
}

function renderHeroCcf(article) {
  return `<section class="hero"><div class="hero-bg"><img src="${resolveImgPath(article.banner || '')}" alt="${article.title}"><div class="hero-bg-after"></div></div><img src="${resolveImgPath(article.logo || 'images/ccf_logo_base.png')}" alt="Comment c'est fait ?" class="hero-sticker"><div class="hero-content"><div class="hero-eyebrow"><span class="dot"></span>COMMENT C'EST FAIT ?</div><h1 class="hero-title">${article.title}</h1><span class="hero-film">${article.tagline || ''}</span><div class="hero-meta">${article.realisateur ? `<div class="meta-item"><span class="meta-label">Réalisateur</span><span class="meta-value">${article.realisateur}</span></div>` : ''}${article.annee ? `<div class="meta-item"><span class="meta-label">Année</span><span class="meta-value">${article.annee}</span></div>` : ''}${article.fx_studio ? `<div class="meta-item"><span class="meta-label">Effets spéciaux</span><span class="meta-value">${article.fx_studio}</span></div>` : ''}${article.genre ? `<div class="meta-item"><span class="meta-label">Genre</span><span class="meta-value">${article.genre}</span></div>` : ''}${article.duree ? `<div class="meta-item"><span class="meta-label">Durée</span><span class="meta-value">${article.duree} min</span></div>` : ''}</div></div><div class="hero-scroll" onclick="document.getElementById('article-container').scrollIntoView({behavior:'smooth'})"><span>LIRE</span><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg></div></section>`;
}

function renderSectionCcf(s) {
  switch (s.type) {
    case 'section_title':
      return `<div class="section-title reveal">${s.titre}</div>`;
    case 'text':
      return mdTextCcf(s.contenu) + '<div class="clearfix"></div>';
    case 'pull_quote':
      return `<div class="pull-quote reveal"><p>${mdCcf(s.contenu)}</p>${s.cite ? `<cite>${s.cite}</cite>` : ''}</div>`;
    case 'anecdote':
      return `<div class="anecdote-card reveal"><div class="anecdote-icon">💡</div><div class="anecdote-label">${s.titre || 'LE SAVIEZ-VOUS ?'}</div><p class="anecdote-text">${mdCcf(s.contenu)}</p></div>`;
    case 'img_full':
      return `<figure class="img-full reveal"><img src="${resolveImgPath(s.img_1)}" alt="${s.caption_1 || ''}">${s.caption_1 ? `<figcaption>${s.caption_1}</figcaption>` : ''}</figure>`;
    case 'img_float':
      return `<figure class="img-float reveal"><div class="img-float-wrap"><img src="${resolveImgPath(s.img_1)}" alt="${s.caption_1 || ''}"></div>${s.caption_1 ? `<figcaption>${s.caption_1}</figcaption>` : ''}</figure>`;
    case 'img_float_left':
      return `<figure class="img-float-left reveal"><div class="img-float-wrap"><img src="${resolveImgPath(s.img_1)}" alt="${s.caption_1 || ''}"></div>${s.caption_1 ? `<figcaption>${s.caption_1}</figcaption>` : ''}</figure>`;
    case 'img_center':
      return `<figure class="img-center reveal"><img src="${resolveImgPath(s.img_1)}" alt="${s.caption_1 || ''}">${s.caption_1 ? `<figcaption>${s.caption_1}</figcaption>` : ''}</figure>`;
    case 'img_duo':
      return `<div class="img-duo reveal"><figure><div class="img-duo-wrap"><img src="${resolveImgPath(s.img_1)}" alt="${s.caption_1 || ''}"></div>${s.caption_1 ? `<figcaption>${s.caption_1}</figcaption>` : ''}</figure><figure><div class="img-duo-wrap"><img src="${resolveImgPath(s.img_2)}" alt="${s.caption_2 || ''}"></div>${s.caption_2 ? `<figcaption>${s.caption_2}</figcaption>` : ''}</figure></div>`;
    case 'img_mosaic':
      return `<div class="img-mosaic reveal"><div class="mosaic-left"><figure><div class="img-mosaic-wrap"><img src="${resolveImgPath(s.img_1)}" alt="${s.caption_1 || ''}"></div>${s.caption_1 ? `<figcaption>${s.caption_1}</figcaption>` : ''}</figure></div><div class="mosaic-right"><figure><div class="img-mosaic-wrap"><img src="${resolveImgPath(s.img_2)}" alt="${s.caption_2 || ''}"></div>${s.caption_2 ? `<figcaption>${s.caption_2}</figcaption>` : ''}</figure><figure><div class="img-mosaic-wrap"><img src="${resolveImgPath(s.img_3)}" alt="${s.caption_3 || ''}"></div>${s.caption_3 ? `<figcaption>${s.caption_3}</figcaption>` : ''}</figure></div></div>`;
    case 'audio_clip':
      return `<div class="audio-clip reveal"><span class="audio-clip-label">${s.titre || '◆ ÉCOUTER'}</span><button class="audio-clip-btn" onclick="toggleAudioClip(this)" data-src="${resolveImgPath(s.img_1)}" aria-label="Lecture audio"><svg class="icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><svg class="icon-pause" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg></button><div class="audio-clip-progress"><div class="audio-clip-progress-bar"></div></div>${s.caption_1 ? `<p class="audio-clip-caption">${s.caption_1}</p>` : ''}</div>`;
    case 'img_stills': {
      const imgs = [
        { src: s.img_1, cap: s.caption_1 },
        { src: s.img_2, cap: s.caption_2 },
        { src: s.img_3, cap: s.caption_3 },
      ].filter(i => i.src);
      return `<div class="stills-grid reveal">${imgs.map((img, idx) => `<figure class="still${idx === 0 ? ' still-wide' : ''}" ${idx === 0 ? 'style="aspect-ratio:21/9"' : 'style="aspect-ratio:16/9"'}><img src="${resolveImgPath(img.src)}" alt="${img.cap || ''}">${img.cap ? `<figcaption>${img.cap}</figcaption>` : ''}</figure>`).join('')}</div>`;
    }
    case 'img_cenobites': {
      const cards = [
        { src: s.img_1, cap: s.caption_1 },
        { src: s.img_2, cap: s.caption_2 },
        { src: s.img_3, cap: s.caption_3 },
        { src: s.img_4, cap: s.caption_4 },
      ].filter(c => c.src);
      return `<div class="cenobites-grid reveal">${cards.map(c => {
        const [name, sub] = (c.cap || '').split('|');
        return `<div class="cenobite-card"><img src="${resolveImgPath(c.src)}" alt="${name || ''}"><div class="cenobite-card-overlay"><div class="cenobite-name">${name || ''}</div>${sub ? `<div class="cenobite-sub">${sub}</div>` : ''}</div></div>`;
      }).join('')}</div>`;
    }
    case 'clearfix':
      return `<div class="clearfix"></div>`;
    default:
      return '';
  }
}

function buildCcfMetaDescription(article) {
  const base = article.tagline && article.tagline.trim()
    ? article.tagline.trim()
    : stripMarkdownToText(article.intro_1 || '').slice(0, 300);
  return base.length > 157 ? base.slice(0, 154).trim() + '…' : base;
}

function buildCcfPage(article, sections) {
  const description = buildCcfMetaDescription(article);
  const title = `${article.title} — Comment c'est fait ? • L'Entracte`;
  const canonical = `${SITE_URL}/${pageDirNameCcf(article.slug)}/`;
  const resolvedOg = resolveImgPath(article.banner);
  const ogImage = resolvedOg
    ? (resolvedOg.startsWith('http') ? resolvedOg : `${SITE_URL}${resolvedOg}`)
    : `${SITE_URL}/favicon-512.png`;

  let bodyHtml = '<div class="article-wrapper">';
  if (article.intro_1) bodyHtml += `<p class="article-intro reveal">${mdCcf(article.intro_1)}</p>`;
  if (article.intro_2) bodyHtml += `<p class="article-intro reveal">${mdCcf(article.intro_2)}</p>`;
  if (article.intro_3) bodyHtml += `<p class="article-intro reveal">${mdCcf(article.intro_3)}</p>`;
  if (article.transition) bodyHtml += `<p class="article-transition reveal">${mdCcf(article.transition)}</p>`;
  bodyHtml += '<div class="article-body">';
  sections.forEach(s => { bodyHtml += renderSectionCcf(s); });
  bodyHtml += '</div>';
  bodyHtml += `<div class="share-bar reveal"><span class="share-label">Partager</span><button class="share-btn" onclick="shareTwitter()"><svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>X / Twitter</button><button class="share-btn" onclick="shareFacebook()"><svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>Facebook</button><button class="share-btn" id="copyBtn"><svg viewBox="0 0 24 24"><path d="M13.5 3H12H8C6.4 3 5 4.4 5 6v15l7-3 7 3V6c0-1.6-1.4-3-3-3h-2.5z"/></svg>Copier le lien</button></div>`;
  bodyHtml += '</div>';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeAttr(title)}</title>
<meta name="description" content="${escapeAttr(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeAttr(article.title)} — Comment c'est fait ?">
<meta property="og:description" content="${escapeAttr(description)}">
<meta property="og:image" content="${escapeAttr(ogImage)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="fr_BE">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(article.title)} — Comment c'est fait ?">
<meta name="twitter:description" content="${escapeAttr(description)}">
<meta name="twitter:image" content="${escapeAttr(ogImage)}">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500&family=Playfair+Display:ital,wght@0,700;0,900;1,400;1,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/ccf.css">
<link rel="stylesheet" href="/ccf-patch.css">
<script defer src="https://cloud.umami.is/script.js" data-website-id="d4fdfb43-bc4b-4c30-a897-d5103f786ec7"></script>
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
</head>
<body>
<nav id="navbar">
<a href="/index.html" class="logo"><img src="/images/TAGLINE.png" alt="L'Entracte"></a>
<div class="nav-right">
<ul class="nav-links">
<li class="nav-cinema">Cinéma<svg viewBox="0 0 10 6"><path d="M0 0l5 6 5-6z"/></svg>
<div class="dropdown">
<a href="/full-reviews.html"><span>▸</span>Nos dernières reviews</a>
<a href="/ccf-archives.html"><span>▸</span>Comment c'est fait ?</a>
<a href="/tops-archives.html"><span>▸</span>Les tops & rétrospectives</a>
</div>
</li>
<li><a href="/a-propos.html">À propos</a></li>
<li><a href="/index.html#contact" class="contact-link">Contact</a></li>
</ul>
</div>
<div class="search-btn" onclick="toggleSearch()" title="Rechercher"><svg viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></div>
<div class="burger" onclick="toggleNav()" id="burger"><span></span><span></span><span></span></div>
</nav>
<div class="mobile-nav" id="mobileNav">
<a href="/full-reviews.html" onclick="toggleNav()">Nos critiques</a>
<a href="/ccf-archives.html" onclick="toggleNav()">Comment c'est fait ?</a>
<a href="/tops-archives.html" onclick="toggleNav()">Les tops</a>
<a href="/a-propos.html" onclick="toggleNav()">À propos</a>
<a href="/index.html#contact" onclick="toggleNav()">Contact</a>
</div>

<div id="hero-container">${renderHeroCcf(article)}</div>
<div id="article-container">${bodyHtml}</div>

<footer><p>© ${new Date().getFullYear()} L'Entracte • Du grand écran à votre écran • Tous droits réservés</p></footer>

<div id="lightbox" class="lightbox" onclick="closeLightbox(event)">
<span class="lightbox-close" onclick="closeLightbox(event)">&times;</span>
<img id="lightbox-img" src="" alt="">
<div id="lightbox-caption" class="lightbox-caption"></div>
</div>

<div class="search-overlay" id="searchOverlay" onclick="handleOverlayClick(event)">
<button class="search-close" onclick="toggleSearch()">✕</button>
<div class="search-box">
<input type="text" id="searchInput" placeholder="Rechercher un film…" autocomplete="off">
<button class="search-submit" onclick="doSearch()"><svg viewBox="0 0 24 24"><path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg></button>
</div>
<p class="search-hint">APPUYEZ SUR ENTRÉE POUR RECHERCHER • ÉCHAP POUR FERMER</p>
<div id="searchResults" class="search-results"></div>
</div>

<style>
.search-results{margin-top:32px;display:flex;flex-direction:column;gap:12px;width:100%;max-width:640px}
.search-result-card{display:flex;align-items:center;gap:16px;background:#181818;border:1px solid #2a2a2a;border-radius:10px;padding:12px 16px;text-decoration:none;color:#fff;transition:border-color .2s,background .2s;cursor:pointer}
.search-result-card:hover{border-color:#E8253A;background:rgba(232,37,58,.07)}
.search-result-img{width:44px;height:60px;object-fit:cover;border-radius:6px;flex-shrink:0;background:#2a2a2a}
.search-result-info{display:flex;flex-direction:column;gap:4px}
.search-result-title{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;color:#fff}
.search-result-meta{font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase}
.search-no-result{font-size:13px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-top:8px}
</style>

<script>
const SUPABASE_URL = '${SUPABASE_URL}';
const SUPABASE_KEY = '${SUPABASE_KEY}';
function toggleNav(){const nav=document.getElementById('mobileNav');nav.classList.toggle('open');const spans=document.getElementById('burger').querySelectorAll('span');if(nav.classList.contains('open')){spans[0].style.transform='rotate(45deg) translate(5px,5px)';spans[1].style.opacity='0';spans[2].style.transform='rotate(-45deg) translate(5px,-5px)';}else{spans.forEach(s=>{s.style.transform='';s.style.opacity='';});}}
function toggleSearch(){const overlay=document.getElementById('searchOverlay');overlay.classList.toggle('active');if(overlay.classList.contains('active')){setTimeout(()=>document.getElementById('searchInput').focus(),50);}else{document.getElementById('searchInput').value='';document.getElementById('searchResults').innerHTML='';}}
let __overlayMouseDownOnSelf=false;
document.addEventListener('DOMContentLoaded',()=>{const ov=document.getElementById('searchOverlay');if(ov)ov.addEventListener('mousedown',e=>{__overlayMouseDownOnSelf=(e.target===ov);});});
function handleOverlayClick(e){if(e.target===document.getElementById('searchOverlay')&&__overlayMouseDownOnSelf)toggleSearch();}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('searchOverlay').classList.remove('active');document.getElementById('searchInput').value='';document.getElementById('searchResults').innerHTML='';}if(e.key==='Enter'&&document.getElementById('searchOverlay').classList.contains('active')){doSearch();}});
let __searchDebounce=null;
document.addEventListener('DOMContentLoaded',()=>{const input=document.getElementById('searchInput');if(input){input.addEventListener('input',()=>{clearTimeout(__searchDebounce);const q=input.value.trim();if(q.length<2){document.getElementById('searchResults').innerHTML='';return;}__searchDebounce=setTimeout(doSearch,300);});}});
async function doSearch(){const query=document.getElementById('searchInput').value.trim();const resultsEl=document.getElementById('searchResults');if(!query)return;resultsEl.innerHTML='<p class="search-no-result">Recherche en cours…</p>';const res=await fetch(\`\${SUPABASE_URL}/rest/v1/reviews?select=id,title,year,genre,img,slug&publie=eq.true&title=ilike.*\${encodeURIComponent(query)}*&order=id.asc&limit=8\`,{headers:{apikey:SUPABASE_KEY,Authorization:\`Bearer \${SUPABASE_KEY}\`}});const data=await res.json();if(!data.length){resultsEl.innerHTML='<p class="search-no-result">Nous n\\'avons pas encore écrit sur <em style="color:#fff">« '+query+' »</em>, mais n\\'hésitez pas à nous le conseiller !</p>';return;}resultsEl.innerHTML=data.map(r=>{const finalSlug=r.slug&&r.slug.endsWith('-critique')?r.slug:\`\${r.slug}-critique\`;return \`<a class="search-result-card" href="/\${finalSlug}/">\${r.img?\`<img class="search-result-img" src="\${r.img}" alt="\${r.title}">\`:'<div class="search-result-img"></div>'}<div class="search-result-info"><div class="search-result-title">\${r.title}</div><div class="search-result-meta">\${r.year||''}\${r.genre?' · '+r.genre:''}</div></div></a>\`;}).join('');}
function shareTwitter(){window.open(\`https://twitter.com/intent/tweet?url=\${encodeURIComponent(location.href)}&text=\${encodeURIComponent(document.title)}\`,'_blank');}
function shareFacebook(){window.open(\`https://www.facebook.com/sharer/sharer.php?u=\${encodeURIComponent(location.href)}\`,'_blank');}
function openLightbox(src,caption){const lb=document.getElementById('lightbox');document.getElementById('lightbox-img').src=src;document.getElementById('lightbox-caption').textContent=caption||'';lb.classList.add('open');document.body.style.overflow='hidden';}
function closeLightbox(e){if(e&&e.target.id==='lightbox-img')return;const lb=document.getElementById('lightbox');lb.classList.remove('open');document.body.style.overflow='';}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox();});
function bindLightboxImages(){document.querySelectorAll('.article-image img, .article-gallery img').forEach(img=>{if(img.dataset.lbBound)return;img.dataset.lbBound='1';img.style.cursor='zoom-in';img.addEventListener('click',()=>{const caption=img.closest('figure')?.querySelector('figcaption')?.textContent||img.alt||'';openLightbox(img.src,caption);});});}
let currentAudioClip=null;
function toggleAudioClip(btn){const src=btn.dataset.src;const wrap=btn.closest('.audio-clip');const progressBar=wrap.querySelector('.audio-clip-progress-bar');if(currentAudioClip&&currentAudioClip.audio&&!currentAudioClip.audio.paused&&currentAudioClip.btn!==btn){currentAudioClip.audio.pause();currentAudioClip.btn.classList.remove('playing');}if(!btn._audio){btn._audio=new Audio(src);btn._audio.addEventListener('timeupdate',()=>{const pct=(btn._audio.currentTime/btn._audio.duration)*100;progressBar.style.width=pct+'%';});btn._audio.addEventListener('ended',()=>{btn.classList.remove('playing');progressBar.style.width='0%';});}if(btn._audio.paused){btn._audio.play();btn.classList.add('playing');currentAudioClip={audio:btn._audio,btn:btn};}else{btn._audio.pause();btn.classList.remove('playing');}}

/* ── REPRISE DE LECTURE (marque-page) ── */
const READ_KEY = 'entracte_ccf_read_${article.slug}';
function getArticleBody(){return document.querySelector('.article-body')||document.querySelector('.article-wrapper');}
function updateReadingProgress(){const body=getArticleBody();if(!body)return;const rect=body.getBoundingClientRect();const total=rect.height-window.innerHeight;if(total<=0)return;const scrolled=Math.min(Math.max(-rect.top,0),total);const pct=scrolled/total;if(pct>0.03&&pct<0.95){localStorage.setItem(READ_KEY,JSON.stringify({pct,scrollY:window.scrollY}));setBookmarkState(pct,window.scrollY);}else if(pct>=0.95){localStorage.removeItem(READ_KEY);setBookmarkState(null,null);}}
function checkResumeReading(){const bookmark=createResumeBookmark();requestAnimationFrame(()=>bookmark.classList.add('visible'));const saved=localStorage.getItem(READ_KEY);if(!saved){setBookmarkState(null,null);return;}let data;try{data=JSON.parse(saved);}catch{setBookmarkState(null,null);return;}if(!data||!data.scrollY||data.scrollY<200){setBookmarkState(null,null);return;}setBookmarkState(data.pct,data.scrollY);}
function createResumeBookmark(){let bookmark=document.querySelector('.resume-bookmark');if(bookmark)return bookmark;bookmark=document.createElement('button');bookmark.className='resume-bookmark';bookmark.setAttribute('aria-label','Marque-page de lecture');bookmark.innerHTML='<svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>';const tooltip=document.createElement('div');tooltip.className='resume-tooltip';bookmark.addEventListener('mouseenter',()=>tooltip.classList.add('visible'));bookmark.addEventListener('mouseleave',()=>tooltip.classList.remove('visible'));const nav=document.getElementById('navbar');nav.appendChild(bookmark);nav.appendChild(tooltip);return bookmark;}
function setBookmarkState(pct,scrollY){const bookmark=document.querySelector('.resume-bookmark');const tooltip=document.querySelector('.resume-tooltip');if(!bookmark||!tooltip)return;if(pct!=null&&scrollY!=null){bookmark.classList.add('active');tooltip.textContent=\`Reprendre la lecture (\${Math.round(pct*100)}%)\`;bookmark.onclick=()=>window.scrollTo({top:scrollY,behavior:'smooth'});}else{bookmark.classList.remove('active');tooltip.textContent='Aucune lecture en cours';tooltip.classList.remove('visible');bookmark.onclick=null;}}
let __progressTicking=false;
function bindReadingProgress(){window.addEventListener('scroll',()=>{if(__progressTicking)return;__progressTicking=true;requestAnimationFrame(()=>{updateReadingProgress();__progressTicking=false;});},{passive:true});}

document.addEventListener('DOMContentLoaded', () => {
  bindLightboxImages();
  bindReadingProgress();
  checkResumeReading();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (e) => {
      const img = document.querySelector('.hero-bg img');
      if (!img) return;
      const tiltX = Math.max(-10, Math.min(10, e.gamma || 0));
      const tiltY = Math.max(-10, Math.min(10, (e.beta || 0) - 45));
      img.style.transform = \`scale(1.08) translate(\${tiltX * 0.5}px, \${tiltY * 0.3}px)\`;
    });
  }
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      navigator.clipboard?.writeText(location.href);
      this.innerHTML = '<svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:currentColor"><path d="M20 6L9 17l-5-5"/></svg> Copié !';
      setTimeout(() => {
        this.innerHTML = '<svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:currentColor"><path d="M13.5 3H12H8C6.4 3 5 4.4 5 6v15l7-3 7 3V6c0-1.6-1.4-3-3-3h-2.5z"/></svg> Copier le lien';
      }, 2000);
    });
  }
});
</script>
</body>
</html>`;
}

/* ─────────────────────────────────────────────
   SITEMAP
───────────────────────────────────────────── */
function generateSitemap(reviews, ccfArticles) {
  const staticPages = ['', 'full-reviews.html', 'ccf-archives.html', 'tops-archives.html', 'a-propos.html'];
  const today = new Date().toISOString().split('T')[0];
  const urls = [
    ...staticPages.map(p => `<url><loc>${SITE_URL}/${p}</loc><lastmod>${today}</lastmod></url>`),
    ...reviews.map(r => `<url><loc>${SITE_URL}/${pageDirName(r.slug)}/</loc><lastmod>${today}</lastmod></url>`),
    ...ccfArticles.map(a => `<url><loc>${SITE_URL}/${pageDirNameCcf(a.slug)}/</loc><lastmod>${today}</lastmod></url>`)
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  fs.writeFileSync('sitemap.xml', xml);
}

/* ─────────────────────────────────────────────
   MAIN
───────────────────────────────────────────── */
async function fetchReviews() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews?select=*&publie=eq.true&order=id.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(`Erreur Supabase (reviews): ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchCcfArticles() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ccf?select=*&order=id.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(`Erreur Supabase (ccf): ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchCcfSections(ccfId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ccf_sections?ccf_id=eq.${ccfId}&select=*&order=ordre.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(`Erreur Supabase (ccf_sections, id ${ccfId}): ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log('Récupération des reviews publiées depuis Supabase…');
  const allReviews = await fetchReviews();
  console.log(`${allReviews.length} review(s) trouvée(s).`);

  for (const r of allReviews) {
    if (!r.slug) {
      console.warn(`⚠️  Review "${r.title}" (id ${r.id}) n'a pas de slug, ignorée.`);
      continue;
    }
    const dirName = pageDirName(r.slug);
    fs.mkdirSync(dirName, { recursive: true });
    fs.writeFileSync(path.join(dirName, 'index.html'), buildPage(r, allReviews));
    console.log(`✔ ${dirName}/index.html`);
  }

  console.log('\nRécupération des articles "Comment c\'est fait ?" depuis Supabase…');
  const allCcf = await fetchCcfArticles();
  console.log(`${allCcf.length} article(s) CCF trouvé(s).`);

  for (const a of allCcf) {
    if (!a.slug) {
      console.warn(`⚠️  Article CCF "${a.title}" (id ${a.id}) n'a pas de slug, ignoré.`);
      continue;
    }
    const sections = await fetchCcfSections(a.id);
    const dirName = pageDirNameCcf(a.slug);
    fs.mkdirSync(dirName, { recursive: true });
    fs.writeFileSync(path.join(dirName, 'index.html'), buildCcfPage(a, sections));
    console.log(`✔ ${dirName}/index.html`);
  }

  generateSitemap(allReviews, allCcf);
  console.log('✔ sitemap.xml mis à jour');
  console.log('\nTerminé.');
}

main().catch(err => {
  console.error('Erreur :', err);
  process.exit(1);
});
