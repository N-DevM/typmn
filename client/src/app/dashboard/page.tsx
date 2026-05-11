"use client";
import { useState, useEffect } from "react";
import styles from "./dashboard.module.css";
import { api } from "@/lib/api";
import { clearAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

interface User {
  id: string; username: string; email: string; role: string;
  avatar?: string; country?: string; bio?: string;
  stats?: {
    totalPractices: number; bestWpm: number; avgWpm: number; avgAccuracy: number;
    totalXp: number; level: number; currentStreak: number; longestStreak: number;
    tournamentsWon: number; tournamentsPlayed: number; totalTypingTime: number;
  };
  streaks?: { currentStreak: number; longestStreak: number };
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/login"; return; }
    api.getMe()
      .then(d => { setUser(d.user); setLoading(false); })
      .catch(() => { clearAuth(); window.location.href = "/login"; });
  }, []);

  const handleLogout = async () => {
    try { await api.logout(); } catch {}
    clearAuth();
    window.location.href = "/";
  };

  if (loading) return (
    <div className={styles.loadingPage}>
      <div className={styles.spinner} />
      <p>Loading your arena...</p>
    </div>
  );

  const s = user?.stats;
  const level = s?.level || 1;
  const xp = s?.totalXp || 0;
  const xpForNext = level * 500;
  const xpProgress = ((xp % 500) / 500) * 100;
  const tierName = level >= 50 ? "Legend" : level >= 40 ? "Diamond" : level >= 30 ? "Platinum" : level >= 20 ? "Gold" : level >= 10 ? "Silver" : "Bronze";

  return (
    <div className={styles.dashboard}>
      <Sidebar activePage="dashboard" />

      {/* Main */}
      <main className={styles.main}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <div>
            <h1 className={styles.greeting}>Welcome back, <span className="text-gradient">{user?.username}</span> 👋</h1>
            <p className={styles.greetingSub}>Ready to type? Your arena awaits.</p>
          </div>
          <div className={styles.topbarRight}>
            <div className={styles.streakBadge}>🔥 {user?.streaks?.currentStreak || 0} day streak</div>
            <div className={styles.xpBadge}>⚡ {xp.toLocaleString()} XP</div>
          </div>
        </header>

        {/* Level Progress */}
        <div className={styles.levelCard}>
          <div className={styles.levelInfo}>
            <div className={styles.levelBadge}>{tierName}</div>
            <span className={styles.levelText}>Level {level}</span>
            <span className={styles.levelXp}>{xp % 500} / 500 XP to next level</span>
          </div>
          <div className={styles.levelBar}><div className={styles.levelFill} style={{ width: `${xpProgress}%` }} /></div>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>⚡</div>
            <div className={styles.statValue}>{s?.bestWpm?.toFixed(0) || 0}</div>
            <div className={styles.statLabel}>Best WPM</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📊</div>
            <div className={styles.statValue}>{s?.avgWpm?.toFixed(0) || 0}</div>
            <div className={styles.statLabel}>Avg WPM</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🎯</div>
            <div className={styles.statValue}>{s?.avgAccuracy?.toFixed(1) || 0}%</div>
            <div className={styles.statLabel}>Accuracy</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🏁</div>
            <div className={styles.statValue}>{s?.totalPractices || 0}</div>
            <div className={styles.statLabel}>Practices</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🏆</div>
            <div className={styles.statValue}>{s?.tournamentsWon || 0}</div>
            <div className={styles.statLabel}>Wins</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>⏱️</div>
            <div className={styles.statValue}>{Math.floor((s?.totalTypingTime || 0) / 60)}m</div>
            <div className={styles.statLabel}>Time Typed</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className={styles.quickActions}>
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
          <div className={styles.actionGrid}>
            <a href="/dashboard/practice" className={styles.actionCard} data-color="indigo">
              <div className={styles.actionIcon}>⌨️</div>
              <h3>Start Practice</h3>
              <p>Improve your speed with focused practice sessions</p>
            </a>
            <a href="/dashboard/tournaments" className={styles.actionCard} data-color="amber">
              <div className={styles.actionIcon}>🏆</div>
              <h3>Join Tournament</h3>
              <p>Compete for real prizes in live tournaments</p>
            </a>
            <a href="/dashboard/leaderboard" className={styles.actionCard} data-color="emerald">
              <div className={styles.actionIcon}>🏅</div>
              <h3>Leaderboard</h3>
              <p>See where you rank among the best typists</p>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
