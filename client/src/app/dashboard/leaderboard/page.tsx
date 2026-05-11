"use client";
import { useState, useEffect } from "react";
import styles from "./leaderboard.module.css";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

interface LeaderEntry {
  rank: number; username: string; avatar?: string; country?: string;
  level: number; bestWpm: number; avgWpm: number; races: number;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [period, setPeriod] = useState("weekly");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    setErrorMsg("");
    
    api.getLeaderboard(period, 25)
      .then(d => { 
        setEntries(d.leaderboard || []); 
        setLoading(false); 
      })
      .catch((e) => { 
        console.error(e);
        setErrorMsg("Failed to load leaderboard. Please try again.");
        setLoading(false); 
      });
      
    // Handle bfcache restore (browser back button)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setLoading(true);
        api.getLeaderboard(period, 25)
          .then(d => { setEntries(d.leaderboard || []); setLoading(false); })
          .catch(() => setLoading(false));
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [period]);

  const tierColors: Record<string, string> = {
    Legend: "#fbbf24", Diamond: "#06b6d4", Platinum: "#a78bfa",
    Gold: "#f59e0b", Silver: "#94a3b8", Bronze: "#d97706",
  };
  const getTier = (lvl: number) => lvl >= 50 ? "Legend" : lvl >= 40 ? "Diamond" : lvl >= 30 ? "Platinum" : lvl >= 20 ? "Gold" : lvl >= 10 ? "Silver" : "Bronze";

  return (
    <div className={styles.page}>
      <Sidebar activePage="leaderboard" />
      <main className={styles.main}>
        <h1 className={styles.title}>🏅 Global Leaderboard</h1>
        <p className={styles.subtitle}>The fastest typists in the world</p>

        <div className={styles.tabs}>
          {["daily", "weekly", "alltime"].map(p => (
            <button key={p} className={`${styles.tab} ${period === p ? styles.tabActive : ""}`} onClick={() => setPeriod(p)}>
              {p === "alltime" ? "All Time" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : errorMsg ? (
          <div className={styles.empty}>
            {errorMsg}
            <br />
            <button onClick={() => setPeriod(period)} className={styles.emptyBtn} style={{marginTop: "1rem", cursor: "pointer"}}>🔄 Retry</button>
          </div>
        ) : entries.length === 0 ? (
          <div className={styles.empty}>No data for this period yet. Start typing to appear here!</div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>#</span><span>Player</span><span>Level</span><span>Best WPM</span><span>Avg WPM</span><span>Races</span>
            </div>
            {entries.map((e) => {
              const tier = getTier(e.level);
              return (
                <div key={e.rank} className={`${styles.row} ${e.rank <= 3 ? styles.topRow : ""}`}>
                  <span className={styles.rank}>
                    {e.rank <= 3 ? ["🥇", "🥈", "🥉"][e.rank - 1] : `#${e.rank}`}
                  </span>
                  <div className={styles.player}>
                    <div className={styles.avatar}>{e.country || "🌍"}</div>
                    <div>
                      <div className={styles.playerName}>{e.username}</div>
                      <div className={styles.playerTier} style={{ color: tierColors[tier] }}>{tier}</div>
                    </div>
                  </div>
                  <span className={styles.level}>Lv.{e.level}</span>
                  <span className={styles.bestWpm}>{e.bestWpm}</span>
                  <span className={styles.avgWpm}>{e.avgWpm}</span>
                  <span className={styles.races}>{e.races}</span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
