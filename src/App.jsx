import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const REPS_PER_SESSION = 10;
const REACTION_LIMIT_MS = 8000; // 8 seconds

const SCENARIOS = [
  { id: 1,  prompt: "Pick and Roll on top. Your defender goes UNDER the screen. You catch with feet set.",
    options: ["Shoot", "Drive", "Pass"], correct: "Shoot", tip: "Under = shoot or re-screen." },
  { id: 2,  prompt: "Wing catch. Strong-side corner is lifted; help steps to charge circle.",
    options: ["Skip Pass", "Floater", "Pull-up"], correct: "Skip Pass", tip: "Help in = skip to corner/weak-side." },
  { id: 3,  prompt: "2v1 fastbreak. Defender commits to ball at free-throw line.",
    options: ["Euro Finish", "Lob/Lead Pass", "Pull-up 3"], correct: "Lob/Lead Pass", tip: "Commit = pass to open teammate." },
  { id: 4,  prompt: "Corner catch. Closeout is long & off-balance.",
    options: ["Attack Middle", "One-More Pass", "Shoot"], correct: "Shoot", tip: "Bad long closeout = shoot." },
  { id: 5,  prompt: "Post touch. Weak-side defender digs at the bounce.",
    options: ["Kick Out", "Spin Middle", "Up-and-Under"], correct: "Kick Out", tip: "Dig = punish with kick." },
  { id: 6,  prompt: "Pick and Roll side. Big shows hard; roller is open.",
    options: ["Split", "Hit Roller", "Retreat Dribble"], correct: "Hit Roller", tip: "Show = roller advantage." },
  { id: 7,  prompt: "Baseline drive. Strong-side corner stays; weak-side tags.",
    options: ["Corner Drift Pass", "Floater", "Kick Top"], correct: "Corner Drift Pass", tip: "Baseline drive = drift." },
  { id: 8,  prompt: "Top ISO. Help is in the gap; clock at :05.",
    options: ["Step-back 3", "Drive Right", "Kick & Relocate"], correct: "Drive Right", tip: "Late clock: create advantage quickly." },
  { id: 9,  prompt: "Off-ball flare. Defender trails tight; no help high.",
    options: ["Curl to Rim", "Reject Cut", "Catch & Shoot"], correct: "Catch & Shoot", tip: "Trail + no help = catch & fire." },
  { id: 10, prompt: "3v2 break. Middle filled; wing has ball; opposite wing spotted.",
    options: ["Hit Opposite Wing", "Attack Middle", "Bounce to Middle"], correct: "Hit Opposite Wing", tip: "Pass ahead to open shooter." },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const HISTORY_KEY = "dst_history_v1";

function saveHistory(session) {
  const prev = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  prev.push(session);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(prev));
}
function getHistory() {
  return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
}

