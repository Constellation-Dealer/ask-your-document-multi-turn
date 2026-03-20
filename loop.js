// ═══════════════════════════════════════════════════════════════
//
//  loop.js — BONUS CHALLENGES
//
//  Prerequisites: You should have completed the base workshop
//  (ask-your-document) before attempting these challenges.
//
//  This file has TWO challenges. Each one is independent — you
//  can do them in any order. Steps 1–4 from the base workshop
//  are already implemented for you.
//
//  Available helpers (see helpers.js for full docs):
//    uploadPdf(file)          → { id, ingestionStatus, ... }
//    getMediaStatus(id)       → { ingestionStatus, ... }
//    chatWithGateway(message, onToolStart, onToolComplete, onThinking, options)
//                             → { message, toolCalls, sessionId }
//        options.sessionId    — pass the sessionId from a previous response
//                               to continue a multi-turn conversation
//    addStep(id, title, detail, status)   → adds a card to the trace
//    updateStep(id, detail, status)       → updates an existing card
//    showAnswer(html)         → displays the answer section
//    sleep(ms)                → async wait
//
//  Status values: "thinking", "waiting", "complete", "error"
//
// ═══════════════════════════════════════════════════════════════


// ── CHALLENGE 1: Multi-Turn Conversation ──────────────────────
//
// The base workshop was one-shot: upload → ask → done.
// Here you'll ask a FOLLOW-UP question using the same session.
//
// Steps 1–4 are done for you. Your job: implement Step 5.

async function runAgenticLoop(file, question) {

  // ── Step 1: Upload the PDF (done) ──────────────────────────

  addStep('upload', 'Upload + Index', `Uploading ${file.name}...`, 'thinking');
  const upload = await uploadPdf(file);
  updateStep('upload', `Uploaded! ID: ${upload.id}\ningestionStatus: ${upload.ingestionStatus}`, 'complete');

  // ── Step 2: Poll until ready (done) ────────────────────────

  addStep('poll', 'Poll until ready', 'Checking ingestion status...', 'waiting');
  while (true) {
    const status = await getMediaStatus(upload.id);
    updateStep('poll', `ingestionStatus: ${status.ingestionStatus}`, 'waiting');
    if (status.ingestionStatus === 'Completed') break;
    if (status.ingestionStatus === 'Failed') throw new Error('Embedding ingestion failed');
    await sleep(1000);
  }
  updateStep('poll', 'Embeddings ready!', 'complete');

  // ── Step 3: Ask the Gateway (done) ─────────────────────────

  addStep('gateway', 'Ask Gateway', 'Sending question to the LLM agent...', 'thinking');
  const response = await chatWithGateway(
    `Based on the uploaded document (file ID: ${upload.id}), ${question}`,
    (toolName, desc) => addStep(`tool-${toolName}`, toolName, desc, 'thinking'),
    (toolName, success, summary) => updateStep(`tool-${toolName}`, summary, success ? 'complete' : 'error'),
    (msg) => addStep('thinking', 'Thinking', msg, 'thinking')
  );
  updateStep('gateway', 'Agent finished!', 'complete');

  // ── Step 4: Show the answer (done) ─────────────────────────

  addStep('answer', 'Compose Answer', 'Rendering the response...', 'thinking');
  showAnswer(response.message);
  updateStep('answer', 'Done!', 'complete');


  // ── Step 5: Enable multi-turn follow-ups ───────────────────
  //
  // TODO: YOUR CODE HERE
  //
  // The `response` object from Step 3 contains a `sessionId`.
  // Call enableFollowUp(response.sessionId) to show the follow-up
  // input bar at the bottom of the screen. The bar handles sending
  // follow-up questions using the same session — the Gateway
  // automatically loads conversation history.
  //
  // Just add this one line:
  //
  //    enableFollowUp(response.sessionId);
  //
  // Once enabled, try typing follow-up questions like:
  //   "Summarize that in 3 bullet points"
  //   "Which page has the most critical information?"
  //   "Explain the first point in more detail"
  //
  // Watch the loop trace — the LLM should NOT call
  // vector_search_media again. It already has context.

}


// ── CHALLENGE 2: Travel Weather Briefing ──────────────────────
//
// The same Gateway has access to weather tools:
//   - get_weather_forecast  (short-term weather forecast)
//   - get_weather_alerts    (active weather alerts)
//
// The LLM picks which tools to call based on your question.
// No PDF upload needed — just ask!
//
// To try this challenge:
//   1. Uncomment the function below
//   2. In handleRun() at the bottom of helpers.js, change the
//      call from runAgenticLoop(selectedFile, question) to
//      runWeatherBriefing(question)
//   3. You won't need to select a PDF — just type a question
//      and click Run
//
// Personalize it! You're traveling to the hackathon:
//   - Arriving: Sunday March 22 or Monday March 23
//   - Returning: Saturday March 28
//   - Ask about YOUR travel cities and connecting flights

/*
async function runWeatherBriefing(question) {

  // TODO: YOUR CODE HERE
  //
  // 1. Call addStep('weather', 'Weather Briefing', 'Checking travel weather...', 'thinking')
  //
  // 2. Call chatWithGateway with the question:
  //
  //    const response = await chatWithGateway(
  //      question,
  //      (toolName, desc) => addStep(`tool-${toolName}`, toolName, desc, 'thinking'),
  //      (toolName, success, summary) => updateStep(`tool-${toolName}`, summary, success ? 'complete' : 'error'),
  //      (msg) => addStep('thinking', 'Thinking', msg, 'thinking')
  //    );
  //
  // 3. Show the answer:
  //    updateStep('weather', 'Briefing complete!', 'complete')
  //    showAnswer(response.message)
  //
  // Look at the loop trace — instead of vector_search_media and
  // get_document_chunks, you'll see get_weather_forecast and/or
  // get_weather_alerts. Same Gateway, same code, different tools.
  //
  // Example questions to try:
  //   "What's the weather forecast for Dallas this Sunday and Monday?"
  //   "Are there any weather alerts near Toronto for this weekend?"
  //   "I'm flying into Dallas on Sunday March 22 and returning
  //    Saturday March 28. Any weather I should prepare for?"
  //
  // BONUS: Combine with Challenge 1 — use response.sessionId
  // to ask follow-ups:
  //   "Should I pack an umbrella?"
  //   "What about my connecting flight through Chicago?"

}
*/
