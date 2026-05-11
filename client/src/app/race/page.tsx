"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { io, Socket } from "socket.io-client";
import { useSearchParams } from "next/navigation";
import styles from "./race.module.css";
import { API_BASE } from "@/lib/api";

type RaceState = "IDLE" | "QUEUE" | "COUNTDOWN" | "RACING" | "FINISHED";

interface Player {
  socketId: string; username: string; isGhost: boolean;
  progress: number; wpm: number; finished?: boolean;
}

interface RaceResult {
  position: number; username: string; wpm: number; accuracy: number;
  isGhost: boolean; finished: boolean; finishTime?: number;
}

// ── SVG Race Cars (inline for performance) ──
const CAR_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#f43f5e", "#06b6d4", "#a855f7", "#ec4899", "#14b8a6"];

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

// ── Sound Engine (Web Audio API) ──
class SoundEngine {
  private ctx: AudioContext | null = null;
  private init() { 
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx(); 
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  playKeyClick() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(800 + Math.random() * 400, this.ctx.currentTime);
    osc.type = "square";
    gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.start(); osc.stop(this.ctx.currentTime + 0.05);
  }

  playCountdown() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.type = "sine";
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    osc.start(); osc.stop(this.ctx.currentTime + 0.3);
  }

  playGo() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
    osc.start(); osc.stop(this.ctx.currentTime + 0.5);
  }

  playFinish() {
    this.init();
    if (!this.ctx) return;
    [523, 659, 784].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.connect(gain); gain.connect(this.ctx!.destination);
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + i * 0.1);
      osc.type = "sine";
      gain.gain.setValueAtTime(0.1, this.ctx!.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + i * 0.1 + 0.4);
      osc.start(this.ctx!.currentTime + i * 0.1);
      osc.stop(this.ctx!.currentTime + i * 0.1 + 0.4);
    });
  }

  playError() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.type = "sawtooth";
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.start(); osc.stop(this.ctx.currentTime + 0.08);
  }
}

const sound = typeof window !== "undefined" ? new SoundEngine() : null;

