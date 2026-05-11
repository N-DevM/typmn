"use client";
import { useState, useEffect } from "react";
import styles from "./leaderboard.module.css";
import { API_BASE } from "@/lib/api";

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `about ${mins} minute${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `about ${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `about ${days} day${days > 1 ? "s" : ""} ago`;
}

interface LeaderEntry {
  rank: number; username: string; avatar?: string; country?: string;
  level: number; bestWpm: number; avgWpm: number; accuracy: number;
  races: number; lastRaceDate: string | null;
}

export default function PublicLeaderboard() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [period, setPeriod] = useState("alltime");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const u = localStorage.getItem("user");
        if (u) setUser(JSON.parse(u));
      } catch {}
    }
  }, []);

  const fetchLeaderboard = (p: string, isSilent = false) => {
    if (!isSilent && entries.length === 0) setLoading(true);
    setErrorMsg("");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`${API_BASE}/api/practice/leaderboard?period=${p}&limit=50&_t=${Date.now()}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { 
        clearTimeout(timeoutId);
        setEntries(d.leaderboard || []); 
        setLoading(false); 
      })
      .catch((e) => { 
        clearTimeout(timeoutId);
        console.error("Leaderboard fetch error:", e);
        if (entries.length === 0) setErrorMsg("Failed to load leaderboard. Please try again.");
        setLoading(false); 
      });
  };

  useEffect(() => {
    fetchLeaderboard(period);
    
    // Auto-refresh every 15 seconds silently
    const iv = setInterval(() => fetchLeaderboard(period, true), 15000);
    
    // Handle bfcache restore (browser back button)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    
    return () => {
      clearInterval(iv);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [period]);

  const isLoggedIn = !!user;

  const tabs = [
    { id: "today", label: "Today", icon: "📅" },
    { id: "week", label: "Week", icon: "📆" },
    { id: "month", label: "Month", icon: "🗓" },
    { id: "alltime", label: "All Time", icon: "⭐" },
  ];

  return (
    <div className={styles.page}>
      {/* ═══ SIDEBAR ═══ */}
      <aside className={styles.sidebar}>
        <a href="/" className={styles.logo}>
          <span>⌨</span> Typ<span className={styles.logoAccent}>mN</span>
        </a>

        <div className={styles.playLabel}>Play</div>
        <div className={styles.actionGroup}>
          <a href={isLoggedIn ? "/race" : "/race"} className={`${styles.actionBtn} ${styles.btnCompete}`}>
            🏁 Compete in a race
          </a>
          <a href="/practice" className={`${styles.actionBtn} ${styles.btnPractice}`}>
            ✏️ Practice alone
          </a>
          <a href={isLoggedIn ? "/race?mode=private" : "/login"} className={`${styles.actionBtn} ${styles.btnPrivate}`}>
            🔗 Create private race
          </a>
        </div>

        <div className={styles.sidebarDivider} />

        <div className={styles.contributeText}>
          Join the fastest typists in the world. <a href="/register">Sign up free</a> to track your stats and compete! 🚀
        </div>

        <div className={styles.sidebarBottom}>
          {isLoggedIn ? (
            <div className={styles.userCard}>
              <div className={styles.userAvatar}>{user.username?.[0]?.toUpperCase() || "?"}</div>
              <div>
                <div className={styles.userName}>{user.username}</div>
                <div className={styles.userSub}><a href="/dashboard">Dashboard →</a></div>
              </div>
            </div>
          ) : (
            <>
              <a href="/login" className={styles.authLink}>🔑 Log In</a>
              <a href="/register" className={styles.authLink}>🚀 Register</a>
            </>
          )}
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className={styles.main}>
        {/* Tab Bar */}
        <div className={styles.headerBar}>
          <div className={styles.searchBox}>🔍</div>
          {tabs.map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${period === t.id ? styles.tabActive : ""}`}
              onClick={() => setPeriod(t.id)}
            >
              <span className={styles.tabIcon}>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : errorMsg ? (
          <div className={styles.empty}>
            {errorMsg}
            <br />
            <button onClick={() => fetchLeaderboard(period, false)} className={styles.emptyBtn}>🔄 Retry</button>
          </div>
        ) : entries.length === 0 ? (
          <div className={styles.empty}>
            No races for this period yet. Be the first to type!
            <br />
            <a href="/practice" className={styles.emptyBtn}>✏️ Start Practicing</a>
          </div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>#</span>
              <span>Player</span>
              <span>Speed</span>
              <span>Accuracy</span>
              <span>Date</span>
            </div>
            {entries.map(e => {
              const rowClass = e.rank === 1 ? styles.rowGold : e.rank === 2 ? styles.rowSilver : e.rank === 3 ? styles.rowBronze : "";
              return (
                <div key={e.rank} className={`${styles.row} ${rowClass}`}>
                  <span className={styles.rank}>{e.rank}</span>
                  <div className={styles.player}>
                    <span className={styles.playerFlag}>{e.country || "🌍"}</span>
                    <span className={styles.playerName}>{e.username}</span>
                  </div>
                  <span className={styles.speed}>
                    {e.bestWpm}<span className={styles.speedUnit}> wpm</span>
                  </span>
                  <span className={styles.accuracy}>{e.accuracy} %</span>
                  <span className={styles.date}>{timeAgo(e.lastRaceDate)}</span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
