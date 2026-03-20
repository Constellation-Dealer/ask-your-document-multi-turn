// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION — loaded from .env (see .env.example)
//
//  TODO: Copy .env.example to .env and fill in ALL values:
//    - IDMS_URL       → Token endpoint base URL (for authentication)
//    - GATEWAY_URL    → TargetMCP Gateway (for chat/streaming)
//    - UMH_URL        → TargetUMH (for upload and media status)
//    - DEALER_GUID    → Dealer identifier for API calls
//    - USERNAME       → IDMS username
//    - PASSWORD       → IDMS password
//    - CLIENT_SECRET  → IDMS client secret
//
// ═══════════════════════════════════════════════════════════════

let DEALER_GUID = '';
let IDMS_URL = '';
let GATEWAY_URL = '';
let UMH_URL = '';

let _authToken = null;

// Config loaded from .env file
let _config = { username: '', password: '', clientSecret: '' };

function getToken() {
  return _authToken;
}

function getDealerGuid() {
  return DEALER_GUID;
}

// ═══════════════════════════════════════════════════════════════
//  .env LOADER
// ═══════════════════════════════════════════════════════════════

async function loadEnv() {
  try {
    const res = await fetch('.env');
    if (!res.ok) throw new Error();
    const text = await res.text();
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key === 'IDMS_URL') IDMS_URL = value;
      if (key === 'GATEWAY_URL') GATEWAY_URL = value;
      if (key === 'UMH_URL') UMH_URL = value;
      if (key === 'DEALER_GUID') DEALER_GUID = value;
      if (key === 'USERNAME') _config.username = value;
      if (key === 'PASSWORD') _config.password = value;
      if (key === 'CLIENT_SECRET') _config.clientSecret = value;
    }
  } catch {
    // .env not found — credentials must be entered in the config panel
  }

  // Validate that all required config is present
  if (!IDMS_URL || !GATEWAY_URL || !UMH_URL || !DEALER_GUID ||
      !_config.username || !_config.password || !_config.clientSecret) {
    console.warn('Missing .env config. Copy .env.example to .env and fill in all values.');
  }
}

// ═══════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS — Do NOT modify.
// ═══════════════════════════════════════════════════════════════

/**
 * Authenticate with IDMS to get a bearer token.
 * Reads credentials from the config panel (prefilled from .env).
 * Returns the JWT token string.
 */
async function authenticate() {
  const username = _config.username;
  const password = _config.password;
  const clientSecret = _config.clientSecret;

  if (!IDMS_URL || !GATEWAY_URL || !UMH_URL || !DEALER_GUID) {
    throw new Error('Missing API config. Copy .env.example to .env and fill in IDMS_URL, GATEWAY_URL, UMH_URL, and DEALER_GUID.');
  }

  if (!username || !password || !clientSecret) {
    throw new Error('Missing credentials. Fill in USERNAME, PASSWORD, and CLIENT_SECRET in .env.');
  }

  const res = await fetch(`${IDMS_URL}/api/v1/Account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ClientId: 'ChampionWorkshop',
      ClientSecret: clientSecret,
      UserName: username,
      Password: password,
      ProductId: 'B3AD4A3C-71B1-43C4-3EF5-08DE4D806118',
      DmsDealerId: 199111001,
      LoginResolutionPolicy: 'DealerId'
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Authentication failed: ${res.status} ${res.statusText}${text ? ' — ' + text : ''}`);
  }

  const data = await res.json();
  _authToken = data.access_token || data.token;
  return _authToken;
}

/**
 * Upload a PDF file. Returns { id, ingestionStatus, ... }
 */
async function uploadPdf(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('allowUnassigned', 'true');
  formData.append('generateEmbedding', 'true');
  formData.append('description', 'Uploaded for RAG exercise');

  const res = await fetch(`${UMH_URL}/api/v1/${getDealerGuid()}/media/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body: formData
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  return await res.json();
}

/**
 * Poll the ingestion status of a media file. Returns { ingestionStatus, ... }
 */
async function getMediaStatus(mediaFileId) {
  const res = await fetch(`${UMH_URL}/api/v1/${getDealerGuid()}/media/${mediaFileId}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });

  if (!res.ok) throw new Error(`Status check failed: ${res.status} ${res.statusText}`);
  return await res.json();
}

