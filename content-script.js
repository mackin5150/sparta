// content-script.js — generic media extractor, suggestions overlay, and extract_page responder
(function(){
  // Lightweight site config: add more sites/selectors as needed
  var SITE_CONFIG = [
    {
      hostContains: 'dailymotion.com',
      itemSelector: '.media-block, .media, .video_item, .media__content',
      titleSelector: 'h3, h2, .media-title, .title',
      linkSelector: 'a[href*="/video/"], a[href*="/video/"]'
    },
    {
      hostContains: 'flickr.com',
      itemSelector: '.photo-list-photo-view, .view, .photo-list-photo',
      imgSelector: 'img',
      linkSelector: 'a[href*="/photos/"]',
      titleSelector: 'img[alt]'
    },
    {
      hostContains: 'vimeo.com',
      itemSelector: '.iris_poster, .clip, .video, .iris_video-vital__poster',
      linkSelector: 'a[href*="/videos/"], a[href*="/video/"]',
      titleSelector: '.title, h3, h2'
    },
    {
      hostContains: 'peertube',
      itemSelector: '.card, .video-card, .video-thumb, .media-card',
      linkSelector: 'a[href*="/w/"], a[href*="/videos/"], a[href*="/watch/"]',
      titleSelector: '.title, h3, h2'
    }
    // Add more site configs here as needed
  ];

  function extractPageExcerpt() {
    var nodes = Array.from(document.querySelectorAll('h1, h2, h3, p, li'))
      .map(e => e.innerText)
      .filter(Boolean);
    var combined = nodes.slice(0, 80).join('\n\n');
    return combined.slice(0, 600);
  }

  function resolveUrl(href) {
    try { return (new URL(href, location.href)).href; } catch (e) { return href; }
  }

  function genericCardFinder() {
    var anchors = Array.from(document.querySelectorAll('a[href]'));
    var candidates = anchors.filter(function(a) {
      var h = a.getAttribute('href') || '';
      if (!h) return false;
      var L = h.toLowerCase();
      return L.indexOf('/watch') !== -1 || L.indexOf('/video') !== -1 || L.indexOf('/videos') !== -1 ||
             L.indexOf('/photos') !== -1 || L.match(/\.(jpg|jpeg|png|gif)$/);
    }).map(function(a) {
      var title = (a.textContent || a.getAttribute('title') || '').trim();
      if (!title) {
        var img = a.querySelector('img');
        if (img) title = img.getAttribute('alt') || img.getAttribute('title') || '';
      }
      return { title: title || '', url: resolveUrl(a.href || a.getAttribute('href')), excerpt: (title || '').slice(0,200) };
    });
    var seen = {};
    return candidates.filter(function(c) {
      if (!c.url) return false;
      if (seen[c.url]) return false;
      seen[c.url] = true;
      return true;
    });
  }

  function extractMediaCards() {
    var host = location.hostname || '';
    var cfg = SITE_CONFIG.find(function(c) { return host.indexOf(c.hostContains) !== -1; });
    var cards = [];
    if (cfg) {
      var items = [];
      try {
        if (cfg.itemSelector) items = Array.from(document.querySelectorAll(cfg.itemSelector));
      } catch (e) { items = []; }
      if (items.length === 0) items = Array.from(document.querySelectorAll('a[href]')).slice(0, 200);
      items.forEach(function(node) {
        try {
          var link = null;
          if (cfg.linkSelector) link = node.querySelector(cfg.linkSelector) || node.querySelector('a[href]');
          if (!link && node.tagName && node.tagName.toLowerCase() === 'a') link = node;
          if (!link) return;
          var href = link.href || link.getAttribute('href');
          if (!href) return;
          var title = '';
          if (cfg.titleSelector) {
            var tnode = node.querySelector(cfg.titleSelector) || link;
            title = tnode ? (tnode.innerText || tnode.getAttribute('title') || '') : '';
          } else {
            title = (link.innerText || link.getAttribute('title') || '').trim();
          }
          if (!title) {
            var img = node.querySelector('img') || link.querySelector('img');
            if (img) title = img.getAttribute('alt') || img.getAttribute('title') || '';
          }
          cards.push({ title: (title||'').trim(), url: resolveUrl(href), excerpt: (title||'').slice(0,200) });
        } catch (e) { /* ignore item */ }
      });
    } else {
      cards = genericCardFinder();
    }
    var seen = {};
    var out = [];
    for (var i = 0; i < cards.length && out.length < 50; i++) {
      var c = cards[i];
      if (!c || !c.url) continue;
      if (seen[c.url]) continue;
      seen[c.url] = true;
      out.push(c);
    }
    return out;
  }

  function maybeSendPageIndex() {
    var doc = {
      title: document.title || '',
      url: location.href,
      excerpt: extractPageExcerpt(),
      site: location.hostname
    };
    chrome.runtime.sendMessage({ type: 'maybe_index', doc: doc }, function(res) {
      if (res && res.ok) console.log('Auto-index saved', res);
    });
  }

  function sendMediaBatch() {
    var cards = extractMediaCards();
    if (!cards || cards.length === 0) return;
    chrome.runtime.sendMessage({ type: 'multi_index', docs: cards.slice(0, 20) }, function(res) {
      if (res) console.log('multi_index result', res);
    });
  }

  // respond to background when it asks for an extract for manual indexing
  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg && msg.type === 'extract_page') {
      try {
        var page = {
          title: document.title || '',
          url: location.href,
          excerpt: extractPageExcerpt()
        };
        sendResponse(page);
      } catch (e) {
        sendResponse(null);
      }
      return true; // keep sendResponse alive (not strictly necessary here)
    }
  });

  // Suggestions overlay (same as earlier)
  var suggestionsPanel = null;
  function showSuggestions(results) {
    try {
      if (!suggestionsPanel) {
        suggestionsPanel = document.createElement('div');
        suggestionsPanel.id = 'personal-search-suggestions';
        var css = `
#personal-search-suggestions { position: fixed; right: 12px; top: 80px; width: 320px; max-height: 420px; overflow:auto; background: rgba(255,255,255,0.98); border:1px solid rgba(0,0,0,0.08); box-shadow:0 6px 18px rgba(0,0,0,0.12); z-index:2147483647; padding:8px; font-family: Arial, sans-serif; font-size:13px; color:#111; border-radius:8px; }
#personal-search-suggestions h4 { margin: 4px 0 8px; font-size:14px; }
.ps-item { padding:6px; border-bottom:1px solid #eee; }
.ps-item a { color:#065fd4; text-decoration:none; font-weight:600; }
.ps-item .url { font-size:12px; color:#666; margin-top:4px; display:block; }
.ps-close { position:absolute; right:6px; top:6px; cursor:pointer; color:#666; }
`;
        var style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        document.body.appendChild(suggestionsPanel);
      }
      suggestionsPanel.innerHTML = '<h4>Suggested from your index <span class="ps-close">✕</span></h4>';
      var closeBtn = suggestionsPanel.querySelector('.ps-close');
      if (closeBtn) closeBtn.addEventListener('click', function() { suggestionsPanel.style.display = 'none'; });

      (results || []).forEach(function(r) {
        var div = document.createElement('div');
        div.className = 'ps-item';
        var title = r.title ? escapeHtml(r.title) : (r.url || '');
        var url = r.url || '#';
        var excerpt = r.excerpt ? escapeHtml(r.excerpt).slice(0,200) : '';
        try {
          var host = (new URL(url)).hostname;
        } catch (e) {
          var host = '';
        }
        div.innerHTML = '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + title + '</a>' +
                        '<span class="url">' + host + '</span>' +
                        '<div class="excerpt">' + excerpt + '</div>';
        suggestionsPanel.appendChild(div);
      });
    } catch (e) { console.error('showSuggestions error', e); }
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
    });
  }

  // Initial actions on load
  try { maybeSendPageIndex(); } catch (e) { console.error(e); }

  // If media-heavy site send media batch initially and on mutations
  var host = location.hostname || '';
  var isMediaSite = SITE_CONFIG.some(function(c){ return host.indexOf(c.hostContains) !== -1; }) ||
                    ['dailymotion.com','flickr.com','vimeo.com','peertube'].some(function(d){ return host.indexOf(d) !== -1; });

  if (isMediaSite) {
    sendMediaBatch();
    var timer = null;
    var mo = new MutationObserver(function() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function(){ sendMediaBatch(); }, 1500);
    });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
  }

  // Request suggestions based on page title
  try {
    var query = document.title || '';
    if (query && query.length > 2) {
      chrome.runtime.sendMessage({ type: 'page_context_search', query: query, top_k: 6 }, function(res) {
        if (!res || res.error) return;
        if (res.results && res.results.length) showSuggestions(res.results);
      });
    }
  } catch (e) { console.error(e); }

})();