function RaceContent() {
  const searchParams = useSearchParams();
  const joinCode = searchParams?.get("code");

  const [state, setState] = useState<RaceState>("IDLE");
  const [gameMode, setGameMode] = useState<"text" | "game">("text");
  const [raceId, setRaceId] = useState("");
  const [privateCode, setPrivateCode] = useState("");
  const [joinInput, setJoinInput] = useState(joinCode || "");
  const [countdown, setCountdown] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("Guest");
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ── Refs for zero-rerender typing ──
  const socketRef = useRef<Socket | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const textRef = useRef("");
  const inputVal = useRef("");
  const startTimeRef = useRef(0);
  const finishedRef = useRef(false);
  const raceIdRef = useRef("");
  const stateRef = useRef<RaceState>("IDLE");
  const gameModeRef = useRef<"text" | "game">("text");
  const wpmRef = useRef<HTMLDivElement>(null);
  const accRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLDivElement>(null);
  const carRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const wpmLabelRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { raceIdRef.current = raceId; }, [raceId]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");
      if (token && userStr) {
        try { const u = JSON.parse(userStr); setIsLoggedIn(true); setUsername(u.username || "Player"); setUserId(u.id || null); } catch {}
      }
    }
  }, []);

  // ── Socket ──
  useEffect(() => {
    const socket = io(API_BASE, { withCredentials: true });
    socketRef.current = socket;

    socket.on("race:queue-status", (d) => setQueueCount(d.waiting));
    socket.on("race:state", (d) => {
      setRaceId(d.raceId); raceIdRef.current = d.raceId;
      if (d.code) setPrivateCode(d.code);
      textRef.current = d.text;
      setPlayers(d.players);
      if (d.status === "WAITING") setState("QUEUE");
    });
    socket.on("race:countdown", (d) => {
      setState("COUNTDOWN"); setCountdown(d.count);
      if (d.text) textRef.current = d.text;
      if (d.count > 0) sound?.playCountdown();
      else sound?.playGo();
    });
    socket.on("race:start", (d) => {
      setState("RACING"); stateRef.current = "RACING";
      textRef.current = d.text; inputVal.current = "";
      finishedRef.current = false; startTimeRef.current = Date.now();
      // Render text chars after a tick so DOM is ready
      setTimeout(() => {
        if (textDisplayRef.current) {
          textDisplayRef.current.innerHTML = "";
          for (let i = 0; i < d.text.length; i++) {
            const span = document.createElement("span");
            span.textContent = d.text[i];
            span.className = i === 0 ? styles.current : styles.upcoming;
            textDisplayRef.current.appendChild(span);
          }
        }
        inputRef.current?.focus();
      }, 80);
    });

    socket.on("race:player-update", (d) => {
      // Direct DOM update — no setState
      const car = carRefs.current.get(d.socketId);
      if (car) {
        if (gameModeRef.current === "game") {
          car.style.left = `calc(${Math.min(92, d.progress)}% - 18px)`;
        } else {
          car.style.width = `${Math.min(100, d.progress)}%`;
        }
      }
      const wl = wpmLabelRefs.current.get(d.socketId);
      if (wl) wl.textContent = `${d.wpm} wpm`;
      // Update internal state for sorting (minimal)
      setPlayers(prev => {
        const idx = prev.findIndex(p => p.socketId === d.socketId);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], progress: d.progress, wpm: d.wpm };
        return copy;
      });
    });

    socket.on("race:player-finished", (d) => {
      setPlayers(prev => prev.map(p => p.socketId === d.socketId ? { ...p, progress: 100, wpm: d.wpm, finished: true } : p));
    });
    socket.on("race:player-left", (d) => setPlayers(prev => prev.filter(p => p.socketId !== d.socketId)));
    socket.on("race:results", (d) => { setState("FINISHED"); setResults(d.rankings); sound?.playFinish(); });
    socket.on("race:private-created", (d) => { setRaceId(d.raceId); raceIdRef.current = d.raceId; setPrivateCode(d.code); setState("QUEUE"); });
    socket.on("race:error", (d) => { setError(d.message); setTimeout(() => setError(""), 5000); });

    if (joinCode) socket.emit("race:join-private", { code: joinCode, userId, username });
    return () => { socket.disconnect(); };
  }, []);

  // ── High-performance input handler (ref-based, no re-render) ──
  const handleNativeInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (stateRef.current !== "RACING" || finishedRef.current) return;
    const val = e.target.value;
    const prevLen = inputVal.current.length;
    if (val.length - prevLen > 5) return; // paste block
    inputVal.current = val;

    // Sound
    if (val.length > prevLen) {
      const lastChar = val[val.length - 1];
      const expectedChar = textRef.current[val.length - 1];
      if (lastChar === expectedChar) sound?.playKeyClick();
      else sound?.playError();
    }

    // DOM text highlighting (direct, no React)
    const spans = textDisplayRef.current?.children;
    if (spans) {
      const t = textRef.current;
      let currentEl: HTMLElement | null = null;
      for (let i = 0; i < t.length; i++) {
        if (!spans[i]) break;
        let cls = styles.upcoming;
        if (i < val.length) cls = val[i] === t[i] ? styles.correct : styles.wrong;
        else if (i === val.length) {
          cls = styles.current;
          currentEl = spans[i] as HTMLElement;
        }
        if ((spans[i] as HTMLElement).className !== cls) (spans[i] as HTMLElement).className = cls;
      }
      
      // Auto-scroll logic
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

    // Calc stats
    let correct = 0;
    for (let i = 0; i < val.length; i++) { if (val[i] === textRef.current[i]) correct++; }
    const acc = val.length > 0 ? Math.round((correct / val.length) * 1000) / 10 : 100;
    const progress = Math.min(100, Math.round((val.length / textRef.current.length) * 100));
    const elapsed = (Date.now() - startTimeRef.current) / 60000;
    const currentWpm = elapsed > 0 ? Math.round((val.length / 5) / elapsed) : 0;

    // Direct DOM stat updates (no setState!)
    if (wpmRef.current) wpmRef.current.textContent = String(currentWpm);
    if (accRef.current) accRef.current.textContent = `${acc}%`;
    if (progRef.current) progRef.current.textContent = `${progress}%`;

    // Move my car / progress bar directly
    const myId = socketRef.current?.id;
    if (myId) {
      const car = carRefs.current.get(myId);
      if (car) {
        if (gameModeRef.current === "game") {
          car.style.left = `calc(${Math.min(92, progress)}% - 18px)`;
        } else {
          car.style.width = `${Math.min(100, progress)}%`;
        }
      }
      const wl = wpmLabelRefs.current.get(myId);
      if (wl) wl.textContent = `${currentWpm} wpm`;
    }

    // Emit (throttled by socket)
    socketRef.current?.emit("race:typing", { raceId: raceIdRef.current, progress, wpm: currentWpm, accuracy: acc });

    // Finish check
    if (val.length >= textRef.current.length) {
      finishedRef.current = true;
      sound?.playFinish();
      socketRef.current?.emit("race:finished", { raceId: raceIdRef.current, wpm: currentWpm, accuracy: acc });
    }
  }, []);



  const joinQueue = () => { setState("QUEUE"); socketRef.current?.emit("race:join-queue", { userId, username, avgWpm: 50 }); };
  const leaveQueue = () => { setState("IDLE"); socketRef.current?.emit("race:leave-queue"); };
  const createPrivate = () => socketRef.current?.emit("race:create-private", { userId, username });
  const joinPrivate = () => { if (joinInput.trim()) socketRef.current?.emit("race:join-private", { code: joinInput.trim(), userId, username }); };
  const startPrivate = () => socketRef.current?.emit("race:start-private", { raceId });
  const playAgain = () => { setState("IDLE"); setPlayers([]); setResults([]); finishedRef.current = false; inputVal.current = ""; };

  const sortedPlayers = [...players].sort((a, b) => b.progress - a.progress);

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <a href="/" className={styles.logo}><span>⌨</span> Typ<span className={styles.logoAccent}>mN</span></a>
        <div className={styles.navLinks}>
          <a href="/leaderboard">Leaderboard</a>
          <a href="/practice">Practice</a>
          {isLoggedIn ? <a href="/dashboard">Dashboard</a> : <a href="/login">Log In</a>}
        </div>
      </nav>

      {error && <div className={styles.errorBar}>{error}</div>}

      <div className={styles.body}>
        {state === "IDLE" && (
          <>
            <div className={styles.modeToggle}>
              <div className={styles.modeSlider} style={{ transform: gameMode === "game" ? "translateX(100%)" : "translateX(0)" }} />
              <button className={`${styles.modeBtn} ${gameMode === "text" ? styles.modeBtnActive : ""}`} onClick={() => setGameMode("text")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                Text Mode
              </button>
              <button className={`${styles.modeBtn} ${gameMode === "game" ? styles.modeBtnActive : ""}`} onClick={() => setGameMode("game")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="4" y1="12" x2="8" y2="12"/><circle cx="15" cy="10" r="1" fill="currentColor"/><circle cx="18" cy="12" r="1" fill="currentColor"/></svg>
                Game Mode
              </button>
            </div>
            <div className={styles.queueCard}>
              <h1 className={styles.queueTitle}>🏁 {gameMode === "text" ? "Text Mode" : "Game Mode"}</h1>
              <p className={styles.queueSub}>{gameMode === "text" ? "Race against others by typing a passage" : "Fast-paced keystroke challenge"}</p>
              <button className={`${styles.findBtn} ${styles.findBtnGreen}`} onClick={joinQueue}>🏁 Find a Race</button>
              {isLoggedIn && (
                <>
                  <button className={`${styles.findBtn} ${styles.findBtnPurple}`} onClick={createPrivate}>🔗 Create Private Race</button>
                  <div className={styles.joinRow}>
                    <input type="text" placeholder="Room code" value={joinInput} onChange={(e) => setJoinInput(e.target.value.toUpperCase())} className={styles.codeInput} />
                    <button className={styles.joinBtn} onClick={joinPrivate}>Join</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {state === "QUEUE" && (
          <div className={styles.queueCard}>
            {privateCode ? (
              <>
                <h2 className={styles.queueTitle}>🔗 Private Race</h2>
                <p className={styles.queueSub}>Share this code with friends</p>
                <div className={styles.roomCode}>{privateCode}</div>
                <div className={styles.roomLink}>Or share: <span>{typeof window !== "undefined" ? `${window.location.origin}/race?code=${privateCode}` : ""}</span></div>
                <div className={styles.roomPlayers}>Players: {players.filter(p => !p.isGhost).length}</div>
                <button className={styles.startBtn} onClick={startPrivate}>▶ Start Race</button>
              </>
            ) : (
              <>
                <h2 className={styles.queueTitle}>🔍 Finding opponents...</h2>
                <div className={styles.waitingDots}>{[0,1,2,3].map(i => <div key={i} className={`${styles.dot} ${i < queueCount ? styles.dotActive : ""}`} />)}</div>
                <div className={styles.waitCount}>{queueCount}</div>
                <div className={styles.waitLabel}>player{queueCount !== 1 ? "s" : ""} in queue</div>
                <button className={styles.cancelBtn} onClick={leaveQueue}>Cancel</button>
              </>
            )}
          </div>
        )}

        {state === "COUNTDOWN" && (
          <div><div className={styles.countdown} key={countdown}>{countdown > 0 ? countdown : "GO!"}</div><div className={styles.countLabel}>Get ready to type...</div></div>
        )}

        {state === "RACING" && (
          <div className={styles.arena}>
            <div className={styles.statsBar}>
              <div className={styles.statItem}><div className={styles.statVal} ref={wpmRef}>0</div><div className={styles.statLabel}>WPM</div></div>
              <div className={styles.statItem}><div className={styles.statVal} ref={accRef}>100%</div><div className={styles.statLabel}>Accuracy</div></div>
              <div className={styles.statItem}><div className={styles.statVal} ref={progRef}>0%</div><div className={styles.statLabel}>Progress</div></div>
            </div>

            {/* ── GAME MODE: Show car race track ── */}
            {gameMode === "game" && (
              <div className={styles.raceTrack}>
                <div className={styles.finishLine} />
                {sortedPlayers.map((p, i) => {
                  const isMe = p.socketId === socketRef.current?.id;
                  const color = CAR_COLORS[i % CAR_COLORS.length];
                  return (
                    <div key={p.socketId} className={`${styles.racerLane} ${isMe ? styles.racerLaneMe : ""}`}>
                      <div className={styles.racerInfo}>
                        <div className={`${styles.racerAvatar} ${isMe ? styles.racerAvatarMe : styles.racerAvatarOther}`}>{p.username[0]?.toUpperCase()}</div>
                        <span className={`${styles.racerName} ${isMe ? styles.racerNameMe : styles.racerNameOther}`}>{p.username}{isMe ? " (You)" : ""}</span>
                      </div>
                      <div className={styles.trackArea}>
                        <div className={styles.trackRoad} />
                        <div className={styles.carWrap} ref={(el) => { if (el) carRefs.current.set(p.socketId, el); }} style={{ left: "-18px" }}>
                          <RaceCar color={color} glow={isMe} />
                        </div>
                      </div>
                      <div className={`${styles.racerWpm} ${isMe ? styles.racerWpmMe : ""}`} ref={(el) => { if (el) wpmLabelRefs.current.set(p.socketId, el); }}>0 wpm</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── TEXT MODE: Show player list as simple progress bars ── */}
            {gameMode === "text" && (
              <div className={styles.textPlayerList}>
                {sortedPlayers.map((p) => {
                  const isMe = p.socketId === socketRef.current?.id;
                  return (
                    <div key={p.socketId} className={`${styles.textPlayerRow} ${isMe ? styles.textPlayerRowMe : ""}`}>
                      <div className={styles.textPlayerName}>
                        <div className={`${styles.racerAvatar} ${isMe ? styles.racerAvatarMe : styles.racerAvatarOther}`}>{p.username[0]?.toUpperCase()}</div>
                        <span>{p.username}{isMe ? " (You)" : ""}</span>
                      </div>
                      <div className={styles.textProgressBar}>
                        <div className={styles.textProgressFill} ref={(el) => { if (el) carRefs.current.set(p.socketId, el); }} style={{ width: "0%" }} />
                      </div>
                      <div className={`${styles.racerWpm} ${isMe ? styles.racerWpmMe : ""}`} ref={(el) => { if (el) wpmLabelRefs.current.set(p.socketId, el); }}>0 wpm</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Typing Area (shown in BOTH modes) ── */}
            {!finishedRef.current ? (
              <div className={styles.typingCard} onClick={() => inputRef.current?.focus()}>
                <div ref={textDisplayRef} className={styles.textContent} />
                <textarea ref={inputRef} className={styles.hiddenInput} onChange={handleNativeInput}
                  onPaste={(e) => e.preventDefault()} autoFocus
                  autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
              </div>
            ) : (
              <div className={styles.finishedMsg}>🎉 You finished! Waiting for others...</div>
            )}
          </div>
        )}

        {state === "FINISHED" && (
          <div className={styles.results}>
            <h2 className={styles.resultsTitle}>🏆 Race Results</h2>
            <div className={styles.resultsList}>
              <div className={`${styles.resultRow} ${styles.resultRowHead}`}><span>#</span><span>Player</span><span>WPM</span><span>Accuracy</span><span>Time</span></div>
              {results.map(r => {
                const isMe = r.username === username;
                return (
                  <div key={r.position} className={`${styles.resultRow} ${isMe ? styles.resultRowMe : ""}`}>
                    <span className={styles.resultPos}>{r.position <= 3 ? ["🥇","🥈","🥉"][r.position-1] : `#${r.position}`}</span>
                    <span className={styles.resultName}>{r.username}{isMe ? " (You)" : ""}</span>
                    <span className={styles.resultWpm}>{Math.round(r.wpm)}</span>
                    <span className={styles.resultAcc}>{Math.round(r.accuracy*10)/10}%</span>
                    <span className={styles.resultTime}>{r.finishTime ? `${(r.finishTime/1000).toFixed(1)}s` : "DNF"}</span>
                  </div>
                );
              })}
            </div>
            <div className={styles.resultsActions}>
              <button className={`${styles.btn} ${styles.btnGreen}`} onClick={() => { playAgain(); joinQueue(); }}>🏁 Race Again</button>
              <a href="/leaderboard" className={`${styles.btn} ${styles.btnOutline}`}>📊 Leaderboard</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RacePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifySelf: 'center', color: '#fff' }}>Loading Race...</div>}>
      <RaceContent />
    </Suspense>
  );
}