export default function App() {
  const [view, setView] = useState("intro"); // 'intro' | 'scene' | 'results'
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [current, setCurrent] = useState(null);
  const [results, setResults] = useState([]);

  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const fillRef = useRef(null);
  const fillIntervalRef = useRef(null);

  const startSession = useCallback(() => {
    const q = shuffle(SCENARIOS).slice(0, REPS_PER_SESSION);
    setQueue(q);
    setIndex(0);
    setResults([]);
    setView("scene");
    // next scenario is triggered by effect
  }, []);

  useEffect(() => {
    if (view !== "scene") return;
    if (index >= queue.length) {
      // end session
      const valid = results.filter(r => !r.tooSlow && r.choice !== "(no response)");
      const rts = valid.map(r => r.rt);
      const avg = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
      const fastest = rts.length ? Math.min(...rts) : 0;
      const med = median(rts);
      const acc = results.length ? (results.filter(r => r.correct && !r.tooSlow).length / results.length) * 100 : 0;
      const slow = results.filter(r => r.tooSlow).length;

      const session = {
        ts: new Date().toISOString(),
        avg: Math.round(avg || 0),
        median: Math.round(med || 0),
        fastest: Math.round(fastest || 0),
        accuracy: Math.round(acc || 0),
        reps: results.length,
        tooSlow: slow,
      };
      saveHistory(session);
      setView("results");
      return;
    }
    // render the new scenario + start timers
    const sc = queue[index];
    setCurrent(sc);

    // start timer
    startTimeRef.current = performance.now();
    timerRef.current = setTimeout(() => {
      selectOption("(no response)");
    }, REACTION_LIMIT_MS);

    // progress fill
    if (fillIntervalRef.current) clearInterval(fillIntervalRef.current);
    const start = performance.now();
    fillIntervalRef.current = setInterval(() => {
      if (!fillRef.current) return;
      const elapsed = performance.now() - start;
      const pct = Math.min(100, (elapsed / REACTION_LIMIT_MS) * 100);
      fillRef.current.style.width = pct + "%";
    }, 10);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(fillIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, index, queue]);

  const selectOption = useCallback((choice) => {
    const now = performance.now();
    const rt = now - startTimeRef.current;
    clearTimeout(timerRef.current);
    clearInterval(fillIntervalRef.current);

    const correct = choice === current?.correct;
    const tooSlow = rt > REACTION_LIMIT_MS;

    setResults(prev => [...prev, {
      id: current?.id, choice, correct, rt, tooSlow
    }]);

    // slight delay before next
    setTimeout(() => setIndex(i => i + 1), 350);
  }, [current]);

  const stats = useMemo(() => {
    const valid = results.filter(r => !r.tooSlow && r.choice !== "(no response)");
    const rts = valid.map(r => r.rt);
    const avg = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : 0;
    const fastest = rts.length ? Math.round(Math.min(...rts)) : 0;
    const med = Math.round(median(rts));
    const acc = results.length ? Math.round((results.filter(r => r.correct && !r.tooSlow).length / results.length) * 100) : 0;
    const slow = results.filter(r => r.tooSlow).length;
    return { avg, fastest, med, acc, slow, reps: results.length };
  }, [results]);

  const historyNote = useMemo(() => {
    const hist = getHistory();
    if (!hist.length) return "";
    const recent = hist.slice(-5).map(h =>
      `${new Date(h.ts).toLocaleString()} — avg ${h.avg}ms, acc ${h.accuracy}%`
    ).join(" | ");
    return `Recent sessions: ${recent}`;
  }, [view]); // recompute when we switch to results

  return (
    <div className="card">
      <header>
        <h1>Decision Speed Trainer</h1>
        <span className="badge">8s limit</span>
      </header>

      <main>
        {view === "intro" && (
          <section id="intro">
            <p>
              React fast to in-game scenarios. You have <b>8 seconds</b> to choose the best action. After {REPS_PER_SESSION} reps, see your speed and accuracy.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button className="btn primary" onClick={startSession}>Start</button>
              <button className="btn" onClick={() => { setQueue(shuffle(SCENARIOS).slice(0,1)); setIndex(0); setResults([]); setView("scene"); }}>
                Demo a Scenario
              </button>
            </div>
            <div className="grid">
              <div className="stat">History is saved locally in your browser.</div>
              <div className="stat">Add <code>imgUrl</code> to scenarios to show diagrams/GIFs.</div>
            </div>
          </section>
        )}

        {view === "scene" && current && (
          <section id="scene">
            <div className="scenario">
              <div className="media">
                {current.imgUrl ? (
                  <img src={current.imgUrl} alt="Scenario" />
                ) : (
                  <div className="placeholder">
                    No image for this scenario.<br />Add an <code>imgUrl</code> to show a diagram/GIF.
                  </div>
                )}
              </div>

              <div className="details">
                <div className="prompt">{current.prompt}</div>
                <div className="meta" style={{ visibility: "hidden" }} id="meta">
                  Best: {current.correct} • Tip: {current.tip}
                </div>

                <div className="timer-bar"><div className="timer-fill" ref={fillRef} /></div>

                <div className="choices">
                  {current.options.map(opt => (
                    <button key={opt} className="choice" onClick={() => {
                      // reveal meta line
                      const m = document.getElementById("meta");
                      if (m) m.style.visibility = "visible";
                      selectOption(opt);
                    }}>
                      {opt}
                    </button>
                  ))}
                </div>

                <div className="row">
                  <div className="muted">Scenario {index + 1} of {queue.length}</div>
                  {/* feedback text handled by meta visibility */}
                  <div className="muted">{/* placeholder */}</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {view === "results" && (
          <section id="results">
            <h2>Session Results</h2>
            <div className="grid">
              <div className="stat">Avg Reaction: <b>{stats.avg || "—"}</b> ms</div>
              <div className="stat">Accuracy: <b>{stats.acc}</b>%</div>
              <div className="stat">Too-Slow: <b>{stats.slow}</b></div>
            </div>
            <div className="grid">
              <div className="stat">Fastest: <b>{stats.fastest || "—"}</b> ms</div>
              <div className="stat">Median: <b>{stats.med || "—"}</b> ms</div>
              <div className="stat">Reps: <b>{stats.reps}</b></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button className="btn primary" onClick={startSession}>Play Again</button>
              <button className="btn" onClick={() => { localStorage.removeItem(HISTORY_KEY); window.location.reload(); }}>
                Clear History
              </button>
              <button className="btn" onClick={() => setView("intro")}>Home</button>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>{historyNote}</p>
          </section>
        )}
      </main>

      <footer>
        <span>v0.1 MVP — local only</span>
        <span>© You</span>
      </footer>
    </div>
  );
}
