// This repo's adapter for the shared ingestion-poll check. Only the seams that
// differ between repos live here; everything asserted lives in
// ingestion-checks.mjs, which is a byte-identical copy of the one in
// workshop-1-ask-your-document so the two exercises are held to one standard.
//
// One difference from Workshop 1 worth knowing: there, Step 2 is a TODO the
// participant writes, so the check exempts the unimplemented skeleton. Here
// Steps 1-4 are pre-written on BOTH branches -- the poll loop ships as part of
// the exercise rather than being written by the participant. So no exemption
// ever applies, and every outcome assertion binds on `main` and `solution`
// alike. That is the point: the loop that hung is OURS in this repo, and a
// participant has no reason to look at it.
import { run } from './ingestion-checks.mjs';

await run({
  readyExpr: 'typeof isIngestionInFlight === "function" && typeof runAgenticLoop === "function"',

  // Drive the REAL runAgenticLoop with UMH stubbed to walk a given sequence of
  // statuses (the last one repeating forever), and race it against a deadline.
  // 'TIMEOUT' means the loop never settled, which is the hang being guarded.
  //
  // Returns four things about the run:
  //   outcome       'resolved' | 'rejected: …' | 'TIMEOUT'
  //   answered      did the answer actually reach the page
  //   unimplemented always false here (see the note above); kept so this file
  //                 stays a drop-in for the shared checks
  //   polled        did a poll step ever appear, i.e. did the loop really poll
  //
  // sleep() is shortened so a loop polling once a second does not need a
  // ten-second deadline to prove that it terminates.
  //
  // fastClock winds Date.now forward on every read, so a loop carrying a
  // two-minute budget reaches it inside this test instead of really waiting.
  // Only the loop's own deadline arithmetic reads that clock; the race below
  // uses setTimeout, which is untouched real time.
  settleExpr: (statuses, { fastClock = false } = {}) => `
    const queue = ${JSON.stringify(statuses)};
    let i = 0;
    uploadPdf = async () => ({ id: 'stub-media-id', ingestionStatus: 'Pending' });
    getMediaStatus = async () => ({ ingestionStatus: queue[Math.min(i++, queue.length - 1)] });
    // sessionId matters: the solution branch ends by calling
    // enableFollowUp(response.sessionId), which reads it. Returning a stub
    // without one would throw AFTER the answer rendered, and the check would
    // read that as the loop rejecting -- a false failure with a confusing
    // message, on the branch participants compare against.
    chatWithGateway = async () => ({ message: 'stub answer', toolCalls: [], sessionId: 'stub-session-id' });
    sleep = () => new Promise(r => setTimeout(r, 5));

    let answered = false;
    const realShowAnswer = showAnswer;
    showAnswer = (...args) => { answered = true; return realShowAnswer(...args); };

    const realNow = Date.now;
    if (${fastClock}) {
      let fake = realNow();
      Date.now = () => (fake += 5000);
    }

    // This repo has no resetTrace(); clear the same two regions handleRun does,
    // so each sequence starts from an empty trace and a hidden answer.
    document.getElementById('loopTrace').innerHTML = '';
    document.getElementById('answerSection').classList.remove('visible');

    const settled = runAgenticLoop(new File(['x'], 'x.pdf'), 'what is the torque?')
      .then(() => 'resolved')
      .catch(e => 'rejected: ' + (e && e.message ? e.message : e));
    const timeout = new Promise(r => setTimeout(() => r('TIMEOUT'), 4000));
    const outcome = await Promise.race([settled, timeout]);

    Date.now = realNow;
    showAnswer = realShowAnswer;

    const unimplemented = !!document.getElementById('step-todo');
    const polled = !!document.getElementById('step-poll');
    return { outcome, answered, unimplemented, polled };`,
});
