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