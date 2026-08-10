// theme.js — toggle clair/sombre pour L'Entracte
// À inclure sur chaque page HTML (index, review, ccf, full-reviews, tops...)
// via : <script src="theme.js"></script>

(function () {
  // Applique le thème sauvegardé le plus tôt possible pour éviter le flash
  const saved = localStorage.getItem('lentracte-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);

  function updateIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    // Icône soleil en mode sombre (pour passer au clair), lune en mode clair
    icon.innerHTML = theme === 'dark'
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
      : '<path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>';
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateIcon(saved);
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('lentracte-theme', next);
      updateIcon(next);
    });
  });
})();
