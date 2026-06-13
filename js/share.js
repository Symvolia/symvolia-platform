(function () {
  'use strict';

  const linkEl = document.getElementById('publicLink');
  const openBtn = document.getElementById('openBtn');
  const copyBtn = document.getElementById('copyBtn');
  const copyHint = document.getElementById('copyHint');

  if (!linkEl || !openBtn || !copyBtn) return;

  function applyUrl(url) {
    const trimmed = url.trim();
    if (!trimmed) return;

    linkEl.textContent = trimmed;
    linkEl.href = trimmed;
    openBtn.href = trimmed;
    copyBtn.disabled = false;
  }

  function loadLink() {
    fetch('assets/site-link.txt', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('missing');
        return res.text();
      })
      .then(applyUrl)
      .catch(() => {
        const fallback = window.location.origin + window.location.pathname.replace(/share\.html$/, 'index.html');
        if (window.location.protocol.startsWith('http')) {
          applyUrl(window.location.origin);
        } else {
          linkEl.textContent = 'Link not available — open from the live server.';
        }
        openBtn.href = fallback;
      });
  }

  copyBtn.addEventListener('click', async () => {
    const url = linkEl.href;
    if (!url || url === '#') return;

    try {
      await navigator.clipboard.writeText(url);
      if (copyHint) {
        copyHint.hidden = false;
        window.setTimeout(() => {
          copyHint.hidden = true;
        }, 2200);
      }
    } catch {
      window.prompt('Copy link:', url);
    }
  });

  loadLink();
})();
