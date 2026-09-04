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

  // Wait only while UMH says it is still working. Everything else is terminal.
  //
  // Writing it the other way round -- break on Completed, throw on Failed --
  // leaves Skipped matching neither branch, and Skipped is what UMH returns for
  // a PDF with no text layer, i.e. a scan. The loop would then spin forever
  // with `ingestionStatus: Skipped` ticking on screen and no error at all.
  const deadline = Date.now() + 120000;
  let status = await getMediaStatus(upload.id);

  while (isIngestionInFlight(status.ingestionStatus)) {
    updateStep('poll', `ingestionStatus: ${status.ingestionStatus}`, 'waiting');

    if (Date.now() > deadline) {
      const stalled =
        `TargetUMH is still at ${status.ingestionStatus} after two minutes, so the answer would ` +
        `have nothing to retrieve. Check the media pipeline before retrying.`;
      updateStep('poll', stalled, 'error');
      throw new Error(stalled);
    }

    await sleep(1000);
    status = await getMediaStatus(upload.id);
  }

  // Not in flight any more, so it either succeeded or it stopped for a reason
  // worth telling the participant about.
  const problem = explainIngestionStop(status.ingestionStatus);
  if (problem) {
    // Put the reason on the Poll card itself. Without this the step keeps its
    // last in-flight text -- still claiming to be polling -- while the error
    // turns up somewhere else entirely, which is a confusing shape for the one
    // failure this whole change exists to make legible.
    updateStep('poll', problem, 'error');
    throw new Error(problem);
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
