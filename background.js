// MV2 background.js — whitelist stored in chrome.storage.local + auto-index handlers
var SERVER_BASE = 'https://sparta-97q0.onrender.com'; // update if needed
var EMBED_RATE_LIMIT_MS = 1000 * 60 * 30; // 30 minutes between automatic indexing per URL

// Default whitelist used if none is stored
var DEFAULT_WHITELIST = [
  'dailymotion.com',
  'flickr.com',
  'vimeo.com',
  'peertube'
];

function postJSON(path, body, cb) {
  fetch(SERVER_BASE + path, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  })
    .then(function(res) { return res.json(); })
    .then(function(j) { cb(null, j); })
    .catch(function(err) { cb(err && err.toString()); });
}

function getWhitelist(cb) {
  chrome.storage.local.get({ whitelist: DEFAULT_WHITELIST }, function(items) {
    cb(items.whitelist || DEFAULT_WHITELIST);
  });
}

function addToWhitelist(domain, cb) {
  if (!domain) return cb && cb(null);
  getWhitelist(function(list) {
    // avoid duplicates (substring check)
    if (!list.some(d => d === domain)) list.push(domain);
    chrome.storage.local.set({ whitelist: list }, function() {
      cb && cb(list);
    });
  });
}

function removeFromWhitelist(domain, cb) {
  getWhitelist(function(list) {
    var idx = list.indexOf(domain);
    if (idx !== -1) list.splice(idx, 1);
    chrome.storage.local.set({ whitelist: list }, function() {
      cb && cb(list);
    });
  });
}

function shouldAutoIndex(hostname, url, callback) {
  if (!hostname) return callback(false, 'no_hostname');
  getWhitelist(function(list) {
    var allowed = list.some(function(d) { return hostname.indexOf(d) !== -1; });
    if (!allowed) return callback(false, 'not_whitelisted');
    chrome.storage.local.get(['lastIndexed'], function(items) {
      var lastIndexed = items.lastIndexed || {};
      var ts = lastIndexed[url] || 0;
      var now = Date.now();
      if (now - ts < EMBED_RATE_LIMIT_MS) {
        return callback(false, 'rate_limited');
      }
      return callback(true, null);
    });
  });
}

function markIndexed(url) {
  chrome.storage.local.get(['lastIndexed'], function(items) {
    var lastIndexed = items.lastIndexed || {};
    lastIndexed[url] = Date.now();
    chrome.storage.local.set({ lastIndexed: lastIndexed });
  });
}

