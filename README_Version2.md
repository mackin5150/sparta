# Personal Cloud Search Assistant (MVP)

Overview
- This prototype is a Chrome extension + small Node/Express server that indexes page excerpts with OpenAI embeddings and performs brute-force semantic search.

Repo layout
- Extension files are in the repo root with `_Version2` suffixes.
- Server files are in `server/` (`server/index.js`, `server/package.json`).

Setup (local)
1. Copy or rename the extension files into a folder for Chrome (e.g. `manifest_Version2.json` -> `manifest.json`).
2. Edit `background_Version2.js`: set `SERVER_BASE` to your server address (`http://localhost:3000` for local).
3. Start the server:
   - `cd server`
   - `npm install`
   - create a `.env` with `OPENAI_API_KEY`
   - `npm start`
4. Load the extension in Chrome:
   - `chrome://extensions` -> Developer mode -> Load unpacked -> choose the extension folder.
5. Visit a page, click the extension icon -> "Index this page" will POST the excerpt to the server.
6. Open the popup and search to see results.

Render (server deploy)
- Set the Render "Root Directory" to `server` so it uses `server/package.json`.
- Set the `OPENAI_API_KEY` env var in Render.

Next improvements
- Persist data in a database (Supabase / PostgreSQL + pgvector) for reliability.
- Add a PII scrubber that strips emails, phone numbers.
- Add site whitelist/blacklist and automatic indexing.
- Use ANN (HNSW) for faster search when doc counts grow.
- Add UI highlights that jump to matched anchors in the page.

Security & privacy
- Use HTTPS for production.
- Optionally hash or remove personal data before sending to server.
- Provide a delete endpoint to remove docs.
