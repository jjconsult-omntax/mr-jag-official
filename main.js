(function () {
  'use strict';

  // Helper: safe element getter
  const $ = id => document.getElementById(id);

  /* ─── 1. DARK / LIGHT THEME TOGGLE (guarded) ─── */
  const themeBtn = $('theme-toggle');
  const html = document.documentElement;
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      try { localStorage.setItem('jag-theme', next); } catch (e) { /* ignore */ }
    });
  }

  /* ─── 2. MOBILE NAV & SCROLL LOCK (guarded) ─── */
  const navToggle = $('nav-toggle');
  const navLinks = $('nav-links');
  const mobileClose = $('mobile-nav-close');

  function toggleNav(open) {
    if (!navLinks || !navToggle) return;
    navLinks.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open);
    navToggle.textContent = open ? '✕' : '☰';
    navToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (navToggle && navLinks) navToggle.addEventListener('click', () => toggleNav(!navLinks.classList.contains('open')));
  if (mobileClose) mobileClose.addEventListener('click', () => toggleNav(false));

  /* ─── 3. SEARCH MODAL WITH CLIENT-SIDE FILTERING (safer + focus trap) ─── */
  const searchBtn = $('search-btn');
  const searchOverlay = $('search-overlay');
  const searchInput = $('search-input');
  const searchClose = $('search-close');
  const searchResults = $('search-results');
  const searchAnnouncer = $('search-announcer');

  // Build search index safely from all [data-search] elements
  const searchIndex = [];
  document.querySelectorAll('[data-search]').forEach(el => {
    const h = el.querySelector('h2, h3');
    const tag = el.querySelector('.tag');
    if (h) {
      searchIndex.push({
        title: h.textContent.trim(),
        tag: tag ? tag.textContent.trim() : '',
        keywords: ((el.dataset.search || '') + ' ' + h.textContent).toLowerCase(),
        el
      });
    }
  });

  // Focus trap helpers
  let _prevFocus = null;
  function trapFocus(el) {
    if (!el) return;
    const focusableSel = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const nodes = Array.from(el.querySelectorAll(focusableSel)).filter(n => n.offsetParent !== null || n === document.activeElement);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    function keyHandler(e) {
      if (e.key !== 'Tab') return;
      if (nodes.length === 0) { e.preventDefault(); return; }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    el.__trapKey = keyHandler;
    el.addEventListener('keydown', keyHandler);
  }
  function releaseFocusTrap(el) {
    if (!el || !el.__trapKey) return;
    el.removeEventListener('keydown', el.__trapKey);
    delete el.__trapKey;
  }

  function createSearchResultNode(m, idx, onSelect) {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.setAttribute('role', 'option');
    item.setAttribute('tabindex', '0');
    item.dataset.idx = String(idx);

    const tag = document.createElement('div'); tag.className = 'sr-tag'; tag.textContent = m.tag;
    const title = document.createElement('div'); title.className = 'sr-title'; title.textContent = m.title;
    item.appendChild(tag); item.appendChild(title);

    item.addEventListener('click', onSelect);
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSelect(); });
    return item;
  }

  function performSearch(query) {
    if (!searchResults || !searchAnnouncer || !searchInput) return;
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      searchResults.classList.remove('has-results');
      searchResults.innerHTML = '';
      searchAnnouncer.textContent = '';
      return;
    }

    const terms = q.split(/\s+/);
    const matches = searchIndex.filter(item => terms.every(t => item.keywords.includes(t)));

    // Clear prior
    searchResults.innerHTML = '';

    if (matches.length === 0) {
      const no = document.createElement('div'); no.className = 'search-no-results';
      no.textContent = 'No results found for "' + query + '"';
      searchResults.appendChild(no);
    } else {
      matches.forEach((m, i) => {
        const node = createSearchResultNode(m, i, () => {
          closeSearch();
          try {
            matches[i].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            matches[i].el.style.outline = '2px solid var(--accent)';
            setTimeout(() => { matches[i].el.style.outline = ''; }, 2000);
          } catch (e) { /* ignore */ }
        });
        searchResults.appendChild(node);
      });
    }

    searchResults.classList.add('has-results');
    searchAnnouncer.textContent = matches.length === 0 ? 'No results found.' : matches.length + ' results found. Use up and down arrows to navigate.';
  }

  let searchDebounce;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => performSearch(searchInput.value), 200);
    });

    // Arrow key navigation: down moves to first result
    searchInput.addEventListener('keydown', (e) => {
      if (!searchResults) return;
      const items = searchResults.querySelectorAll('.search-result-item');
      if (!items || items.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); items[0].focus(); }
    });
  }

  if (searchResults) {
    searchResults.addEventListener('keydown', (e) => {
      const items = Array.from(searchResults.querySelectorAll('.search-result-item'));
      const idx = items.indexOf(document.activeElement);
      if (idx < 0) return;
      if (e.key === 'ArrowDown' && idx < items.length - 1) { e.preventDefault(); items[idx + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (idx === 0) searchInput && searchInput.focus(); else items[idx - 1].focus(); }
    });
  }

  function openSearch() {
    if (!searchOverlay || !searchInput) return;
    _prevFocus = document.activeElement;
    searchOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    trapFocus(searchOverlay);
    searchInput.focus();
  }
  function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.remove('open');
    if (searchInput) { searchInput.value = ''; }
    if (searchResults) { searchResults.classList.remove('has-results'); searchResults.innerHTML = ''; }
    if (searchAnnouncer) { searchAnnouncer.textContent = ''; }
    document.body.style.overflow = '';
    releaseFocusTrap(searchOverlay);
    try { _prevFocus && _prevFocus.focus && _prevFocus.focus(); } catch (e) { /* ignore */ }
  }
  if (searchBtn) searchBtn.addEventListener('click', openSearch);
  if (searchClose) searchClose.addEventListener('click', closeSearch);
  if (searchOverlay) searchOverlay.addEventListener('click', e => { if (e.target === searchOverlay) closeSearch(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && searchOverlay && searchOverlay.classList.contains('open')) closeSearch();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); if (searchOverlay) openSearch(); }
  });

  /* ─── 4. CATEGORY TABS + URL HASH ROUTING (guarded) ─── */
  const tabs = document.querySelectorAll('.cat-tab');
  const allItems = document.querySelectorAll('[data-category]');
  if (tabs && tabs.length) {
    function activateTab(cat) {
      tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.category === cat ? 'true' : 'false'));
      allItems.forEach(item => {
        item.style.display = (cat === 'all' || (item.dataset.category && item.dataset.category.split(' ').includes(cat))) ? '' : 'none';
      });
    }
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const cat = tab.dataset.category;
        activateTab(cat);
        history.replaceState(null, '', cat === 'all' ? location.pathname : '#' + cat);
      });
      tab.addEventListener('keydown', e => {
        const arr = Array.from(tabs);
        const idx = arr.indexOf(tab);
        let target;
        if (e.key === 'ArrowRight') target = arr[(idx + 1) % arr.length];
        if (e.key === 'ArrowLeft') target = arr[(idx - 1 + arr.length) % arr.length];
        if (target) { e.preventDefault(); target.focus(); target.click(); }
      });
    });

    const validCategories = Array.from(tabs).map(t => t.dataset.category);
    const hash = location.hash.replace('#', '');
    if (hash && validCategories.includes(hash)) activateTab(hash);
    window.addEventListener('hashchange', () => {
      const h = location.hash.replace('#', '');
      if (h) activateTab(h); else activateTab('all');
    });
  }

  /* ─── 5. NEWSLETTER WITH SPINNER (guarded) ─── */
  const nlForm = $('newsletter-form');
  const nlEmail = $('newsletter-email');
  const nlStatus = $('newsletter-status');
  const nlBtn = $('nl-btn');
  if (nlForm && nlEmail && nlStatus && nlBtn) {
    nlForm.addEventListener('submit', e => {
      e.preventDefault();
      const email = (nlEmail.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        nlEmail.setAttribute('aria-invalid', 'true');
        nlStatus.textContent = 'Please enter a valid email address.';
        nlStatus.className = 'newsletter-msg error';
        return;
      }
      nlEmail.removeAttribute('aria-invalid');
      nlBtn.disabled = true;
      nlBtn.innerHTML = '<span class="btn-spinner"></span>';

      // TODO: replace with a secure server-side endpoint
      setTimeout(() => {
        nlStatus.textContent = '\u2713 You\'re in! Check your inbox this Sunday.';
        nlStatus.className = 'newsletter-msg success';
        nlEmail.value = '';
        nlBtn.disabled = false;
        nlBtn.innerHTML = 'Join';
      }, 1400);
    });
  }

  /* ─── 6. LIVE STOCK DATA (Finnhub) — safer rendering to DOM ─── */
  const SYMBOLS = [
    {s:'SPY',n:'S&P 500'},{s:'QQQ',n:'Nasdaq 100'},{s:'AAPL',n:'Apple'},{s:'TSLA',n:'Tesla'},{s:'NVDA',n:'NVIDIA'},{s:'MSFT',n:'Microsoft'},{s:'AMZN',n:'Amazon'},{s:'META',n:'Meta'},{s:'GOOGL',n:'Alphabet'},{s:'AMD',n:'AMD'}
  ];
  const MOVERS = [
    {s:'NVDA',n:'NVIDIA Corp'},{s:'TSLA',n:'Tesla Inc'},{s:'AAPL',n:'Apple Inc'},{s:'META',n:'Meta Platforms'},{s:'AMZN',n:'Amazon'}
  ];
  const FB = { SPY:[548.32,1.24],QQQ:[467.15,1.67],AAPL:[198.50,0.82],TSLA:[245.18,-2.31],NVDA:[892.40,3.45],MSFT:[420.67,0.54],AMZN:[185.30,1.12],META:[502.14,1.89],GOOGL:[175.88,-0.42],AMD:[162.35,2.18] };

  function createTickerItem(sym, price, pct) {
    const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
    const sign = pct > 0 ? '+' : '';
    const span = document.createElement('span'); span.className = 'ticker-item';
    span.setAttribute('aria-label', sym + ': $' + price.toFixed(2) + ', ' + sign + pct.toFixed(2) + '%');
    const sSym = document.createElement('span'); sSym.className = 'symbol'; sSym.textContent = sym;
    const sPrice = document.createElement('span'); sPrice.className = 'price'; sPrice.textContent = '$' + price.toFixed(2);
    const sChange = document.createElement('span'); sChange.className = 'change ' + dir; sChange.textContent = sign + pct.toFixed(2) + '%';
    span.appendChild(sSym); span.appendChild(sPrice); span.appendChild(sChange);
    return span;
  }
  function createMoverRow(sym, name, price, pct) {
    const row = document.createElement('div'); row.className = 'mover-row';
    const left = document.createElement('div');
    const sSym = document.createElement('div'); sSym.className = 'mover-symbol'; sSym.textContent = sym;
    const sName = document.createElement('div'); sName.className = 'mover-name'; sName.textContent = name;
    left.appendChild(sSym); left.appendChild(sName);
    const p = document.createElement('div'); p.className = 'mover-price'; p.textContent = '$' + price.toFixed(2);
    const c = document.createElement('div'); c.className = 'mover-change ' + (pct > 0 ? 'up' : 'down'); c.textContent = (pct > 0 ? '+' : '') + pct.toFixed(2) + '%';
    row.appendChild(left); row.appendChild(p); row.appendChild(c);
    return row;
  }

  function renderFallback() {
    const track = $('ticker-track');
    const movers = $('market-movers-list');
    if (track) {
      track.innerHTML = '';
      const nodes = SYMBOLS.map(s => createTickerItem(s.s, FB[s.s][0], FB[s.s][1]));
      nodes.concat(nodes).forEach(n => track.appendChild(n.cloneNode(true)));
    }
    if (movers) {
      movers.innerHTML = '';
      MOVERS.forEach(m => movers.appendChild(createMoverRow(m.s, m.n, FB[m.s][0], FB[m.s][1])));
    }
  }


