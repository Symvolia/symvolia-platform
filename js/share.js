(function () {
  'use strict';

  const PERMANENT_URL = 'https://symvolia.github.io/symvolia-platform/';
  const linkEl = document.getElementById('publicLink');
  const permanentLink = document.getElementById('permanentLink');
  const openBtn = document.getElementById('openBtn');
  const copyBtn = document.getElementById('copyBtn');
  const copyPermanentBtn = document.getElementById('copyPermanentBtn');
  const copyHint = document.getElementById('copyHint');

  if (!linkEl || !openBtn || !copyBtn) return;

  function applyUrl(url) {
    const trimmed = url.trim();
    if (!trimmed) return;

    linkEl.textContent = trimmed;
    linkEl.href = trimmed;
    copyBtn.disabled = false;
  }

  function showCopyHint() {
    if (!copyHint) return;
    copyHint.hidden = false;
    window.setTimeout(() => {
      copyHint.hidden = true;
    }, 2200);
  }

  async function copyUrl(url) {
    if (!url || url === '#') return;

    try {
      await navigator.clipboard.writeText(url);
      showCopyHint();
    } catch {
      window.prompt('Copy link:', url);
    }
  }

  function loadLink() {
    fetch('assets/site-link.txt', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('missing');
        return res.text();
      })
      .then(applyUrl)
      .catch(() => {
        if (window.location.protocol.startsWith('http') &&
            window.location.hostname.endsWith('.trycloudflare.com')) {
          applyUrl(window.location.origin);
          return;
        }

        linkEl.textContent = 'Tunnel not ready — refresh in a moment.';
        linkEl.removeAttribute('href');
      });
  }

  if (permanentLink) {
    permanentLink.href = PERMANENT_URL;
    permanentLink.textContent = PERMANENT_URL;
  }

  if (openBtn) {
    openBtn.href = PERMANENT_URL;
  }

  copyBtn.addEventListener('click', () => copyUrl(linkEl.href));

  if (copyPermanentBtn) {
    copyPermanentBtn.addEventListener('click', () => copyUrl(PERMANENT_URL));
  }

  loadLink();
})();