// Helper: index the active tab (used for manual index action)
function indexCurrentTab(addToWhitelistFlag, cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs && tabs[0];
    if (!tab) {
      if (cb) cb({ ok: false, error: 'no_active_tab' });
      return;
    }
    // Ask content script to extract page content
    chrome.tabs.sendMessage(tab.id, { type: 'extract_page' }, function(page) {
      if (chrome.runtime.lastError) {
        if (cb) cb({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      if (!page || !page.excerpt) {
        if (cb) cb({ ok: false, error: 'no_content_extracted' });
        return;
      }

      // Optionally add the hostname to the whitelist
      var hostname = '';
      try { hostname = (new URL(page.url)).hostname; } catch (e) { hostname = ''; }
      if (addToWhitelistFlag && hostname) {
        addToWhitelist(hostname, function() {
          // continue regardless of result
        });
      }

      // Prepare payload (trim to reasonable sizes)
      var payload = {
        title: (page.title || '').slice(0, 300),
        url: page.url,
        text: (page.excerpt || '').slice(0, 2000)
      };

      postJSON('/index', payload, function(err, res) {
        if (err) {
          if (cb) cb({ ok: false, error: String(err) });
          return;
        }
        // mark URL as indexed to honor rate limit
        markIndexed(page.url);
        if (cb) cb(res);
      });
    });
  });
}

// Message handlers: maybe_index, multi_index, page_context_search, whitelist management, index_page
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (!msg || !msg.type) return;

  if (msg.type === 'maybe_index') {
    var doc = msg.doc || {};
    var url;
    try { url = (new URL(doc.url)).href; } catch (e) { url = doc.url; }
    var hostname = (function() {
      try { return (new URL(doc.url)).hostname; } catch (e) { return (doc.site || ''); }
    })();

    shouldAutoIndex(hostname, url, function(allow, reason) {
      if (!allow) {
        sendResponse({ ok: false, reason: reason });
        return;
      }
      var payload = {
        title: (doc.title || '').slice(0, 300),
        url: url,
        text: (doc.excerpt || '').slice(0, 1000)
      };
      postJSON('/index', payload, function(err, res) {
        if (err) {
          console.error('auto index error', err);
          sendResponse({ ok: false, error: String(err) });
          return;
        }
        markIndexed(url);
        sendResponse(res);
      });
    });

    return true;
  }

  if (msg.type === 'multi_index') {
    var docs = msg.docs || [];
    var pending = docs.length;
    var results = [];
    if (pending === 0) { sendResponse({ ok: true, results: [] }); return; }

    docs.forEach(function(d) {
      var url = d.url;
      var hostname = '';
      try { hostname = (new URL(url)).hostname; } catch (e) { hostname = ''; }
      shouldAutoIndex(hostname, url, function(allow) {
        if (!allow) {
          results.push({ url: url, ok: false, reason: 'skipped' });
          if (--pending === 0) sendResponse({ ok: true, results: results });
          return;
        }
        postJSON('/index', { title: (d.title||'').slice(0,300), url: url, text: (d.excerpt||'').slice(0,800) }, function(err,res) {
          if (!err && res && res.ok) markIndexed(url);
          results.push({ url: url, ok: !err && res && res.ok, resp: res, error: err });
          if (--pending === 0) sendResponse({ ok: true, results: results });
        });
      });
    });

    return true;
  }

  if (msg.type === 'page_context_search') {
    var q = msg.query || '';
    postJSON('/search', { query: q, top_k: msg.top_k || 6 }, function(err, res) {
      if (err) return sendResponse({ error: String(err) });
      sendResponse(res);
    });
    return true;
  }

  if (msg.type === 'search') {
    var q2 = msg.query || '';
    postJSON('/search', { query: q2, top_k: msg.top_k || 10 }, function(err, res) {
      if (err) return sendResponse({ error: String(err) });
      sendResponse(res);
    });
    return true;
  }

  // manual index action from popup: add to whitelist and index current tab
  if (msg.type === 'index_page') {
    var addToWhitelistFlag = true; // automatic behavior requested
    indexCurrentTab(addToWhitelistFlag, function(resp) {
      sendResponse(resp);
    });
    return true;
  }

  // Whitelist control messages
  if (msg.type === 'add_whitelist') {
    var domain = msg.domain;
    if (!domain) {
      // if no domain passed, try to get active tab hostname
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var host = '';
        try { host = new URL((tabs[0] && tabs[0].url) || '').hostname; } catch(e) { host = ''; }
        if (!host) return sendResponse({ ok: false, error: 'no_domain_found' });
        addToWhitelist(host, function(list) { sendResponse({ ok: true, whitelist: list }); });
      });
      return true;
    } else {
      addToWhitelist(domain, function(list) { sendResponse({ ok: true, whitelist: list }); });
      return true;
    }
  }

  if (msg.type === 'remove_whitelist') {
    var domainR = msg.domain;
    if (!domainR) {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var host = '';
        try { host = new URL((tabs[0] && tabs[0].url) || '').hostname; } catch(e) { host = ''; }
        if (!host) return sendResponse({ ok: false, error: 'no_domain_found' });
        removeFromWhitelist(host, function(list) { sendResponse({ ok: true, whitelist: list }); });
      });
      return true;
    } else {
      removeFromWhitelist(domainR, function(list) { sendResponse({ ok: true, whitelist: list }); });
      return true;
    }
  }

  if (msg.type === 'get_whitelist') {
    getWhitelist(function(list) { sendResponse({ ok: true, whitelist: list }); });
    return true;
  }
});
