# Ask Your Document — Bonus Challenges

Bonus challenges that build on the base [ask-your-document](https://github.com/Constellation-Dealer/ask-your-document) workshop. Steps 1–4 are pre-implemented — you add multi-turn conversations and weather tool calls.

## Prerequisites

You must have completed the base workshop first.

## Getting Started

1. Clone this repo
2. Copy `.env.example` to `.env` and fill in your credentials (same values as the base workshop)
3. Serve it over `http://localhost`, the same way as the base workshop:
   ```
   npx --yes http-server . -a localhost -p 3000 -c-1
   ```
   Then open <http://localhost:3000>.

   **On origins (CORS):** the APIs allowlist specific origins. Both `http://localhost:3000` and
   `http://localhost:5173` are allowlisted on IDMS, the Gateway and UMH, so either port works —
   use 5173 if something else already has 3000.
4. Pick a PDF whose text you can select in a reader, type a question, and click **Run** to see
   Steps 1–4 execute, then implement the challenges in `loop.js`

> **Bring a text PDF, not a scan.** TargetUMH answers `ingestionStatus: Skipped` for a PDF with no
> text layer — a flatbed scan, or a phone photo saved as a PDF. Nothing gets embedded, so there is
> nothing for the agent to retrieve. Step 2 now stops and says so instead of waiting for embeddings
> that will never arrive.

> **Do NOT open `index.html` directly as a file** (`file://...`), and use `localhost`, not
> `127.0.0.1`. Neither is an allowlisted origin. The API does not reject the call — it sends back no
> CORS header, and your *browser* blocks the response before your code ever sees it, which is why
> this shows up as an opaque network error rather than an HTTP status.

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
Skip the PDF upload entirely and ask the Gateway about weather. The LLM will call `get_weather_forecast` and `get_weather_alerts` instead of document tools. Personalize it with your actual travel to Perseus EPIC in Whistler, British Columbia — most people fly into Vancouver on Sunday 13 September, the event is Monday 14 September, and the return is Tuesday 15 September.

## Configuration

All configuration is in `.env`. See `.env.example` for the full list of values including API endpoints, credentials, and dealer context. Use the same values from the base workshop.
