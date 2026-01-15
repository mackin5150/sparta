# Personal Cloud Search Assistant (MVP)

Overview
- This prototype is a Chrome extension + small Node/Express server that indexes page excerpts with OpenAI embeddings and performs brute-force semantic search.

Setup (local)
1. Copy the files into a folder for the extension (manifest.json, content-script.js, background.js, popup.html, popup.js).
2. Edit background.js: set SERVER_BASE to your server address (http://localhost:3000 for local).
3. Start the server:
   - cd server
   - npm install
   - create a .env with OPENAI_API_KEY
   - npm start
4. Load the extension in Chrome:
   - chrome://extensions -> Developer mode -> Load unpacked -> choose the extension folder.
5. Visit a page, click the extension icon -> "Index this page" will POST the excerpt to the server.
6. Open the popup and search to see results.

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
