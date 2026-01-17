// Minimal Express server: /index and /search endpoints, storing documents in store.json
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

require('dotenv').config();

const PORT = process.env.PORT || 3000;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const STORE_FILE = path.resolve(__dirname, 'store.json');
const EMBED_MODEL = 'text-embedding-3-small';

if (!OPENAI_KEY) {
  console.error('Please set OPENAI_API_KEY in environment.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

function loadStore() {
  if (!fs.existsSync(STORE_FILE)) return { docs: [] };
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}
function saveStore(s) { fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2)); }
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-30);
}

async function embedText(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ input: text, model: EMBED_MODEL })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('Embedding error: ' + t);
  }
  const j = await res.json();
  return j.data[0].embedding;
}

app.post('/index', async (req, res) => {
  try {
    const { title, url, text } = req.body;
    if (!url || !text) return res.status(400).json({ error: 'missing url or text' });

    // Optionally pre-process text (strip emails/phones) here

    const embedding = await embedText(text);
    const store = loadStore();
    const existingIndex = store.docs.findIndex(d => d.url === url);
    const doc = {
      id: existingIndex !== -1 ? store.docs[existingIndex].id : uuidv4(),
      title: title || '',
      url,
      excerpt: text.slice(0, 5000),
      embedding,
      created_at: new Date().toISOString()
    };
    if (existingIndex !== -1) {
      store.docs[existingIndex] = doc; // replace existing
    } else {
      store.docs.push(doc);
    }
    saveStore(store);
    return res.json({ ok: true, id: doc.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || err.toString() });
  }
});

app.post('/search', async (req, res) => {
  try {
    const { query, top_k } = req.body;
    if (!query) return res.status(400).json({ error: 'missing query' });
    const qEmb = await embedText(query);
    const store = loadStore();
    const scored = store.docs.map(d => ({ ...d, score: cosine(qEmb, d.embedding) }));
    scored.sort((a, b) => b.score - a.score);
    const top = (scored.slice(0, top_k || 10)).map(d => ({
      id: d.id, title: d.title, url: d.url, excerpt: d.excerpt, score: d.score
    }));
    return res.json({ results: top });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || err.toString() });
  }
});

app.get('/', (req, res) => {
  res.status(200).send('OK');
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
