// src/renderer/dashboard/panels/heroTiles.js
(function () {
  const WOW_NOTE = 'vs. your weekly average';

  function badge(d) {
    if (!d) return '';
    const arrow = d.dir === 'up' ? '\u25b2 ' : '\u25bc ';
    return `<span class="hero-delta ${d.good ? 'good' : 'bad'}" title="${WOW_NOTE}">${arrow}${escapeHtml(d.text)}</span>`;
  }

  function render(state) {
    const el = document.getElementById('hero-grid');
    const { heroTiles } = state;
    const d = state.heroDeltas || {};
    el.innerHTML = `
    <div class="hero-tile"><div class="hero-tile-top"><div class="hero-label">Burn now</div>${badge(d.burn)}</div><div class="hero-value accent">${formatTokens(heroTiles.burnRate)}</div><div class="hero-sub">tokens / min</div></div>
    <div class="hero-tile"><div class="hero-tile-top"><div class="hero-label">Spend</div>${badge(d.spend)}</div><div class="hero-value">$${heroTiles.spend.toFixed(2)}</div><div class="hero-sub">${formatTokens(heroTiles.spendTokens)} tokens</div></div>
    <div class="hero-tile"><div class="hero-tile-top"><div class="hero-label">Cache hit</div>${badge(d.cacheHit)}</div><div class="hero-value">${Math.round(heroTiles.cacheHitRate * 100)}%</div><div class="hero-sub good">healthy</div></div>
    <div class="hero-tile"><div class="hero-tile-top"><div class="hero-label">1-shot rate</div>${badge(d.oneShot)}</div><div class="hero-value">${heroTiles.oneShotRate == null ? '--' : Math.round(heroTiles.oneShotRate * 100) + '%'}</div><div class="hero-sub">coding turns</div></div>
  `;
  }
  window.TT.heroTiles = { render };
})();
