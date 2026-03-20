# Ask Your Document — Bonus Challenges

Bonus challenges that build on the base [ask-your-document](https://github.com/Constellation-Dealer/ask-your-document) workshop. Steps 1–4 are pre-implemented — you add multi-turn conversations and weather tool calls.

## Prerequisites

You must have completed the base workshop first.

## Getting Started

1. Clone this repo
2. Copy `.env.example` to `.env` and fill in your credentials (same values as the base workshop)
3. **Important:** You must serve this on `http://localhost:5173` — the APIs only accept requests from this origin (CORS). Use any local server, for example:
   ```
   npx serve -l 5173
   ```
   Then open http://localhost:5173 in your browser.
4. Click **Run** to see Steps 1–4 execute, then implement the challenges in `loop.js`

> **Do NOT open `index.html` directly as a file** (`file://...`). The APIs will reject requests that don't come from `http://localhost:5173`.

## File Structure

```
ask-your-document-multi-turn/
├── .env.example    ← Copy to .env and fill in credentials
├── index.html      ← Page structure (no need to modify)
├── styles.css      ← UI styling (no need to modify)
├── helpers.js      ← Auth, API helpers, UI wiring (no need to modify)
└── loop.js         ← YOUR CODE GOES HERE
```

**You only need to edit `loop.js`.**

## Challenges

### Challenge 1: Multi-Turn Conversation
Ask a follow-up question about your document without re-uploading. Use `response.sessionId` from the first call and pass it to the next `chatWithGateway()` call. The Gateway loads conversation history automatically.

### Challenge 2: Travel Weather Briefing
Skip the PDF upload entirely and ask the Gateway about weather. The LLM will call `get_weather_forecast` and `get_weather_alerts` instead of document tools. Personalize it with your actual hackathon travel dates (arriving Sunday/Monday March 22–23, returning Saturday March 28).

## Configuration

All configuration is in `.env`. See `.env.example` for the full list of values including API endpoints, credentials, and dealer context. Use the same values from the base workshop.
