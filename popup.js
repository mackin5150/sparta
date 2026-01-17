// Popup script: search and per-domain whitelist toggle
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, function (m) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
  });
}

let currentDomain = '';

function setWhitelistButtonState(isListed) {
  const btn = document.getElementById('whitelist-btn');
  if (isListed) {
    btn.textContent = 'Remove from whitelist';
    btn.dataset.whitelisted = '1';
  } else {
    btn.textContent = 'Add to whitelist';
    btn.dataset.whitelisted = '0';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // find active tab and display domain
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const tab = tabs[0];
    if (!tab) return;
    try {
      currentDomain = (new URL(tab.url)).hostname;
    } catch (e) {
      currentDomain = '';
    }
    document.getElementById('current-domain').textContent = currentDomain || '—';

    // get stored whitelist and update button
    chrome.runtime.sendMessage({ type: 'get_whitelist' }, function(res) {
      if (res && res.ok) {
        const list = res.whitelist || [];
        setWhitelistButtonState(list.some(d => currentDomain && currentDomain.indexOf(d) !== -1));
      } else {
        setWhitelistButtonState(false);
      }
    });
  });

  document.getElementById('search').addEventListener('click', function () {
    const q = document.getElementById('q').value.trim();
    if (!q) return;
    chrome.runtime.sendMessage({ type: 'search', query: q, top_k: 10 }, function (res) {
      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = '';
      if (!res || res.error) {
        resultsDiv.innerText = 'Error: ' + (res && res.error ? res.error : 'no response');
        return;
      }
      (res.results || []).forEach(function (r) {
        const div = document.createElement('div');
        div.className = 'result';
        div.innerHTML = '<div class="title"><a href="' + escapeHtml(r.url) + '" target="_blank">' + escapeHtml(r.title || r.url) + '</a></div>' +
                        '<div class="url">' + escapeHtml(r.url) + '</div>' +
                        '<div class="excerpt">' + escapeHtml((r.excerpt || '').slice(0, 300)) + '</div>';
        resultsDiv.appendChild(div);
      });
    });
  });

  document.getElementById('index_page').addEventListener('click', function () {
    chrome.runtime.sendMessage({ type: 'index_page' }, function (res) {
      if (!res) { alert('No response from background.'); return; }
      if (res.ok) { alert('Indexing started.'); }
      else if (res.error) { alert('Indexing failed: ' + res.error); }
      else { alert('Index request completed.'); }
    });
  });

  document.getElementById('whitelist-btn').addEventListener('click', function () {
    const isListed = this.dataset.whitelisted === '1';
    if (!currentDomain) return alert('No domain detected.');

    if (!isListed) {
      chrome.runtime.sendMessage({ type: 'add_whitelist', domain: currentDomain }, function(res) {
        if (res && res.ok) {
          setWhitelistButtonState(true);
          alert(currentDomain + ' added to whitelist.');
        } else {
          alert('Failed to add to whitelist: ' + (res && res.error ? res.error : 'unknown'));
        }
      });
    } else {
      chrome.runtime.sendMessage({ type: 'remove_whitelist', domain: currentDomain }, function(res) {
        if (res && res.ok) {
          setWhitelistButtonState(false);
          alert(currentDomain + ' removed from whitelist.');
        } else {
          alert('Failed to remove from whitelist: ' + (res && res.error ? res.error : 'unknown'));
        }
      });
    }
  });
});
