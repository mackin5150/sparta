// MV2-compatible background script (callbacks). Set SERVER_BASE to your Render URL.
var SERVER_BASE = 'https://sparta-97q0.onrender.com'; // update if needed

function postJSON(path, body, cb) {
  fetch(SERVER_BASE + path, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  })
    .then(function(res) { return res.json(); })
    .then(function(j) { cb(j); })
    .catch(function(err) { console.error('postJSON error', err); cb({ error: String(err) }); });
}

function indexCurrentTab(cb) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || tabs.length === 0) {
      console.warn('No active tab to index.');
      return cb({ error: 'no_active_tab' });
    }
    var activeTab = tabs[0];
    chrome.tabs.sendMessage(activeTab.id, { type: 'extract_page' }, function(page) {
      if (chrome.runtime.lastError) {
        console.error('sendMessage error:', chrome.runtime.lastError.message);
        return cb({ error: chrome.runtime.lastError.message });
      }
      if (!page || !page.excerpt) {
        console.warn('No page content extracted.');
        return cb({ error: 'no_content_extracted' });
      }
      console.log('Extracted page:', page.title, page.url);
      postJSON('/index', { title: page.title, url: page.url, text: page.excerpt }, function(resp) {
        console.log('Index response:', resp);
        try {
          if (resp && resp.ok) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon.png',
              title: 'Indexed',
              message: 'Page was sent to your search index.'
            });
          } else if (resp && resp.error) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon.png',
              title: 'Index failed',
              message: String(resp.error)
            });
          }
        } catch (e) {
          console.warn('Notification failed', e);
        }
        cb(resp);
      });
    });
  });
}

// Handle toolbar icon click
chrome.browserAction.onClicked.addListener(function(tab) {
  indexCurrentTab(function(r) {
    console.log('indexCurrentTab done', r);
  });
});

// Messages from popup
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg && msg.type === 'search') {
    fetch(SERVER_BASE + '/search', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ query: msg.query, top_k: msg.top_k || 10 })
    })
      .then(function(r) { return r.json(); })
      .then(function(data) { sendResponse(data); })
      .catch(function(err) { sendResponse({ error: String(err) }); });
    return true; // keep sendResponse alive
  }

  if (msg && msg.type === 'index_page') {
    indexCurrentTab(function(result) { sendResponse(result); });
    return true;
  }
});
