# sparta

Personal Cloud Search Assistant (MVP). This repo contains a Chrome extension and a small Node/Express server for indexing page excerpts with embeddings and running semantic search.

Layout
- Extension files live at the repo root with `_Version2` suffixes.
- Server files live in `server/` (`server/package.json`, `server/index.js`).

Quick start (local)
1. Copy or rename the extension files (e.g. `manifest_Version2.json` -> `manifest.json`) into a folder you will load in Chrome.
2. Edit the background script to point `SERVER_BASE` at your server (e.g. `http://localhost:3000`).
3. Start the server:
   - `cd server`
   - `npm install`
   - create `.env` with `OPENAI_API_KEY`
   - `npm start`
4. Load the extension in Chrome: `chrome://extensions` -> Developer mode -> Load unpacked -> select the extension folder.
