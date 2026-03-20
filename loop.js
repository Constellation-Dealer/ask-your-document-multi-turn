// ═══════════════════════════════════════════════════════════════
//
//  loop.js — BONUS CHALLENGES (SOLUTION)
//
//  This is the completed version with both challenges implemented.
//
// ═══════════════════════════════════════════════════════════════


// ── CHALLENGE 1: Multi-Turn Conversation (SOLUTION) ───────────

async function runAgenticLoop(file, question) {

  // ── Step 1: Upload the PDF ─────────────────────────────────

  addStep('upload', 'Upload + Index', `Uploading ${file.name}...`, 'thinking');
  const upload = await uploadPdf(file);
  updateStep('upload', `Uploaded! ID: ${upload.id}\ningestionStatus: ${upload.ingestionStatus}`, 'complete');

  // ── Step 2: Poll until ready ───────────────────────────────

  addStep('poll', 'Poll until ready', 'Checking ingestion status...', 'waiting');
  while (true) {
    const status = await getMediaStatus(upload.id);
    updateStep('poll', `ingestionStatus: ${status.ingestionStatus}`, 'waiting');
    if (status.ingestionStatus === 'Completed') break;
    if (status.ingestionStatus === 'Failed') throw new Error('Embedding ingestion failed');
    await sleep(1000);
  }
  updateStep('poll', 'Embeddings ready!', 'complete');

  // ── Step 3: Ask the Gateway ────────────────────────────────

  addStep('gateway', 'Ask Gateway', 'Sending question to the LLM agent...', 'thinking');
  const response = await chatWithGateway(
    `Based on the uploaded document (file ID: ${upload.id}), ${question}`,
    (toolName, desc) => addStep(`tool-${toolName}`, toolName, desc, 'thinking'),
    (toolName, success, summary) => updateStep(`tool-${toolName}`, summary, success ? 'complete' : 'error'),
    (msg) => addStep('thinking', 'Thinking', msg, 'thinking')
  );
  updateStep('gateway', 'Agent finished!', 'complete');

  // ── Step 4: Show the answer ────────────────────────────────

  addStep('answer', 'Compose Answer', 'Rendering the response...', 'thinking');
  showAnswer(response.message);
  updateStep('answer', 'Done!', 'complete');

  // ── Step 5: Enable multi-turn follow-ups ───────────────────

  enableFollowUp(response.sessionId);
}


// ── CHALLENGE 2: Travel Weather Briefing (SOLUTION) ───────────

async function runWeatherBriefing(question) {

  addStep('weather', 'Weather Briefing', 'Checking travel weather...', 'thinking');

  const response = await chatWithGateway(
    question,
    (toolName, desc) => addStep(`tool-${toolName}`, toolName, desc, 'thinking'),
    (toolName, success, summary) => updateStep(`tool-${toolName}`, summary, success ? 'complete' : 'error'),
    (msg) => addStep('thinking', 'Thinking', msg, 'thinking')
  );

  updateStep('weather', 'Briefing complete!', 'complete');
  showAnswer(response.message);

  // Enable follow-ups for weather too
  enableFollowUp(response.sessionId);
}