/**
 * Chat with the Gateway using SSE streaming.
 *
 * @param {string} message         - The user's question/message
 * @param {function} onToolStart   - Called with (toolName, description) when a tool starts
 * @param {function} onToolComplete - Called with (toolName, success, summary) when a tool finishes
 * @param {function} onThinking    - Called with (message) when the LLM is thinking
 * @param {object} [options]       - Optional settings
 * @param {string} [options.sessionId] - Session ID for multi-turn conversation.
 *                                       Omit for a new conversation; reuse the sessionId
 *                                       from a previous response to continue the conversation.
 *                                       The Gateway automatically loads conversation history.
 * @returns {Promise<{message: string, toolCalls: Array, sessionId: string}>}
 *          The final answer, tool call log, and sessionId for follow-up turns
 */
async function chatWithGateway(message, onToolStart, onToolComplete, onThinking, options) {
  const body = { message };
  if (options?.sessionId) body.sessionId = options.sessionId;

  const res = await fetch(`${GATEWAY_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gateway chat failed: ${res.status} ${res.statusText}${text ? ' — ' + text : ''}`);
  }

  return _parseSseStream(res.body, onToolStart, onToolComplete, onThinking);
}

/**
 * Parse an SSE stream from the Gateway.
 */
async function _parseSseStream(body, onToolStart, onToolComplete, onThinking) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalMessage = '';
  let sessionId = null;
  const toolCalls = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    let eventType = null;
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ') && eventType) {
        const dataStr = line.slice(6);
        let data;
        try { data = JSON.parse(dataStr); } catch { data = dataStr; }

        // Capture sessionId from any event (it's on every SSE event)
        if (data && data.sessionId && !sessionId) sessionId = data.sessionId;

        switch (eventType) {
          case 'tool_start':
            if (onToolStart) onToolStart(data.toolName || data.name, data.description || '');
            toolCalls.push({ name: data.toolName || data.name, status: 'started' });
            break;
          case 'tool_complete':
            if (onToolComplete) onToolComplete(data.toolName || data.name, data.success !== false, data.summary || '');
            break;
          case 'thinking':
            if (onThinking) onThinking(data.message || data);
            break;
          case 'message':
            finalMessage += (typeof data === 'string' ? data : data.content || data.message || '');
            break;
          case 'complete':
            if (data?.response) {
              finalMessage = data.response.message || data.response.content || finalMessage;
              if (data.response.sessionId) sessionId = data.response.sessionId;
            } else {
              finalMessage = (typeof data === 'string' ? data : data.message || data.content || finalMessage);
            }
            break;
        }
        eventType = null;
      }
    }
  }

  return { message: finalMessage, toolCalls, sessionId };
}

/**
 * Add a new step card to the loop trace.
 */
function addStep(id, title, detail, status) {
  const trace = document.getElementById('loopTrace');
  const card = document.createElement('div');
  card.className = `step-card ${status}`;
  card.id = `step-${id}`;

  const statusIcons = { thinking: '...', waiting: '&#8987;', complete: '&#10003;', error: '&#10007;' };

  card.innerHTML = `
    <div class="step-title">
      ${title}
      <span class="step-status-icon">${statusIcons[status] || ''}</span>
    </div>
    <div class="step-detail">${detail}</div>
  `;

  trace.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Update an existing step card's detail text and status.
 */
function updateStep(id, detail, status) {
  const card = document.getElementById(`step-${id}`);
  if (!card) return;

  card.className = `step-card ${status}`;
  const statusIcons = { thinking: '...', waiting: '&#8987;', complete: '&#10003;', error: '&#10007;' };
  card.querySelector('.step-status-icon').innerHTML = statusIcons[status] || '';
  card.querySelector('.step-detail').textContent = detail;
}

/**
 * Display the final answer in the answer section.
 */
function showAnswer(html) {
  const section = document.getElementById('answerSection');
  const box = document.getElementById('answerBox');
  box.innerHTML = html;
  section.classList.add('visible');
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Async sleep helper.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════
//  UI WIRING — handles clicks, drag-drop, run button
// ═══════════════════════════════════════════════════════════════

let selectedFile = null;
let _currentSessionId = null;
let _followUpCount = 0;

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  if (e.dataTransfer.files.length) selectFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) selectFile(fileInput.files[0]);
});

