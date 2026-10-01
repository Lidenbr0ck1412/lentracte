/* ─────────────────────────────────────────────
   NEWSLETTER — envoi du formulaire vers MailerLite
   ─────────────────────────────────────────────
   À REMPLIR UNE SEULE FOIS avec les deux numéros qui se trouvent
   dans le code d'intégration de ton formulaire MailerLite.
   Cherche une adresse de ce genre dans le code qu'il te donne :
     https://assets.mailerlite.com/jsonp/123456/forms/987654321/subscribe
                                         ^^^^^^       ^^^^^^^^^
                                       accountId       formId
───────────────────────────────────────────── */
const NL_CONFIG = {
  accountId: '2655209',
  formId: '199842972683994320'   // formulaire « Bas des articles »
};

(function () {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function track(name, data) {
    try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) {}
  }

  // Le talon du billet se déchire, puis le message de confirmation apparaît
  function tearTicket(ticket) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ticket.classList.add('nl-tearing');
    setTimeout(() => {
      ticket.classList.remove('nl-tearing');
      ticket.classList.add('nl-done');
    }, reduce ? 50 : 1000);
  }

  function init(ticket) {
    const form = ticket.querySelector('.nl-form');
    const input = ticket.querySelector('.nl-input');
    const btn = ticket.querySelector('.nl-btn');
    const msg = ticket.querySelector('.nl-msg');
    const hp = ticket.querySelector('.nl-hp');
    const source = ticket.dataset.source || 'article';
    if (!form || !input) return;

    input.addEventListener('input', () => { input.classList.remove('nl-invalid'); msg.textContent = ''; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = input.value.trim();

      if (hp && hp.value) return; // robot

      if (!EMAIL_RE.test(email)) {
        input.classList.remove('nl-invalid'); void input.offsetWidth; input.classList.add('nl-invalid');
        msg.textContent = 'Oups, cette adresse email ne semble pas valide.';
        input.focus();
        return;
      }

      // Mode test : ajoute #test-newsletter à la fin de l'adresse de la page
      // pour voir l'animation sans vraiment inscrire l'adresse.
      if (location.hash === '#test-newsletter') {
        tearTicket(ticket);
        return;
      }

      if (!NL_CONFIG.accountId || !NL_CONFIG.formId) {
        console.warn('[Newsletter] NL_CONFIG.accountId / formId à compléter dans newsletter.js');
        msg.textContent = 'Les inscriptions ouvrent très bientôt. Reviens vite !';
        return;
      }

      btn.disabled = true;
      msg.textContent = '';

      const body = new FormData();
      body.append('fields[email]', email);
      body.append('ml-submit', '1');
      body.append('anticsrf', 'true');

      // Le billet se déchire tout de suite : l'envoi vers MailerLite continue
      // en arrière-plan (keepalive : il aboutit même si le lecteur quitte la page).
      // En mode 'no-cors', MailerLite ne renvoie de toute façon pas de réponse lisible.
      tearTicket(ticket);
      track('newsletter-inscription', { source, page: location.pathname });
      try {
        fetch(
          `https://assets.mailerlite.com/jsonp/${NL_CONFIG.accountId}/forms/${NL_CONFIG.formId}/subscribe`,
          { method: 'POST', body, mode: 'no-cors', keepalive: true }
        ).catch(() => {});
      } catch (err) {}
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const tickets = document.querySelectorAll('.nl-ticket');
    tickets.forEach(init);
    // Compte l'affichage du formulaire dans les statistiques MailerLite (onglet Analytics)
    if (tickets.length && NL_CONFIG.accountId && NL_CONFIG.formId) {
      try { fetch(`https://assets.mailerlite.com/jsonp/${NL_CONFIG.accountId}/forms/${NL_CONFIG.formId}/takel`, { mode: 'no-cors' }).catch(() => {}); } catch (e) {}
    }
  });
})();
