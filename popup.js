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
  // Tell the background script to index the current page
  chrome.runtime.sendMessage({ type: 'index_page' }, function (res) {
    if (!res) {
      alert('No response from background.');
      return;
    }
    if (res.ok) {
      alert('Indexing started.');
    } else if (res.error) {
      alert('Indexing failed: ' + res.error);
    } else {
      alert('Index request completed.');
    }
  });
});

// small escaper
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, function (m) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
  });
}