async function loadLive() {
    const track = $('ticker-track');
    const movers = $('market-movers-list');

    try {
      // 🚨 Pointing to the new secure serverless function
      const response = await fetch('/.netlify/functions/stock-quotes');
      if (!response.ok) throw new Error('Network error');
      const quotes = await response.json();

      if (!quotes || !quotes.every(q => q && typeof q.c === 'number')) { renderFallback(); return; }

      if (track) {
        track.innerHTML = '';
        SYMBOLS.forEach((s, i) => {
          const q = quotes[i];
          const price = typeof q.c === 'number' ? q.c : FB[s.s][0];
          let pct = 0;
          if (typeof q.dp === 'number') pct = q.dp;
          else if (q.pc && q.pc !== 0) pct = (price - q.pc) / q.pc * 100;
          track.appendChild(createTickerItem(s.s, price, pct));
        });
        const children = Array.from(track.children).map(n => n.cloneNode(true));
        children.forEach(n => track.appendChild(n));
      }

      if (movers) {
        movers.innerHTML = '';
        MOVERS.forEach(m => {
          const idx = SYMBOLS.findIndex(s => s.s === m.s);
          const q = idx >= 0 ? quotes[idx] : null;
          if (!q || typeof q.c !== 'number') movers.appendChild(createMoverRow(m.s, m.n, FB[m.s][0], FB[m.s][1]));
          else {
            const price = q.c;
            let pct = typeof q.dp === 'number' ? q.dp : (q.pc && q.pc !== 0 ? (price - q.pc) / q.pc * 100 : 0);
            movers.appendChild(createMoverRow(m.s, m.n, price, pct));
          }
        });
      }
    } catch (e) {
      renderFallback();
    }
  }

  // Actually run the function and set the timer!
  loadLive();
  try { setInterval(loadLive, 60000); } catch (e) { /* ignore */ }

})();