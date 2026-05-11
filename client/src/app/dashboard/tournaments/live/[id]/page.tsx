"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import styles from "./live.module.css";
import { API_BASE } from "@/lib/api";

interface Participant {
  user: { id: string; username: string };
  wpm: number;
  progress: number;
}

const CAR_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#f43f5e", "#06b6d4", "#a855f7", "#ec4899", "#14b8a6"];

function RaceCar({ color, glow }: { color: string; glow?: boolean }) {
  return (
    <svg width="32" height="14" viewBox="0 0 36 16" fill="none" style={{ filter: glow ? `drop-shadow(0 0 6px ${color})` : undefined }}>
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

export default function LiveTournamentPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: string; username: string } | null>(null);

  const [text, setText] = useState("");
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [wpm, setWpm] = useState(0);

  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const socketRef = useRef<Socket | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<string>("");
  const carRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const textChars = useMemo(() => text.split(""), [text]);

  const textDisplayMemo = useMemo(() => (
    <div className={styles.textDisplay} ref={textDisplayRef}>
      {textChars.map((char, i) => (
        <span key={i} className={i === 0 ? styles.current : styles.upcoming}>{char}</span>
      ))}
    </div>
  ), [textChars]);

  useEffect(() => {
    const fetchUserAndTournament = async () => {
      const token = localStorage.getItem("token");
      if (!token) { router.push("/login"); return; }

      try {
        const [meRes, tRes] = await Promise.all([
          fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/tournaments/${id}`)
        ]);
        if (!meRes.ok || !tRes.ok) throw new Error("Failed to load");

        const meData = await meRes.json();
        const tData = await tRes.json();

        setMe({ id: meData.user.id, username: meData.user.username });
        setTournament(tData.tournament);
        const quoteText = tData.tournament.quoteText || "Welcome to the tournament. Start typing this text as fast as you can to win!";
        setText(quoteText);
        textRef.current = quoteText;

        const isRegistered = tData.tournament.participants.some((p: any) => p.userId === meData.user.id);
        if (tData.tournament.status === 'COMPLETED' || !isRegistered) setFinished(true);

        const initialParticipants: Record<string, Participant> = {};
        tData.tournament.participants.forEach((p: any) => {
          let maxWpm = 0, progress = 0;
          if (p.matches?.length > 0) {
            maxWpm = Math.max(...p.matches.map((m: any) => m.wpm));
            progress = p.matches[0].progress || 100;
          }
          initialParticipants[p.user.id] = { user: p.user, wpm: maxWpm, progress };
        });
        setParticipants(initialParticipants);

        const socket = io(API_BASE, { withCredentials: true });
        socketRef.current = socket;

        socket.on("connect", () => {
          socket.emit("tournament:join", { tournamentId: id, userId: meData.user.id, username: meData.user.username });
        });

        socket.on("tournament:typing-update", (data: any) => {
          setParticipants(prev => {
            const current = prev[data.userId];
            if (!current) return prev;
            return { ...prev, [data.userId]: { ...current, wpm: data.wpm, progress: data.progress } };
          });
          // Direct DOM car update
          const car = carRefs.current.get(data.userId);
          if (car) car.style.left = `calc(${Math.min(92, data.progress)}% - 16px)`;
        });

        socket.on("tournament:status-changed", (data: any) => {
          setTournament((prev: any) => ({ ...prev, status: data.status }));
          if (data.status === "COMPLETED") {
            setFinished(true);
            setParticipants((prev) => {
              if (meData?.user?.id && prev[meData.user.id]) {
                const myStats = prev[meData.user.id];
                socket.emit("tournament:round-complete", {
                  tournamentId: id, userId: meData.user.id,
                  wpm: myStats.wpm, progress: myStats.progress
                });
              }
              return prev;
            });
          }
        });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };

    if (id) fetchUserAndTournament();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [id, router]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (finished) return;
    const val = e.target.value;
    if (val.length > text.length) return;

    if (!started && val.length > 0) { setStarted(true); setStartTime(Date.now()); }
    setInput(val);

    // Direct DOM text update
    if (textDisplayRef.current) {
      const spans = textDisplayRef.current.children;
      for (let i = 0; i < textRef.current.length; i++) {
        if (!spans[i]) break;
        let cls = styles.upcoming;
        if (i < val.length) cls = val[i] === textRef.current[i] ? styles.correct : styles.incorrect;
        else if (i === val.length) cls = styles.current;
        if (spans[i].className !== cls) spans[i].className = cls;
      }
    }

    let currentWpm = 0;
    if (started) {
      const elapsed = (Date.now() - startTime) / 60000;
      if (elapsed > 0) { currentWpm = Math.round((val.length / 5) / elapsed); setWpm(currentWpm); }
    }

    const currentProgress = Math.min(100, Math.round((val.length / text.length) * 100));

    if (me) {
      setParticipants(prev => ({
        ...prev, [me.id]: { ...prev[me.id] || { user: me, wpm: 0, progress: 0 }, wpm: currentWpm, progress: currentProgress }
      }));
      // Move my car
      const car = carRefs.current.get(me.id);
      if (car) car.style.left = `calc(${Math.min(92, currentProgress)}% - 16px)`;
    }

    if (socketRef.current && me) {
      socketRef.current.emit("tournament:typing", { tournamentId: id, userId: me.id, wpm: currentWpm, progress: currentProgress });
    }

    if (val.length === text.length) {
      setFinished(true);
      if (socketRef.current && me) {
        socketRef.current.emit("tournament:round-complete", { tournamentId: id, userId: me.id, wpm: currentWpm, progress: currentProgress });
      }
    }
  };

  if (loading) return <div className={styles.loading}><div className={styles.spinner} /><p>Joining Arena...</p></div>;
  if (!tournament) return <div className={styles.loading}><p>Tournament not found</p></div>;

  const sortedLeaderboard = Object.values(participants).sort((a, b) => {
    if (b.progress !== a.progress) return b.progress - a.progress;
    return b.wpm - a.wpm;
  });

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          ⚔️ {tournament.name} <span className={styles.liveBadge}>{tournament.status === 'COMPLETED' ? 'ENDED' : 'LIVE'}</span>
        </h1>
        <div style={{ color: "var(--text-secondary)", display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem' }}>
          {tournament.status === 'COMPLETED' ? "Final results" : finished ? "Spectating..." : "Type as fast as you can!"}
          {(tournament.status === 'COMPLETED' || finished) && (
            <button className="btn btn-secondary btn-sm" onClick={() => router.push("/dashboard/tournaments")}>← Back</button>
          )}
        </div>
      </div>

      {/* ── RACE TRACK WITH CARS ── */}
      <div className={styles.raceTrack}>
        {sortedLeaderboard.map((p, idx) => {
          const isMe = p.user.id === me?.id;
          const color = CAR_COLORS[idx % CAR_COLORS.length];
          return (
            <div key={p.user.id} className={`${styles.racerLane} ${isMe ? styles.racerLaneMe : ""}`}>
              <div className={styles.racerInfo}>
                <span className={styles.racerRank}>
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                </span>
                <div className={`${styles.racerAvatar} ${isMe ? styles.racerAvatarMe : styles.racerAvatarOther}`}>
                  {p.user.username[0]?.toUpperCase()}
                </div>
                <span className={`${styles.racerName} ${isMe ? styles.racerNameMe : styles.racerNameOther}`}>
                  {p.user.username}{isMe ? " (You)" : ""}
                </span>
              </div>
              <div className={styles.trackArea}>
                <div className={styles.trackRoad} />
                <div className={styles.carWrap}
                  ref={(el) => { if (el) carRefs.current.set(p.user.id, el); }}
                  style={{ left: `calc(${Math.min(92, p.progress)}% - 16px)` }}>
                  <RaceCar color={color} glow={isMe} />
                </div>
              </div>
              <div className={`${styles.racerWpm} ${isMe ? styles.racerWpmMe : ""}`}>{p.wpm} wpm</div>
            </div>
          );
        })}
      </div>

      <div className={styles.arena}>
        {/* ── Typing Area ── */}
        <div className={styles.typingCard} onClick={() => inputRef.current?.focus()}>
          {textDisplayMemo}
          <textarea ref={inputRef} className={styles.inputField} value={input}
            onChange={handleInput} autoFocus disabled={finished}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
          {finished && input.length === text.length && input.length > 0 && (
            <div style={{ textAlign: "center", marginTop: "1.5rem", color: "#22c55e", fontWeight: 700, fontSize: "1.125rem" }}>
              🎉 You finished with {wpm} WPM!
            </div>
          )}
        </div>

        {/* ── Live Leaderboard Table ── */}
        <div className={styles.leaderboardCard}>
          <div className={styles.lbTitle}>🏆 Live Leaderboard</div>
          <div className={styles.lbList}>
            {sortedLeaderboard.map((p, idx) => (
              <div key={p.user.id} className={`${styles.lbItem} ${p.user.id === me?.id ? styles.lbItemMe : ''}`}>
                <div className={styles.lbHeader}>
                  <div className={styles.lbUser}>
                    <span className={styles.lbRank}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                    </span>
                    <span className={styles.lbName}>{p.user.username}{p.user.id === me?.id && " (You)"}</span>
                  </div>
                  <div className={styles.lbWpm}>{p.wpm} WPM</div>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${p.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
