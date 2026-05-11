"use client";
import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import styles from "./practice.module.css";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

const MODES = [
  { id: "TIME_15", label: "15s", type: "time", value: 15 },
  { id: "TIME_30", label: "30s", type: "time", value: 30 },
  { id: "TIME_60", label: "60s", type: "time", value: 60 },
  { id: "TIME_120", label: "2m", type: "time", value: 120 },
  { id: "TIME_180", label: "3m", type: "time", value: 180 },
];

function RaceCar({ color, glow }: { color: string; glow?: boolean }) {
  return (
    <svg width="36" height="16" viewBox="0 0 36 16" fill="none" style={{ filter: glow ? `drop-shadow(0 0 6px ${color})` : undefined }}>
      <rect x="4" y="4" width="28" height="9" rx="3" fill={color} />
      <rect x="1" y="7" width="34" height="6" rx="2" fill={color} opacity="0.8" />
      <rect x="8" y="2" width="12" height="6" rx="2" fill={color} opacity="0.6" />
      <rect x="22" y="3" width="8" height="5" rx="1.5" fill="rgba(255,255,255,0.3)" />
      <rect x="10" y="3" width="8" height="4" rx="1.5" fill="rgba(255,255,255,0.2)" />
      <circle cx="9" cy="14" r="2.5" fill="#1a1a2e" /><circle cx="9" cy="14" r="1.5" fill="#333" />
      <circle cx="27" cy="14" r="2.5" fill="#1a1a2e" /><circle cx="27" cy="14" r="1.5" fill="#333" />
      <rect x="32" y="8" width="3" height="2" rx="1" fill="#f43f5e" opacity="0.8" />
      <rect x="1" y="9" width="2" height="1.5" rx="0.5" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

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

const DIFFICULTIES = [
  { id: 1, label: "Easy", color: "#10b981" },
  { id: 2, label: "Medium", color: "#f59e0b" },
  { id: 3, label: "Hard", color: "#f43f5e" },
];

const TextDisplay = memo(({ textChars }: { textChars: string[] }) => {
  return (
    <>
      {textChars.map((char, i) => (
        <span key={i} className={i === 0 ? styles.current : styles.upcoming}>{char}</span>
      ))}
    </>
  );
});
TextDisplay.displayName = 'TextDisplay';

export default function PracticePage() {
  const [mode, setMode] = useState(MODES[2]);
  const [difficulty, setDifficulty] = useState(2);
  const [text, setText] = useState("");
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [errors, setErrors] = useState(0);
  const [wpmHistory, setWpmHistory] = useState<{ time: number; wpm: number }[]>([]);
  const [xpEarned, setXpEarned] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [dailyChallenge, setDailyChallenge] = useState<any>(null);
  const [newAchievements, setNewAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameMode, setGameMode] = useState<"text" | "game">("text");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const gameModeRef = useRef<"text" | "game">("text");
  const finishedRef = useRef(false);
  const startTimeRef = useRef(0);
  const inputValRef = useRef("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Anti-cheat tracking
  const [tabSwitches, setTabSwitches] = useState(0);
  const [pasteAttempts, setPasteAttempts] = useState(0);
  const [focusLosses, setFocusLosses] = useState(0);
  const [antiCheatWarning, setAntiCheatWarning] = useState("");
  const keystrokeTimesRef = useRef<number[]>([]);
  const lastKeystrokeRef = useRef<number>(0);

  const inputRefValue = useRef(input);
  const textChars = useMemo(() => text.split(""), [text]);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const textRef = useRef(text);

  useEffect(() => {
    inputRefValue.current = input;
    inputValRef.current = input;
  }, [input]);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  // Fetch text from backend
  const fetchText = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getQuotes(difficulty, 1);
      if (data.quotes && data.quotes.length > 0) {
        setText(data.quotes[0].text);
      } else {
        setText(getFallbackText());
      }
    } catch {
      setText(getFallbackText());
    }
    setLoading(false);
  }, [difficulty]);

  useEffect(() => {
    fetchText();
    setTimeLeft(mode.value);
  }, [mode, difficulty, fetchText]);

  // Fetch daily challenge
  useEffect(() => {
    const token = getToken();
    if (token) {
      api.getDailyChallenge().then(d => setDailyChallenge(d)).catch(() => {});
    }
  }, []);

  // Anti-cheat: Tab visibility detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && started && !finished) {
        setTabSwitches(prev => {
          const next = prev + 1;
          if (next >= 3) setAntiCheatWarning("⚠️ Multiple tab switches detected. This may be flagged.");
          return next;
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [started, finished]);

  // Anti-cheat: Focus loss detection
  useEffect(() => {
    const handleBlur = () => {
      if (started && !finished) setFocusLosses(prev => prev + 1);
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [started, finished]);

  // Timer
  useEffect(() => {
    if (started && !finished && mode.type === "time") {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [started, finished, mode.type]);

  // WPM calc
  useEffect(() => {
    if (started && !finished) {
      const iv = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 60000;
        if (elapsed > 0) {
          const currentInput = inputRefValue.current;
          const wordsTyped = currentInput.trim().split(/\s+/).filter(w => w.length > 0).length;
          const currentWpm = Math.round(wordsTyped / elapsed);
          setWpm(currentWpm);
          setWpmHistory(prev => [...prev, { time: Math.round(elapsed * 60), wpm: currentWpm }]);
        }
      }, 1000);
      return () => clearInterval(iv);
    }
  }, [started, finished, startTime]);

  const finishPractice = useCallback(() => {
    setFinished(true);
    finishedRef.current = true;
    sound?.playDone();
    if (timerRef.current) clearInterval(timerRef.current);

    const elapsed = (Date.now() - startTime) / 60000;
    const wordsTyped = input.trim().split(/\s+/).filter(w => w.length > 0).length;
    const finalWpm = elapsed > 0 ? Math.round(wordsTyped / elapsed) : 0;
    setWpm(finalWpm);

    let correct = 0; let totalErrors = 0;
    for (let i = 0; i < input.length; i++) {
      if (input[i] === text[i]) correct++; else totalErrors++;
    }
    const finalAccuracy = input.length > 0 ? Math.round((correct / input.length) * 1000) / 10 : 100;
    setAccuracy(finalAccuracy);
    setErrors(totalErrors);

    const token = getToken();
    if (token) {
      // Calculate keystroke timing stats for anti-cheat
      const intervals = keystrokeTimesRef.current;
      const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
      const stdDev = intervals.length > 1 ? Math.sqrt(intervals.reduce((sum, v) => sum + Math.pow(v - avgInterval, 2), 0) / intervals.length) : 0;

      api.submitPracticeResult({
        mode: mode.id, wpm: finalWpm, cpm: finalWpm * 5,
        accuracy: finalAccuracy, errors: totalErrors, consistency: 0,
        duration: Math.round((Date.now() - startTime) / 1000),
        textLength: input.length, wpmHistory,
        tabSwitches, pasteAttempts, focusLosses,
        keystrokeIntervals: { avg: Math.round(avgInterval), stdDev: Math.round(stdDev), count: intervals.length },
      }).then(d => {
        if (d.xpEarned) setXpEarned(d.xpEarned);
        setShowResults(true);
      }).catch(() => setShowResults(true));

      api.updateStreak().catch(() => {});

      api.checkAchievements().then(d => {
        if (d.newAchievements?.length > 0) setNewAchievements(d.newAchievements);
      }).catch(() => {});
    } else {
      setShowResults(true);
    }
  }, [input, text, startTime, mode, wpmHistory, tabSwitches, pasteAttempts, focusLosses]);

  // Finish practice when time is up
  useEffect(() => {
    if (timeLeft === 0 && started && !finished) {
      finishPractice();
    }
  }, [timeLeft, started, finished, finishPractice]);

  // Shared text highlighting function
  const updateTextHighlight = (val: string) => {
    const spans = textDisplayRef.current?.children;
    if (!spans) return;
    const t = textRef.current;
    for (let i = 0; i < t.length; i++) {
      if (!spans[i]) break;
      let cls = styles.upcoming;
      if (i < val.length) cls = val[i] === t[i] ? styles.correct : styles.wrong;
      else if (i === val.length) cls = styles.current;
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

  // Move car based on progress
  const updateCar = (val: string) => {
    const progress = Math.min(100, Math.round((val.length / textRef.current.length) * 100));
    if (carRef.current) {
      carRef.current.style.left = `calc(${Math.min(92, progress)}% - 18px)`;
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (finished || finishedRef.current) return;
    const val = e.target.value;

    if (!started) { setStarted(true); setStartTime(Date.now()); startTimeRef.current = Date.now(); }

    if (val.length - input.length > 5) {
      setPasteAttempts(prev => prev + 1);
      setAntiCheatWarning("⚠️ Paste detected! Only typed input is allowed.");
      setTimeout(() => setAntiCheatWarning(""), 3000);
      return;
    }

    // Record keystroke interval for anti-cheat
    const now = performance.now();
    if (lastKeystrokeRef.current > 0) {
      const interval = now - lastKeystrokeRef.current;
      if (keystrokeTimesRef.current.length < 500) {
        keystrokeTimesRef.current.push(interval);
      }
    }
    lastKeystrokeRef.current = now;

    // Sound
    if (val.length > input.length) {
      if (val[val.length - 1] === textRef.current[val.length - 1]) sound?.playKey();
      else sound?.playErr();
    }

    setInput(val);
    updateTextHighlight(val);
    updateCar(val);

    let correct = 0;
    for (let i = 0; i < val.length; i++) { if (val[i] === textRef.current[i]) correct++; }
    setAccuracy(val.length > 0 ? Math.round((correct / val.length) * 1000) / 10 : 100);

    if (val.length >= textRef.current.length) finishPractice();
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

      // Record keystroke interval for anti-cheat
      const now = performance.now();
      if (lastKeystrokeRef.current > 0) {
        const interval = now - lastKeystrokeRef.current;
        if (keystrokeTimesRef.current.length < 500) {
          keystrokeTimesRef.current.push(interval);
        }
      }
      lastKeystrokeRef.current = now;

      updateTextHighlight(val);
      updateCar(val);

      let correct = 0;
      for (let i = 0; i < val.length; i++) { if (val[i] === textRef.current[i]) correct++; }
      setAccuracy(val.length > 0 ? Math.round((correct / val.length) * 1000) / 10 : 100);

      if (val.length >= textRef.current.length) finishPractice();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [gameMode, started, finishPractice]);

  const reset = () => {
    setInput(""); setStarted(false); setFinished(false); finishedRef.current = false;
    inputValRef.current = "";
    setWpm(0); setAccuracy(100); setErrors(0); setWpmHistory([]); setXpEarned(0);
    setTimeLeft(mode.value); setShowResults(false); setNewAchievements([]);
    setTabSwitches(0); setPasteAttempts(0); setFocusLosses(0); setAntiCheatWarning("");
    keystrokeTimesRef.current = []; lastKeystrokeRef.current = 0;
    if (carRef.current) carRef.current.style.left = "-18px";
    
    if (textDisplayRef.current) {
      const spans = textDisplayRef.current.children;
      for (let i = 0; i < spans.length; i++) {
        spans[i].className = i === 0 ? styles.current : styles.upcoming;
      }
    }
    
    fetchText();
    if (timerRef.current) clearInterval(timerRef.current);
    if (gameMode === "text") inputRef.current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setPasteAttempts(prev => prev + 1);
    setAntiCheatWarning("⚠️ Paste is disabled during practice!");
    setTimeout(() => setAntiCheatWarning(""), 3000);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (started && !finished) e.preventDefault();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}`;
  };

  return (
    <div className={styles.practicePage} onContextMenu={handleContextMenu}>
      <Sidebar activePage="practice" />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Typing Practice</h1>
          <p className={styles.subtitle}>Choose your mode, difficulty, and start typing</p>
        </div>

        {/* Daily Challenge Banner */}
        {dailyChallenge?.challenges && (
          <div className={styles.challengeBanner}>
            <div className={styles.challengeTitle}>🎯 Daily Challenges</div>
            <div className={styles.challengeList}>
              {dailyChallenge.challenges.map((c: any, i: number) => (
                <div key={i} className={styles.challengeItem}>
                  <span>{c.title}: {c.description}</span>
                  <span className={styles.challengeXp}>+{c.xpReward} XP</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {antiCheatWarning && (
          <div className={styles.antiCheatWarning}>{antiCheatWarning}</div>
        )}

        {/* Text Mode / Game Mode Toggle */}
        <div className={styles.modeToggle}>
          <div className={styles.modeSlider} style={{ transform: gameMode === "game" ? "translateX(100%)" : "translateX(0)" }} />
          <button className={`${styles.modeToggleBtn} ${gameMode === "text" ? styles.modeToggleBtnActive : ""}`}
            onClick={() => { setGameMode("text"); gameModeRef.current = "text"; reset(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Text Mode
          </button>
          <button className={`${styles.modeToggleBtn} ${gameMode === "game" ? styles.modeToggleBtnActive : ""}`}
            onClick={() => { setGameMode("game"); gameModeRef.current = "game"; reset(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="4" y1="12" x2="8" y2="12"/><circle cx="15" cy="10" r="1" fill="currentColor"/><circle cx="18" cy="12" r="1" fill="currentColor"/></svg>
            Game Mode
          </button>
        </div>

        {/* Mode Selector */}
        <div className={styles.modeSelector}>
          <div className={styles.modeGroup}>
            <span className={styles.modeGroupLabel}>Duration</span>
            <div className={styles.modeBtns}>
              {MODES.map(m => (
                <button key={m.id} className={`${styles.modeBtn} ${mode.id === m.id ? styles.modeActive : ""}`}
                  onClick={() => { setMode(m); reset(); }}>{m.label}</button>
              ))}
            </div>
          </div>
          <div className={styles.modeGroup}>
            <span className={styles.modeGroupLabel}>Difficulty</span>
            <div className={styles.modeBtns}>
              {DIFFICULTIES.map(d => (
                <button key={d.id}
                  className={`${styles.modeBtn} ${difficulty === d.id ? styles.modeActive : ""}`}
                  style={difficulty === d.id ? { borderColor: d.color, color: d.color, background: `${d.color}15` } : {}}
                  onClick={() => { setDifficulty(d.id); }}>{d.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className={styles.metrics}>
          <div className={styles.metricCard}>
            <div className={styles.metricVal}>{formatTime(timeLeft)}</div>
            <div className={styles.metricLbl}>TIME LEFT</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricVal} style={{ color: "var(--accent-indigo)" }}>{wpm}</div>
            <div className={styles.metricLbl}>WPM</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricVal} style={{ color: accuracy >= 95 ? "var(--accent-emerald)" : "var(--accent-amber)" }}>{accuracy}%</div>
            <div className={styles.metricLbl}>ACCURACY</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricVal}>{input.length}/{text.length}</div>
            <div className={styles.metricLbl}>PROGRESS</div>
          </div>
        </div>

        {/* Typing Area */}
        {/* Race Track (Game Mode only) */}
        {gameMode === "game" && !finished && !loading && (
          <div className={styles.raceTrack}>
            <div className={styles.finishLine} />
            <div className={styles.trackArea}>
              <div className={styles.trackRoad} />
              <div className={styles.carWrap} ref={carRef}>
                <RaceCar color="#6366f1" glow={true} />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className={styles.typingArea} style={{ textAlign: "center", padding: "3rem" }}>
            <div className={styles.metricLbl}>Loading text...</div>
          </div>
        ) : !finished ? (
          <div className={styles.typingArea} onClick={() => { if (gameMode === "text") inputRef.current?.focus(); }} tabIndex={gameMode === "game" ? 0 : undefined}>
            <div className={styles.textDisplay} ref={textDisplayRef}>
              <TextDisplay textChars={textChars} />
            </div>
            {gameMode === "text" && (
              <textarea ref={inputRef} className={styles.hiddenInput}
                value={input} onChange={handleInput} onPaste={handlePaste}
                autoFocus spellCheck={false} autoComplete="off" autoCapitalize="off" />
            )}
            {!started && <div className={styles.startHint}>{gameMode === "game" ? "Start typing on your keyboard..." : "Click and start typing..."}</div>}

            {started && (tabSwitches > 0 || pasteAttempts > 0) && (
              <div className={styles.antiCheatBadge}>
                🛡️ {tabSwitches > 0 && `Tabs: ${tabSwitches}`} {pasteAttempts > 0 && `Pastes: ${pasteAttempts}`}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.results}>
            <h2 className={styles.resultsTitle}>🎉 Practice Complete!</h2>

            {newAchievements.length > 0 && (
              <div className={styles.achievementBanner}>
                {newAchievements.map((a, i) => (
                  <div key={i} className={styles.achievementItem}>
                    <span className={styles.achievementIcon}>{a.badge?.icon || "🏅"}</span>
                    <span>Achievement Unlocked: <strong>{a.badge?.name}</strong></span>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.resultsGrid}>
              <div className={styles.resultCard}>
                <div className={styles.resultVal}>{wpm}</div><div className={styles.resultLbl}>WPM</div>
              </div>
              <div className={styles.resultCard}>
                <div className={styles.resultVal}>{accuracy}%</div><div className={styles.resultLbl}>Accuracy</div>
              </div>
              <div className={styles.resultCard}>
                <div className={styles.resultVal}>{errors}</div><div className={styles.resultLbl}>Errors</div>
              </div>
              <div className={styles.resultCard}>
                <div className={styles.resultVal} style={{ color: "var(--accent-gold)" }}>+{xpEarned}</div><div className={styles.resultLbl}>XP Earned</div>
              </div>
            </div>

            {(tabSwitches > 0 || pasteAttempts > 0) && (
              <div className={styles.antiCheatSummary}>
                🛡️ Anti-Cheat: {tabSwitches} tab switch{tabSwitches !== 1 && "es"}, {pasteAttempts} paste attempt{pasteAttempts !== 1 && "s"}
              </div>
            )}

            <button className="btn btn-primary btn-lg" onClick={reset}>Try Again →</button>
          </div>
        )}

        {started && !finished && (
          <button className={styles.resetBtn} onClick={reset}>↺ Reset</button>
        )}
      </main>
    </div>
  );
}

function getFallbackText(): string {
  const texts = [
    "The sun rose over the hills and the birds started to sing their morning songs. A gentle breeze blew through the trees and the leaves rustled softly. The flowers in the garden were blooming with bright colors of red, yellow, and purple. It was a beautiful day to go outside and enjoy the fresh air. The children ran out to play in the park while their parents watched from the bench. They played on the swings and slides and laughed with joy. A small dog ran alongside them, barking happily.",
    "Learning to type fast is one of the most useful skills you can develop in the modern world. Whether you are writing emails, coding software, or chatting with friends, the ability to type quickly and accurately will save you hours of time every single day. The key to getting better is consistent practice. Start with short sessions of fifteen minutes each day and gradually increase the duration as you get more comfortable. Focus on accuracy first and speed will follow naturally over time.",
  ];
  return texts[Math.floor(Math.random() * texts.length)];
}