function selectFile(file) {
  if (file.type !== 'application/pdf') { alert('Please select a PDF file.'); return; }
  if (file.size > 10 * 1024 * 1024) { alert('File too large. Maximum size is 10 MB.'); return; }
  selectedFile = file;
  uploadArea.classList.add('has-file');
  fileNameEl.textContent = file.name;
}

// Run button
async function handleRun() {
  const question = document.getElementById('questionInput').value.trim();
  if (!question) { alert('Please enter a question.'); return; }
  if (!selectedFile) { alert('Please select a PDF file.'); return; }

  const btn = document.getElementById('runBtn');
  btn.disabled = true;
  btn.textContent = 'Running...';
  document.getElementById('loopTrace').innerHTML = '';
  document.getElementById('answerSection').classList.remove('visible');
  document.getElementById('errorBanner').classList.remove('visible');
  _currentSessionId = null;
  _followUpCount = 0;
  const bar = document.getElementById('followupBar');
  bar.classList.add('disabled');
  document.getElementById('followupInput').disabled = true;
  document.getElementById('followupInput').placeholder = 'Run the loop first, then call enableFollowUp(response.sessionId) in loop.js...';
  document.getElementById('followupBtn').disabled = true;
  document.getElementById('followupSessionHint').textContent = '— run the loop first, then enable with enableFollowUp()';

  try {
    await authenticate();
    await runAgenticLoop(selectedFile, question);
  } catch (err) {
    const banner = document.getElementById('errorBanner');
    banner.textContent = `Error: ${err.message}`;
    banner.classList.add('visible');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run';
  }
}

/**
 * Show the follow-up bar and store the session ID.
 * Call this from loop.js after the first chatWithGateway response.
 */
function enableFollowUp(sessionId) {
  _currentSessionId = sessionId;
  const bar = document.getElementById('followupBar');
  bar.classList.remove('disabled');
  const input = document.getElementById('followupInput');
  input.disabled = false;
  input.placeholder = 'Ask a follow-up question...';
  document.getElementById('followupBtn').disabled = false;
  const hint = document.getElementById('followupSessionHint');
  if (hint) hint.textContent = `session: ${sessionId.substring(0, 8)}...`;
  input.focus();
}

/**
 * Get the current session ID (for use in loop.js).
 */
function getSessionId() {
  return _currentSessionId;
}

// Follow-up button handler
async function handleFollowUp() {
  const input = document.getElementById('followupInput');
  const question = input.value.trim();
  if (!question || !_currentSessionId) return;

  const btn = document.getElementById('followupBtn');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  input.disabled = true;

  _followUpCount++;
  const stepId = `followup-${_followUpCount}`;

  try {
    addStep(stepId, `Follow-Up #${_followUpCount}`, question, 'thinking');

    const response = await chatWithGateway(
      question,
      (toolName, desc) => addStep(`${stepId}-tool-${toolName}`, toolName, desc, 'thinking'),
      (toolName, success, summary) => updateStep(`${stepId}-tool-${toolName}`, summary, success ? 'complete' : 'error'),
      (msg) => updateStep(stepId, msg, 'thinking'),
      { sessionId: _currentSessionId }
    );

    updateStep(stepId, 'Done!', 'complete');

    // Append follow-up answer below existing answer
    const box = document.getElementById('answerBox');
    box.innerHTML += `<hr style="margin:1.25rem 0;border:none;border-top:2px solid var(--border)">
      <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-light);font-weight:700;margin-bottom:0.5rem">Follow-Up #${_followUpCount}</div>
      ${response.message}`;

    if (response.sessionId) _currentSessionId = response.sessionId;
    input.value = '';
  } catch (err) {
    updateStep(stepId, `Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send';
    input.disabled = false;
    input.focus();
  }
}

// Load .env on page load
loadEnv();
