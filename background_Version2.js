// Background service worker: sends page excerpt to your server to index, and handles messages from popup.
const SERVER_BASE = 'https://YOUR_SERVER_URL_OR_LOCALHOST:3000'; // replace with your server URL

async function postJSON(path, body) {
  const res = await fetch(`${SERVER_BASE}${path}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  return res.json();
}

chrome.action.onClicked.addListener(async (tab) => {
  // When user clicks extension icon, extract page and index it to server
  try {
    const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
    chrome.tabs.sendMessage(activeTab.id, {type: 'extract_page'}, async (page) => {
      if (!page || !page.excerpt) {
        console.warn('No page content extracted.');
        return;
      }
      // Optional: user confirmation could be requested here
      await postJSON('/index', {title: page.title, url: page.url, text: page.excerpt});
      // simple feedback
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Indexed',
        message: 'Page was sent to your search index.'
      });
    });
  } catch (err) {
    console.error('Indexing failed', err);
  }
});

// Simple message handler for popup -> background -> server
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'search') {
    fetch(`${SERVER_BASE}/search`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query: msg.query, top_k: msg.top_k || 10})
    })
      .then(r => r.json())
      .then(data => sendResponse(data))
      .catch(err => sendResponse({error: err.toString()}));
    return true; // keep sendResponse alive
  }
});