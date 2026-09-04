// The Poll step must show the outcome that actually stopped it.
//
// ingestion-checks.mjs proves the loop TERMINATES and throws something that
// names the status. That is necessary and not sufficient: the participant reads
// the trace, not the exception. If the Poll card keeps its last in-flight text
// it still says "Checking ingestion status..." or "ingestionStatus: Skipped" in
// a waiting state, while the reason appears in a banner somewhere else -- which
// is a confusing shape for the exact failure this repo was fixed to make
// legible.
//
// Asserted as properties rather than fixed strings: the card must be in the
// error state, and its detail must name the status that stopped it AND the
// cause the participant can act on. Wording stays free to change.
import { goto, evaluate, consoleLogs, close } from './cdp.mjs';

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:5198/';

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(name);
}

// Drive the real loop to a terminal status and report what the Poll card ends up saying.
const driveExpr = (statuses, fastClock = false) => `
  const queue = ${JSON.stringify(statuses)};
  let i = 0;
  uploadPdf = async () => ({ id: 'stub-media-id', ingestionStatus: 'Pending' });
  getMediaStatus = async () => ({ ingestionStatus: queue[Math.min(i++, queue.length - 1)] });
  chatWithGateway = async () => ({ message: 'stub answer', toolCalls: [], sessionId: 'stub-session-id' });
  sleep = () => new Promise(r => setTimeout(r, 5));

  const realNow = Date.now;
  if (${fastClock}) { let fake = realNow(); Date.now = () => (fake += 5000); }

  document.getElementById('loopTrace').innerHTML = '';
  document.getElementById('answerSection').classList.remove('visible');

  const settled = runAgenticLoop(new File(['x'], 'x.pdf'), 'what is the torque?')
    .then(() => 'resolved')
    .catch(e => 'rejected: ' + (e && e.message ? e.message : e));
  const outcome = await Promise.race([settled, new Promise(r => setTimeout(() => r('TIMEOUT'), 4000))]);
  Date.now = realNow;

  const card = document.getElementById('step-poll');
  return {
    outcome,
    exists: !!card,
    className: card ? card.className : '',
    detail: card ? (card.querySelector('.step-detail')?.textContent || '') : '',
  };`;

await goto(APP_URL, 'typeof runAgenticLoop === "function" && typeof explainIngestionStop === "function"');

const cases = [
  { statuses: ['Skipped'], label: 'Skipped (a scanned PDF)', names: 'Skipped', cause: /text layer|scan/i },
  { statuses: ['Failed'], label: 'Failed', names: 'Failed', cause: /readable PDF|try the upload again/i },
  { statuses: ['Quarantined'], label: 'an unknown status', names: 'Quarantined', cause: /not safe|unrecognised|unrecognized/i },
  { statuses: ['Pending'], label: 'never leaving Pending', names: 'Pending', cause: /two minutes|media pipeline/i, fastClock: true },
];

for (const c of cases) {
  const r = await evaluate(driveExpr(c.statuses, Boolean(c.fastClock)));

  check(`the loop stops on ${c.label}`, r.outcome !== 'TIMEOUT', String(r.outcome).slice(0, 90));
  if (r.outcome === 'TIMEOUT') continue;

  check(`...the Poll step exists after ${c.label}`, r.exists);
  if (!r.exists) continue;

  // The card must not be left looking like work still in progress.
  check(`...the Poll step is in the error state after ${c.label}`,
    /\berror\b/.test(r.className) && !/\bwaiting\b/.test(r.className),
    `class="${r.className}"`);

  check(`...the Poll step names "${c.names}" rather than keeping its in-flight text`,
    r.detail.includes(c.names), JSON.stringify(r.detail.slice(0, 110)));

  check(`...the Poll step says what the participant can do about ${c.label}`,
    c.cause.test(r.detail), JSON.stringify(r.detail.slice(0, 110)));

  // The specific stale-text regression: the untouched initial detail.
  check(`...the Poll step is not still claiming to be checking, after ${c.label}`,
    !/^Checking ingestion status/.test(r.detail.trim()), JSON.stringify(r.detail.slice(0, 60)));
}

// And the happy path must still end complete, not error.
const okRun = await evaluate(driveExpr(['Pending', 'Embedding', 'Completed']));
check('the Poll step ends complete when ingestion succeeds',
  okRun.outcome === 'resolved' && /\bcomplete\b/.test(okRun.className) && !/\berror\b/.test(okRun.className),
  `outcome=${okRun.outcome} class="${okRun.className}"`);

const errs = consoleLogs().filter(l => l.startsWith('[pageerror]'));
if (errs.length) console.log('\npage errors:\n' + errs.join('\n'));

close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:\n` + failures.map(f => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log('\nall poll-step checks passed');
