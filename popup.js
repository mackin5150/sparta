document.getElementById('search').addEventListener('click', async () => {
  const q = document.getElementById('q').value.trim();
  if (!q) return;
  chrome.runtime.sendMessage({type: 'search', query: q, top_k: 10}, (res) => {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    if (!res || res.error) {
      resultsDiv.innerText = 'Error: ' + (res?.error || 'no response');
      return;
    }
    res.results.forEach(r => {
      const div = document.createElement('div');
      div.className = 'result';
      div.innerHTML = `<div class="title"><a href="${r.url}" target="_blank">${escapeHtml(r.title || r.url)}</a></div>
                       <div class="url">${escapeHtml(r.url)}</div>
                       <div class="excerpt">${escapeHtml(r.excerpt || '').slice(0,300)}</div>`;
      resultsDiv.appendChild(div);
    });
  });
});

document.getElementById('index_page').addEventListener('click', async () => {
  // Tell background (which will message content script) to index the page
  chrome.action.onClicked.dispatch();
});

// small escaper
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}