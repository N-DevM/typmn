"use client";
import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { API_BASE } from "@/lib/api";

const FALLBACK_TEXTS = [
  "The quick brown fox jumps over the lazy dog. This classic sentence contains every letter of the alphabet and has been used for typing practice for generations.",
  "Programming is the art of telling a computer what to do. Every great software application begins with a single line of code written by a passionate developer.",
  "Success is not final and failure is not fatal. It is the courage to continue that counts. Every champion was once a contender who refused to give up.",
  "Technology is best when it brings people together. The internet has connected billions of minds across the globe creating endless possibilities for collaboration.",
  "The only way to do great work is to love what you do. If you have not found it yet keep looking and do not settle. As with all matters of the heart you will know when you find it.",
];

function RaceCar({ color, glow }: { color: string; glow?: boolean }) {
  return (
    <svg width="36" height="16" viewBox="0 0 36 16" fill="none" style={{ filter: glow ? `drop-shadow(0 0 6px ${color})` : undefined }}>
      <rect x="4" y="4" width="28" height="9" rx="3" fill={color} />
      <rect x="1" y="7" width="34" height="6" rx="2" fill={color} opacity="0.8" />
      <rect x="8" y="2" width="12" height="6" rx="2" fill={color} opacity="0.6" />
      <rect x="22" y="3" width="8" height="5" rx="1.5" fill="rgba(255,255,255,0.3)" />
      <rect x="10" y="3" width="8" height="4" rx="1.5" fill="rgba(255,255,255,0.2)" />
      <circle cx="9" cy="14" r="2.5" fill="#1a1a2e" />
      <circle cx="9" cy="14" r="1.5" fill="#333" />
      <circle cx="27" cy="14" r="2.5" fill="#1a1a2e" />
      <circle cx="27" cy="14" r="1.5" fill="#333" />
      <rect x="32" y="8" width="3" height="2" rx="1" fill="#f43f5e" opacity="0.8" />
      <rect x="1" y="9" width="2" height="1.5" rx="0.5" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

// Sound Engine
class SoundEngine {
  private ctx: AudioContext | null = null;
  private init() { 
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx(); 
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  playKey() {
    this.init(); if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.connect(g); g.connect(this.ctx.destination);
    o.frequency.setValueAtTime(800 + Math.random() * 400, this.ctx.currentTime);
    o.type = "square"; g.gain.setValueAtTime(0.03, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    o.start(); o.stop(this.ctx.currentTime + 0.05);
  }
  playErr() {
    this.init(); if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.connect(g); g.connect(this.ctx.destination);
    o.frequency.setValueAtTime(200, this.ctx.currentTime); o.type = "sawtooth";
    g.gain.setValueAtTime(0.04, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    o.start(); o.stop(this.ctx.currentTime + 0.08);
  }
  playDone() {
    this.init(); if (!this.ctx) return;
    [523, 659, 784].forEach((f, i) => {
      const o = this.ctx!.createOscillator(), g = this.ctx!.createGain();
      o.connect(g); g.connect(this.ctx!.destination);
      o.frequency.setValueAtTime(f, this.ctx!.currentTime + i * 0.1); o.type = "sine";
      g.gain.setValueAtTime(0.1, this.ctx!.currentTime + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + i * 0.1 + 0.4);
      o.start(this.ctx!.currentTime + i * 0.1); o.stop(this.ctx!.currentTime + i * 0.1 + 0.4);
    });
  }
}
const sound = typeof window !== "undefined" ? new SoundEngine() : null;

const TextDisplay = memo(({ textChars }: { textChars: string[] }) => (
  <>{textChars.map((c, i) => <span key={i} className={i === 0 ? "char current" : "char upcoming"}>{c}</span>)}</>
));
TextDisplay.displayName = "TextDisplay";

export default function PublicPracticePage() {
  const [text, setText] = useState("");
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [errors, setErrors] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [gameMode, setGameMode] = useState<"text" | "game">("text");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const textRef = useRef("");
  const inputValRef = useRef("");
  const startTimeRef = useRef(0);
  const finishedRef = useRef(false);
  const gameModeRef = useRef<"text" | "game">("text");
  const textChars = useMemo(() => text.split(""), [text]);

  useEffect(() => { textRef.current = text; }, [text]);
  useEffect(() => { inputValRef.current = input; }, [input]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => {
    if (typeof window !== "undefined") setIsLoggedIn(!!localStorage.getItem("token"));
  }, []);

  const fetchText = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/practice/quotes?difficulty=2&limit=1`);
      const d = await res.json();
      if (d.quotes?.[0]?.text) setText(d.quotes[0].text);
      else setText(FALLBACK_TEXTS[Math.floor(Math.random() * FALLBACK_TEXTS.length)]);
    } catch {
      setText(FALLBACK_TEXTS[Math.floor(Math.random() * FALLBACK_TEXTS.length)]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchText(); }, [fetchText]);

  // WPM tracker
  useEffect(() => {
    if (!started || finished) return;
    const iv = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 60000;
      if (elapsed > 0) setWpm(Math.round((inputValRef.current.length / 5) / elapsed));
    }, 500);
    return () => clearInterval(iv);
  }, [started, finished]);

  const doFinish = useCallback((val: string) => {
    finishedRef.current = true;
    setFinished(true);
    sound?.playDone();
    const elapsed = (Date.now() - startTimeRef.current) / 60000;
    const finalWpm = elapsed > 0 ? Math.round((val.length / 5) / elapsed) : 0;
    setWpm(finalWpm);
    let correct = 0, totalErrors = 0;
    for (let i = 0; i < val.length; i++) {
      if (val[i] === textRef.current[i]) correct++; else totalErrors++;
    }
    const finalAcc = val.length > 0 ? Math.round((correct / val.length) * 1000) / 10 : 100;
    setAccuracy(finalAcc);
    setErrors(totalErrors);

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      fetch(`${API_BASE}/api/practice/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: "PRACTICE", wpm: finalWpm, cpm: finalWpm * 5,
          accuracy: finalAcc, errors: totalErrors, consistency: 0,
          duration: Math.round((Date.now() - startTimeRef.current) / 1000),
          textLength: val.length, wpmHistory: [],
        }),
      }).catch(() => {});
    }
  }, []);

  // Shared text highlighting function
  const updateTextHighlight = (val: string) => {
    const spans = textDisplayRef.current?.children;
    if (!spans) return;
    const t = textRef.current;
    for (let i = 0; i < t.length; i++) {
      if (!spans[i]) break;
      let cls = "char upcoming";
      if (i < val.length) cls = val[i] === t[i] ? "char correct" : "char wrong";
      else if (i === val.length) cls = "char current";
      if (spans[i].className !== cls) spans[i].className = cls;
    }
    // Auto-scroll to current position
    if (val.length < t.length && spans[val.length]) {
      const currentEl = spans[val.length] as HTMLElement;
      if (currentEl && textDisplayRef.current) {
        const container = textDisplayRef.current;
        const topPos = currentEl.offsetTop - container.offsetTop;
        if (topPos > container.scrollTop + container.clientHeight - 60) {
          container.scrollTo({ top: topPos - container.clientHeight / 2, behavior: "smooth" });
        } else if (topPos < container.scrollTop) {
          container.scrollTo({ top: topPos - 20, behavior: "smooth" });
        }
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (finishedRef.current) return;
    const val = e.target.value;
    if (!started) { setStarted(true); setStartTime(Date.now()); startTimeRef.current = Date.now(); }
    if (val.length - input.length > 5) return;
    setInput(val);

    // Sound
    if (val.length > input.length) {
      if (val[val.length - 1] === textRef.current[val.length - 1]) sound?.playKey();
      else sound?.playErr();
    }

    updateTextHighlight(val);

    let correct = 0;
    for (let i = 0; i < val.length; i++) { if (val[i] === textRef.current[i]) correct++; }
    setAccuracy(val.length > 0 ? Math.round((correct / val.length) * 1000) / 10 : 100);
    
    // Move car
    const progress = Math.min(100, Math.round((val.length / textRef.current.length) * 100));
    if (carRef.current) {
      carRef.current.style.left = `calc(${Math.min(92, progress)}% - 18px)`;
    }

    if (val.length >= textRef.current.length) doFinish(val);
  };

  // Game mode: keyboard handler
  useEffect(() => {
    if (gameMode !== "game") return;
    const handler = (e: KeyboardEvent) => {
      if (finishedRef.current) return;
      if (e.key.length !== 1 && e.key !== "Backspace") return;
      e.preventDefault();

      let val = inputValRef.current;
      if (e.key === "Backspace") val = val.slice(0, -1);
      else val += e.key;
      inputValRef.current = val;
      setInput(val);

      if (!started && val.length === 1) { setStarted(true); setStartTime(Date.now()); startTimeRef.current = Date.now(); }

      if (e.key !== "Backspace") {
        if (val[val.length - 1] === textRef.current[val.length - 1]) sound?.playKey();
        else sound?.playErr();
      }

      updateTextHighlight(val);

      let correct = 0;
      for (let i = 0; i < val.length; i++) { if (val[i] === textRef.current[i]) correct++; }
      setAccuracy(val.length > 0 ? Math.round((correct / val.length) * 1000) / 10 : 100);
      
      // Move car
      const progress = Math.min(100, Math.round((val.length / textRef.current.length) * 100));
      if (carRef.current) {
        carRef.current.style.left = `calc(${Math.min(92, progress)}% - 18px)`;
      }

      if (val.length >= textRef.current.length) doFinish(val);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [gameMode, started, doFinish]);

  const reset = () => {
    setInput(""); setStarted(false); setFinished(false); finishedRef.current = false;
    inputValRef.current = "";
    if (carRef.current) carRef.current.style.left = "-18px";
    if (textDisplayRef.current) {
      const spans = textDisplayRef.current.children;
      for (let i = 0; i < spans.length; i++) spans[i].className = i === 0 ? "char current" : "char upcoming";
    }
    fetchText();
    if (gameMode === "text") inputRef.current?.focus();
  };

  return (
    <>
      <style>{`
        .pp { min-height: 100vh; background: #0a0a0f; color: #e4e4e7; display: flex; flex-direction: column; font-family: 'Inter', -apple-system, sans-serif; }
        .pp-nav { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 2rem; border-bottom: 1px solid rgba(255,255,255,0.06); background: #111118; }
        .pp-logo { font-size: 1.25rem; font-weight: 900; color: #fff; text-decoration: none; display: flex; align-items: center; gap: 0.5rem; letter-spacing: -0.02em; }
        .pp-logo-accent { color: #818cf8; }
        .pp-links { display: flex; gap: 1.25rem; align-items: center; }
        .pp-links a { color: #71717a; text-decoration: none; font-size: 0.8125rem; font-weight: 500; transition: color 150ms; }
        .pp-links a:hover { color: #e4e4e7; }
        .pp-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; max-width: 900px; margin: 0 auto; width: 100%; }

        /* Mode Toggle */
        .pp-mode { display: flex; position: relative; background: #111118; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 4px; margin-bottom: 1.75rem; }
        .pp-mode-slider { position: absolute; top: 4px; left: 4px; width: calc(50% - 4px); height: calc(100% - 8px); background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(129,140,248,0.12)); border: 1px solid rgba(99,102,241,0.3); border-radius: 10px; transition: transform 350ms cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 20px rgba(99,102,241,0.15); }
        .pp-mode-btn { flex: 1; padding: 0.75rem 1.75rem; font-size: 0.8125rem; font-weight: 600; color: #52525b; background: none; border: none; cursor: pointer; transition: color 250ms; display: flex; align-items: center; justify-content: center; gap: 0.5rem; position: relative; z-index: 1; white-space: nowrap; }
        .pp-mode-btn:hover { color: #a1a1aa; }
        .pp-mode-btn.active { color: #818cf8; }
        .pp-mode-btn svg { transition: transform 250ms; }
        .pp-mode-btn:hover svg { transform: scale(1.15); }
        .pp-mode-btn.active svg { filter: drop-shadow(0 0 4px rgba(129,140,248,0.5)); }

        .pp-stats { display: flex; gap: 2.5rem; margin-bottom: 1.5rem; }
        .pp-stat { text-align: center; }
        .pp-stat-val { font-size: 2rem; font-weight: 900; font-family: 'JetBrains Mono', monospace; color: #818cf8; }
        .pp-stat-label { font-size: 0.625rem; color: #52525b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .pp-text-box { position: relative; background: #111118; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1.5rem; min-height: 120px; cursor: text; width: 100%; margin-bottom: 1.25rem; font-size: 1rem; line-height: 1.9; }
        .pp-text-box:focus-within { border-color: rgba(99,102,241,0.4); box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }
        .pp-text-content { white-space: pre-wrap; word-break: break-word; user-select: none; max-height: 180px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #27272a transparent; }
        .pp-text-content::-webkit-scrollbar { width: 4px; }
        .pp-text-content::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
        .pp-input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: text; font-size: 1rem; resize: none; }
        .char.upcoming { color: #3f3f46; }
        .char.current { color: #e4e4e7; background: rgba(99,102,241,0.25); border-radius: 2px; padding: 1px 0; }
        .char.correct { color: #22c55e; }
        .char.wrong { color: #f43f5e; text-decoration: underline; text-underline-offset: 2px; }
        .pp-actions { display: flex; gap: 0.75rem; align-items: center; }
        .pp-btn { padding: 0.75rem 1.5rem; border-radius: 10px; font-weight: 700; border: none; cursor: pointer; font-size: 0.875rem; transition: all 200ms; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; }
        .pp-btn-primary { background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; box-shadow: 0 3px 12px rgba(99,102,241,0.3); }
        .pp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99,102,241,0.4); }
        .pp-btn-green { background: linear-gradient(135deg, #16a34a, #22c55e); color: white; box-shadow: 0 3px 12px rgba(34,197,94,0.3); }
        .pp-btn-green:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(34,197,94,0.4); }
        .pp-btn-secondary { background: #18181b; color: #a1a1aa; border: 1px solid rgba(255,255,255,0.08); }
        .pp-btn-secondary:hover { border-color: rgba(255,255,255,0.15); color: #fff; }
        .pp-results { background: #111118; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 2rem; width: 100%; text-align: center; }
        .pp-results h2 { font-size: 1.375rem; font-weight: 800; margin-bottom: 1.5rem; }
        .pp-results-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem; }
        .pp-cta { margin-top: 1.25rem; padding: 0.875rem; background: rgba(99,102,241,0.06); border-radius: 10px; border: 1px solid rgba(99,102,241,0.15); font-size: 0.875rem; color: #a1a1aa; }
        .pp-cta a { color: #818cf8; font-weight: 600; text-decoration: none; }
        .pp-cta a:hover { text-decoration: underline; }
        .pp-loading { font-size: 0.875rem; color: #52525b; }
        .pp-game-hint { text-align: center; color: #52525b; font-size: 0.75rem; margin-bottom: 0.5rem; }
        .pp-track-container { background: #0f0f14; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1.5rem 1rem; margin-bottom: 1.25rem; position: relative; overflow: hidden; width: 100%; }
        .pp-track-road { position: absolute; top: 50%; left: 1rem; right: 1rem; height: 20px; transform: translateY(-50%); background: #1a1a22; border-radius: 3px; overflow: hidden; }
        .pp-track-road::after { content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 2px; transform: translateY(-50%); background: repeating-linear-gradient(90deg, #333 0px, #333 12px, transparent 12px, transparent 24px); }
        .pp-car-wrap { position: absolute; top: 50%; transform: translateY(-50%); z-index: 3; transition: left 150ms linear; left: -18px; }
        .pp-track-area { position: relative; height: 32px; width: 100%; }
        .pp-finish-line { position: absolute; right: 1rem; top: 0; bottom: 0; width: 16px; background: repeating-conic-gradient(#fff 0% 25%, #222 0% 50%) 0 0 / 8px 8px; opacity: 0.35; z-index: 1; }
      `}</style>
      <div className="pp">
        <nav className="pp-nav">
          <a href="/" className="pp-logo"><span>⌨</span> Typ<span className="pp-logo-accent">mN</span></a>
          <div className="pp-links">
            <a href="/leaderboard">Leaderboard</a>
            <a href="/race">Compete</a>
            {isLoggedIn ? (
              <a href="/dashboard">Dashboard</a>
            ) : (
              <>
                <a href="/login">Log In</a>
                <a href="/register" style={{ background: "#6366f1", color: "white", padding: "0.5rem 1rem", borderRadius: "10px", fontWeight: 600 }}>Sign Up</a>
              </>
            )}
          </div>
        </nav>

        <div className="pp-body">
          {/* Mode Toggle */}
          <div className="pp-mode">
            <div className="pp-mode-slider" style={{ transform: gameMode === "game" ? "translateX(100%)" : "translateX(0)" }} />
            <button className={`pp-mode-btn ${gameMode === "text" ? "active" : ""}`} onClick={() => { setGameMode("text"); gameModeRef.current = "text"; }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Text Mode
            </button>
            <button className={`pp-mode-btn ${gameMode === "game" ? "active" : ""}`} onClick={() => { setGameMode("game"); gameModeRef.current = "game"; }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="4" y1="12" x2="8" y2="12"/><circle cx="15" cy="10" r="1" fill="currentColor"/><circle cx="18" cy="12" r="1" fill="currentColor"/></svg>
              Game Mode
            </button>
          </div>

          {/* Stats */}
          <div className="pp-stats">
            <div className="pp-stat"><div className="pp-stat-val">{wpm}</div><div className="pp-stat-label">WPM</div></div>
            <div className="pp-stat"><div className="pp-stat-val">{accuracy}%</div><div className="pp-stat-label">Accuracy</div></div>
          </div>

          {!finished ? (
            <>
              {loading ? (
                <div className="pp-loading">Loading text...</div>
              ) : (
                <>
                  {gameMode === "game" && (
                    <div className="pp-track-container">
                      <div className="pp-finish-line" />
                      <div className="pp-track-area">
                        <div className="pp-track-road" />
                        <div className="pp-car-wrap" ref={carRef}>
                          <RaceCar color="#6366f1" glow={true} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="pp-text-box" onClick={() => { if (gameMode === "text") inputRef.current?.focus(); }} tabIndex={gameMode === "game" ? 0 : undefined}>
                    <div ref={textDisplayRef} className="pp-text-content"><TextDisplay textChars={textChars} /></div>
                    {gameMode === "text" && (
                      <textarea ref={inputRef} className="pp-input" value={input}
                        onChange={handleInput} onPaste={(e) => e.preventDefault()} autoFocus
                        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
                    )}
                  </div>
                </>
              )}
              <div className="pp-actions">
                <button className="pp-btn pp-btn-secondary" onClick={reset}>↻ New Text</button>
              </div>
            </>
          ) : (
            <div className="pp-results">
              <h2>🎉 Practice Complete!</h2>
              <div className="pp-results-grid">
                <div className="pp-stat"><div className="pp-stat-val">{wpm}</div><div className="pp-stat-label">WPM</div></div>
                <div className="pp-stat"><div className="pp-stat-val">{accuracy}%</div><div className="pp-stat-label">Accuracy</div></div>
                <div className="pp-stat"><div className="pp-stat-val">{errors}</div><div className="pp-stat-label">Errors</div></div>
              </div>
              <div className="pp-actions" style={{ justifyContent: "center" }}>
                <button className="pp-btn pp-btn-primary" onClick={reset}>Practice Again</button>
                <a href="/race" className="pp-btn pp-btn-green" style={{ textDecoration: "none" }}>🏁 Race Now</a>
              </div>
              {!isLoggedIn && (
                <div className="pp-cta">
                  <a href="/register">Create a free account</a> to save stats, climb the leaderboard, and compete!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
