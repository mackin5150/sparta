// Extract visible text and headings from the page and return a compact excerpt.
// This intentionally limits length to avoid sending entire huge pages.
function extractText() {
  const nodes = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, li, a'))
    .map(e => ({tag: e.tagName.toLowerCase(), text: e.innerText}))
    .filter(n => n.text && n.text.length > 2);

  // Build a prioritized excerpt: headings first, then paragraphs, then links
  const headings = nodes.filter(n => n.tag.startsWith('h')).map(n => n.text);
  const paragraphs = nodes.filter(n => n.tag === 'p' || n.tag === 'li').map(n => n.text);
  const links = nodes.filter(n => n.tag === 'a').map(n => n.text);

  // Combine but cap total characters
  const combined = [...headings, ...paragraphs, ...links].join('\n\n');
  const excerpt = combined.slice(0, 60_000); // safety cap

  return {
    title: document.title || '',
    url: location.href,
    excerpt
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'extract_page') {
    sendResponse(extractText());
  }
});

function ensurePulseStyles() {
  if (document.getElementById('sparta-pulse-style')) return;
  const style = document.createElement('style');
  style.id = 'sparta-pulse-style';
  style.textContent = `
    #sparta-pulse {
      position: fixed;
      right: 16px;
      bottom: 16px;
      width: 320px;
      background: #0f141a;
      color: #f2f4f7;
      border: 1px solid #2a3642;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      z-index: 2147483647;
      font-family: Arial, sans-serif;
    }
    #sparta-pulse .sparta-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px 6px;
      font-size: 13px;
      font-weight: bold;
    }
    #sparta-pulse .sparta-close {
      background: transparent;
      color: #c7d0d9;
      border: none;
      font-size: 16px;
      cursor: pointer;
      line-height: 1;
    }
    #sparta-pulse .sparta-section {
      padding: 6px 12px 10px;
      border-top: 1px solid #22303c;
    }
    #sparta-pulse .sparta-title {
      font-size: 12px;
      color: #9fb1c1;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    #sparta-pulse .sparta-item {
      font-size: 12px;
      margin-bottom: 6px;
      line-height: 1.2;
    }
    #sparta-pulse a {
      color: #7bdcff;
      text-decoration: none;
    }
    #sparta-pulse .sparta-chip {
      display: inline-block;
      padding: 2px 6px;
      margin: 0 6px 6px 0;
      background: #1f2a33;
      border: 1px solid #2e3b47;
      border-radius: 999px;
      font-size: 11px;
      color: #d5dee6;
    }
  `;
  document.head.appendChild(style);
}

function clearPulse() {
  const existing = document.getElementById('sparta-pulse');
  if (existing) existing.remove();
}

function showPulse({ domain, items, topQueries, durationMs }) {
  ensurePulseStyles();
  clearPulse();

  const panel = document.createElement('div');
  panel.id = 'sparta-pulse';

  const header = document.createElement('div');
  header.className = 'sparta-header';
  const title = document.createElement('div');
  title.textContent = `Sparta: ${domain}`;
  const close = document.createElement('button');
  close.className = 'sparta-close';
  close.textContent = '×';
  close.addEventListener('click', clearPulse);
  header.appendChild(title);
  header.appendChild(close);
  panel.appendChild(header);

  if (items && items.length) {
    const section = document.createElement('div');
    section.className = 'sparta-section';
    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'sparta-title';
    sectionTitle.textContent = 'From this site';
    section.appendChild(sectionTitle);
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'sparta-item';
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = item.title || item.url;
      row.appendChild(link);
      section.appendChild(row);
    });
    panel.appendChild(section);
  }

  if (topQueries && topQueries.length) {
    const section = document.createElement('div');
    section.className = 'sparta-section';
    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'sparta-title';
    sectionTitle.textContent = 'Frequent searches';
    section.appendChild(sectionTitle);
    topQueries.forEach((q) => {
      const chip = document.createElement('span');
      chip.className = 'sparta-chip';
      chip.textContent = q;
      section.appendChild(chip);
    });
    panel.appendChild(section);
  }

  document.body.appendChild(panel);
  const timeoutMs = typeof durationMs === 'number' ? durationMs : 7000;
  window.setTimeout(clearPulse, timeoutMs);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'show_pulse') {
    showPulse(msg);
  }
});
