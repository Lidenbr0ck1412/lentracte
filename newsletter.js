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
  accountId: '', // ex : '123456'
  formId: ''     // ex : '987654321'
};

(function () {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function track(name, data) {
    try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) {}
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

      try {
        const res = await fetch(
          `https://assets.mailerlite.com/jsonp/${NL_CONFIG.accountId}/forms/${NL_CONFIG.formId}/subscribe`,
          { method: 'POST', body }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error('subscribe failed');
        ticket.classList.add('nl-done');
        track('newsletter-inscription', { source, page: location.pathname });
      } catch (err) {
        msg.textContent = "Une erreur est survenue. Réessaie dans un instant.";
        btn.disabled = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nl-ticket').forEach(init);
  });
})();
