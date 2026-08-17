(function () {
  'use strict';

  const PERMANENT_URL = 'https://symvolia.xyz/';
  const linkEl = document.getElementById('publicLink');
  const permanentLink = document.getElementById('permanentLink');
  const openBtn = document.getElementById('openBtn');
  const copyBtn = document.getElementById('copyBtn');
  const copyPermanentBtn = document.getElementById('copyPermanentBtn');
  const copyHint = document.getElementById('copyHint');
  const tunnelCard = linkEl && linkEl.closest('.share__card');

  if (!linkEl || !openBtn || !copyBtn) return;

  function applyTunnelUrl(url) {
    const trimmed = url.trim();
    if (!trimmed || trimmed === PERMANENT_URL.trim()) return false;

    linkEl.textContent = trimmed;
    linkEl.href = trimmed;
    copyBtn.disabled = false;
    if (tunnelCard) tunnelCard.hidden = false;
    return true;
  }

  function hideTunnelCard() {
    if (tunnelCard) tunnelCard.hidden = true;
    linkEl.textContent = 'Not active';
    linkEl.removeAttribute('href');
    copyBtn.disabled = true;
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

  function loadTunnelLink() {
    fetch('assets/site-link-tunnel.txt', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('missing');
        return res.text();
      })
      .then((text) => {
        if (!applyTunnelUrl(text)) hideTunnelCard();
      })
      .catch(() => {
        if (window.location.protocol.startsWith('http') &&
            window.location.hostname.endsWith('.trycloudflare.com')) {
          applyTunnelUrl(window.location.origin);
          return;
        }
        hideTunnelCard();
      });
  }

  if (permanentLink) {
    permanentLink.href = PERMANENT_URL;
    permanentLink.textContent = 'symvolia.xyz';
  }

  if (openBtn) {
    openBtn.href = PERMANENT_URL;
  }

  copyBtn.addEventListener('click', () => copyUrl(linkEl.href));

  if (copyPermanentBtn) {
    copyPermanentBtn.addEventListener('click', () => copyUrl(PERMANENT_URL));
  }

  loadTunnelLink();
})();
